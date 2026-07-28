import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { normalizeEntityHintCommaLabel } from "@/lib/comma-place-label";
import { repairSapPageAllocation, type SuggestedKeywordTarget } from "@/lib/local-analysis-suggest-keyword-targets";
import {
  groupKeywordTargetRowsInOrder,
  inheritKeywordTargetEntityHints,
  keywordTargetsInGenerationOrder,
  migrateClusterSapToMembers,
  splitIntegerTotalAcrossMemberSlots,
  type KeywordTargetRowLike,
} from "@/lib/local-analysis-keyword-cluster";
import {
  LOCAL_ANALYSIS_DEFAULT_SAP_PAGES,
  LOCAL_ANALYSIS_SAP_MAX,
  LOCAL_ANALYSIS_SAP_MIN,
} from "@/lib/local-analysis-target-constants";

export type EntityTitleClusterKeywordTarget = KeywordTargetRowLike & { id: string };

export type EntityTitleClusterJob = {
  clusterKey: string;
  seedKeyword: string;
  rowIndices: number[];
};

type NormalizedTarget = EntityTitleClusterKeywordTarget & { sapPages: number };

function normalizeForSegments(rows: EntityTitleClusterKeywordTarget[]): {
  targets: NormalizedTarget[];
  total: number;
} {
  const migrated = migrateClusterSapToMembers(rows) as EntityTitleClusterKeywordTarget[];
  const inherited = inheritKeywordTargetEntityHints(migrated) as EntityTitleClusterKeywordTarget[];
  const hasMemberByCluster = new Set<string>();
  for (const r of inherited) {
    if (r.clusterRole === "member" && r.clusterId?.trim()) hasMemberByCluster.add(r.clusterId.trim());
  }
  const targets = inherited
    .map((r) => {
      const keyword = r.keyword.trim();
      const hint = normalizeEntityHintCommaLabel(r.entityHint ?? "");
      const isMember = r.clusterRole === "member";
      const cid = r.clusterId?.trim();
      const seedWithMembers = !isMember && cid != null && hasMemberByCluster.has(cid);
      const sapPages = isMember
        ? Math.min(LOCAL_ANALYSIS_SAP_MAX, Math.max(LOCAL_ANALYSIS_SAP_MIN, Math.floor(r.sapPages) || 0))
        : seedWithMembers
          ? 0
          : Math.min(
              LOCAL_ANALYSIS_SAP_MAX,
              Math.max(LOCAL_ANALYSIS_SAP_MIN, Math.floor(r.sapPages) || LOCAL_ANALYSIS_DEFAULT_SAP_PAGES),
            );
      return {
        ...r,
        keyword,
        sapPages,
        entityHint: hint.length > 0 ? hint : r.entityHint,
      };
    })
    .filter((r) => r.keyword.length > 0);
  const total = targets.reduce((s, t) => s + t.sapPages, 0);
  return { targets, total };
}

function sapBearingTargets(targets: NormalizedTarget[]): NormalizedTarget[] {
  const groups = groupKeywordTargetRowsInOrder(targets);
  const out: NormalizedTarget[] = [];
  for (const g of groups) {
    if (g.members.length > 0) {
      for (const m of g.members) {
        const nt = targets.find((x) => x.id === m.id);
        if (nt) out.push(nt);
      }
    } else if (g.seed.keyword.trim() && (Math.floor(g.seed.sapPages) || 0) > 0) {
      const nt = targets.find((x) => x.id === g.seed.id);
      if (nt) out.push(nt);
    }
  }
  return out;
}

function clusterGroups(rows: EntityTitleClusterKeywordTarget[]): { clusterKey: string; indices: number[] }[] {
  const idToIndex = new Map(rows.map((r, i) => [r.id, i]));
  const ordered = groupKeywordTargetRowsInOrder(rows);
  return ordered.map((g) => {
    const indices: number[] = [];
    const si = idToIndex.get(g.seed.id);
    if (si !== undefined) indices.push(si);
    for (const m of g.members) {
      const mi = idToIndex.get(m.id);
      if (mi !== undefined) indices.push(mi);
    }
    indices.sort((a, b) => a - b);
    return {
      clusterKey: g.seed.clusterId?.trim() || g.seed.id,
      indices,
    };
  });
}

function generationTargetIndex(rows: EntityTitleClusterKeywordTarget[], rowIndex: number): number | null {
  const row = rows[rowIndex];
  if (!row?.keyword.trim()) return null;
  const order = keywordTargetsInGenerationOrder(migrateClusterSapToMembers(rows) as EntityTitleClusterKeywordTarget[]);
  const idx = order.findIndex((r) => r.id === row.id);
  return idx >= 0 ? idx : null;
}

function mergeRepairedSapBearingIntoTargets(
  allTargets: NormalizedTarget[],
  sapBearing: NormalizedTarget[],
  repaired: SuggestedKeywordTarget[],
): NormalizedTarget[] {
  if (repaired.length === sapBearing.length) {
    const byId = new Map(sapBearing.map((t, i) => [t.id, repaired[i]!.sapPages]));
    return allTargets.map((t) => (byId.has(t.id) ? { ...t, sapPages: byId.get(t.id)! } : t));
  }
  const totalRepaired = repaired.reduce((s, r) => s + r.sapPages, 0);
  if (totalRepaired <= 0 || sapBearing.length === 0) return allTargets;
  const splits = splitIntegerTotalAcrossMemberSlots(
    totalRepaired,
    sapBearing.length,
    LOCAL_ANALYSIS_SAP_MIN,
    LOCAL_ANALYSIS_SAP_MAX,
  );
  const byId = new Map(sapBearing.map((t, i) => [t.id, splits[i]!]));
  return allTargets.map((t) => (byId.has(t.id) ? { ...t, sapPages: byId.get(t.id)! } : t));
}

/** Segment row counts from keyword targets only (no SAP rows required). */
export function sapSegmentRowCountsFromTargets(
  keywordTargets: EntityTitleClusterKeywordTarget[],
  maxSapBudget: number,
): number[] | null {
  const { targets, total } = normalizeForSegments(keywordTargets);
  if (targets.length === 0) return null;
  const sapBearing = sapBearingTargets(targets);
  if (sapBearing.length === 0) return null;
  const targetSapCount = Math.min(total, maxSapBudget);
  const repaired =
    total > maxSapBudget
      ? repairSapPageAllocation(
          sapBearing.map((t) => ({
            keyword: t.keyword,
            sapPages: t.sapPages,
            ...(t.entityHint ? { entityHint: t.entityHint } : {}),
            ...(t.clusterId ? { clusterId: t.clusterId } : {}),
            ...(t.clusterRole ? { clusterRole: t.clusterRole } : {}),
          })),
          targetSapCount,
          LOCAL_ANALYSIS_SAP_MIN,
          LOCAL_ANALYSIS_SAP_MAX,
        )
      : null;
  const apiTargets = repaired
    ? mergeRepairedSapBearingIntoTargets(targets, sapBearing, repaired)
    : targets;
  const generationTargets = keywordTargetsInGenerationOrder(apiTargets);
  return generationTargets.map((t) => t.sapPages);
}

function sapSegmentRowCounts(
  keywordTargets: EntityTitleClusterKeywordTarget[],
  sapRows: CSVRow[],
  maxSapBudget: number,
): number[] | null {
  if (sapRows.length === 0) return null;
  return sapSegmentRowCountsFromTargets(keywordTargets, maxSapBudget);
}

function buildClusterJobsFromSegmentCounts(
  keywordTargets: EntityTitleClusterKeywordTarget[],
  segmentCounts: number[],
  sapRows: CSVRow[],
): EntityTitleClusterJob[] {
  const jobs: EntityTitleClusterJob[] = [];
  for (const group of clusterGroups(keywordTargets)) {
    const seedRow =
      group.indices.map((i) => keywordTargets[i]!).find((r) => r.clusterRole !== "member") ??
      keywordTargets[group.indices[0]!];
    const seedKeyword = seedRow?.keyword.trim() ?? "";
    const rowIndices: number[] = [];
    for (const i of group.indices) {
      const ti = generationTargetIndex(keywordTargets, i);
      if (ti == null) continue;
      const count = segmentCounts[ti] ?? 0;
      for (let j = 0; j < count; j++) {
        rowIndices.push(globalSapIndex(segmentCounts, ti, j));
      }
    }
    const unique = [...new Set(rowIndices)].filter(
      (idx) => idx >= 0 && (sapRows.length === 0 || idx < sapRows.length),
    );
    if (unique.length === 0) continue;
    jobs.push({
      clusterKey: group.clusterKey,
      seedKeyword,
      rowIndices: unique,
    });
  }
  return jobs;
}

function globalSapIndex(segmentCounts: number[], ti: number, j: number): number {
  let o = 0;
  for (let k = 0; k < ti; k++) {
    o += segmentCounts[k] ?? 0;
  }
  return o + j;
}

/** Predict cluster jobs from targets before SAP rows exist (placeholder row indices). */
export function buildEntityTitleClusterJobsFromTargets(
  keywordTargets: EntityTitleClusterKeywordTarget[],
  maxSapBudget: number,
): EntityTitleClusterJob[] {
  const segmentCounts = sapSegmentRowCountsFromTargets(keywordTargets, maxSapBudget);
  if (!segmentCounts?.length) return [];
  return buildClusterJobsFromSegmentCounts(keywordTargets, segmentCounts, []);
}

/** One Gemini title call per seed cluster; rowIndices are global positions in sapRows. */
export function buildEntityTitleClusterJobs(
  keywordTargets: EntityTitleClusterKeywordTarget[],
  sapRows: CSVRow[],
  maxSapBudget: number,
): EntityTitleClusterJob[] {
  const segmentCounts = sapSegmentRowCounts(keywordTargets, sapRows, maxSapBudget);
  if (!segmentCounts?.length) return [];
  return buildClusterJobsFromSegmentCounts(keywordTargets, segmentCounts, sapRows);
}
