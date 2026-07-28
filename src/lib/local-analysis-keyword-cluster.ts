/**
 * Keyword-target clusters → UI rows (schema-shaped model output only).
 */
import { normalizeEntityHintCommaLabel } from "@/lib/comma-place-label";
import {
  LOCAL_ANALYSIS_DEFAULT_SAP_PAGES,
  LOCAL_ANALYSIS_SAP_MAX,
  LOCAL_ANALYSIS_SAP_MIN,
  LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET,
} from "@/lib/local-analysis-target-constants";

export type ClusterRole = "seed" | "member";

export type SapRoughClusterRow = {
  keyword: string;
  sapPages: number;
  entityHint?: string;
  clusterId: string;
  clusterRole: ClusterRole;
};

export type ModelCluster = {
  clusterId?: string;
  seedKeyword?: string;
  wikiEntityHint?: string;
  sapPagesSeed?: number;
  members?: { keyword?: string; sapPages?: number }[];
};

function newClusterId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Legacy flat targets: each row is its own cluster (seed only).
 */
export function legacyTargetsToRoughRows(
  targets: { keyword?: string; sapPages?: number; entityHint?: string }[],
): SapRoughClusterRow[] {
  return targets.map((x) => {
    const keyword = String(x.keyword ?? "").trim();
    const sapPages = Math.floor(Number(x.sapPages));
    const eh = x.entityHint;
    const entityHint =
      typeof eh === "string" && eh.trim().length > 0 ? normalizeEntityHintCommaLabel(eh) : undefined;
    return {
      keyword,
      sapPages,
      ...(entityHint ? { entityHint } : {}),
      clusterId: newClusterId(),
      clusterRole: "seed" as const,
    };
  });
}

/**
 * Split integer `total` across `n` slots, each in [min, max], sum exactly `total`.
 * Used for distributing `sapPagesSeed` across member rows. If impossible in range, best-effort then repair fixes totals.
 */
export function splitIntegerTotalAcrossMemberSlots(total: number, n: number, min: number, max: number): number[] {
  if (n <= 0) return [];
  const pages = Array.from({ length: n }, () => min);
  let rem = total - n * min;
  if (rem < 0) {
    let deficit = -rem;
    let i = 0;
    while (deficit > 0 && i < n * max) {
      const idx = i % n;
      if (pages[idx]! > min) {
        pages[idx]!--;
        deficit--;
      }
      i++;
    }
    return pages;
  }
  let i = 0;
  while (rem > 0 && i < n * (max - min + 20)) {
    const idx = i % n;
    if (pages[idx]! < max) {
      pages[idx]!++;
      rem--;
    }
    i++;
  }
  return pages;
}

/**
 * Clusters step output: one seed row per cluster. Member keywords are created at Generate, not Clusters.
 * Rolls member SAP budgets onto the seed when the model returned members early.
 */
export function collapseRoughToSeedGroupsOnly(rough: SapRoughClusterRow[]): SapRoughClusterRow[] {
  const groups = groupRoughClustersInOrder(rough);
  const out: SapRoughClusterRow[] = [];
  for (const g of groups) {
    let budget = Math.floor(g.seed.sapPages) || 0;
    if (g.members.length > 0) {
      budget = g.members.reduce((s, m) => s + (Math.floor(m.sapPages) || 0), budget);
    }
    if (budget < 1) continue;
    const eh = g.seed.entityHint;
    out.push({
      keyword: g.seed.keyword,
      sapPages: budget,
      ...(eh ? { entityHint: eh } : {}),
      clusterId: g.seed.clusterId,
      clusterRole: "seed",
    });
  }
  return out;
}

/** Preserve row order: seed then its members (used by suggest repair and tests). */
export function groupRoughClustersInOrder(
  rough: SapRoughClusterRow[]
): { seed: SapRoughClusterRow; members: SapRoughClusterRow[] }[] {
  const groups: { seed: SapRoughClusterRow; members: SapRoughClusterRow[] }[] = [];
  for (const r of rough) {
    if (r.clusterRole === "seed") {
      groups.push({ seed: r, members: [] });
    } else if (groups.length > 0) {
      groups[groups.length - 1]!.members.push(r);
    }
  }
  return groups;
}

/** Sum SAP: member rows in clusters with members; seed sapPages only for seed-only clusters. */
export function sumSapPagesForRoughRows(rough: SapRoughClusterRow[]): number {
  const groups = groupRoughClustersInOrder(rough);
  let s = 0;
  for (const g of groups) {
    if (g.members.length > 0) {
      for (const m of g.members) s += Math.floor(m.sapPages) || 0;
    } else {
      s += Math.floor(g.seed.sapPages) || 0;
    }
  }
  return s;
}

/**
 * Flatten model clusters: seed first (SAP 0 when members exist), then members with positive `sapPages`.
 * `sapPagesSeed` is total SAP for **member** lines only (seed is grouping / entity anchor, not counted).
 * Seed-only clusters (no members): seed carries `sapPagesSeed` as legacy single-row cluster.
 */
export function flattenClustersToRoughRows(clusters: ModelCluster[]): SapRoughClusterRow[] {
  const out: SapRoughClusterRow[] = [];
  for (const c of clusters) {
    const cid = (typeof c.clusterId === "string" && c.clusterId.trim().length > 0 ? c.clusterId.trim() : null) ?? newClusterId();
    const seedKw = String(c.seedKeyword ?? "").trim();
    const seedBudget = Math.floor(Number(c.sapPagesSeed));
    const wiki = normalizeEntityHintCommaLabel(String(c.wikiEntityHint ?? ""));
    if (!seedKw || !Number.isFinite(seedBudget) || seedBudget < 1) continue;

    const members = Array.isArray(c.members) ? c.members : [];
    const memberObjs = members
      .map((m) => ({
        keyword: String(m?.keyword ?? "").trim(),
        sapPages: Math.floor(Number(m?.sapPages)),
      }))
      .filter((m) => m.keyword.length > 0);

    if (memberObjs.length === 0) {
      out.push({
        keyword: seedKw,
        sapPages: seedBudget,
        ...(wiki.length > 0 ? { entityHint: wiki } : {}),
        clusterId: cid,
        clusterRole: "seed",
      });
      continue;
    }

    out.push({
      keyword: seedKw,
      sapPages: 0,
      ...(wiki.length > 0 ? { entityHint: wiki } : {}),
      clusterId: cid,
      clusterRole: "seed",
    });

    const n = memberObjs.length;
    let perMember: number[];
    const allHaveValid =
      memberObjs.every((m) => Number.isFinite(m.sapPages) && m.sapPages >= LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET) &&
      memberObjs.reduce((s, m) => s + m.sapPages, 0) === seedBudget;
    if (allHaveValid) {
      perMember = memberObjs.map((m) =>
        Math.min(LOCAL_ANALYSIS_SAP_MAX, Math.max(LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET, m.sapPages)),
      );
    } else {
      perMember = splitIntegerTotalAcrossMemberSlots(
        seedBudget,
        n,
        LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET,
        LOCAL_ANALYSIS_SAP_MAX,
      );
    }

    for (let i = 0; i < n; i++) {
      out.push({
        keyword: memberObjs[i]!.keyword,
        sapPages: perMember[i]!,
        clusterId: cid,
        clusterRole: "member",
      });
    }
  }
  return out;
}

/** When the model reuses one clusterId for multiple seed groups, assign a fresh id per seed group. */
export function ensureUniqueClusterIdPerSeedGroup(rough: SapRoughClusterRow[]): SapRoughClusterRow[] {
  const groups = groupRoughClustersInOrder(rough);
  const seedCountByClusterId = new Map<string, number>();
  for (const g of groups) {
    const cid = g.seed.clusterId;
    seedCountByClusterId.set(cid, (seedCountByClusterId.get(cid) ?? 0) + 1);
  }
  const hasDuplicateSeedClusterIds = [...seedCountByClusterId.values()].some((n) => n > 1);
  if (!hasDuplicateSeedClusterIds) return rough;

  const out: SapRoughClusterRow[] = [];
  for (const g of groups) {
    const cid =
      (seedCountByClusterId.get(g.seed.clusterId) ?? 0) > 1 ? newClusterId() : g.seed.clusterId;
    out.push({ ...g.seed, clusterId: cid });
    for (const m of g.members) {
      out.push({ ...m, clusterId: cid });
    }
  }
  return out;
}

/** Same cluster grouping as rough rows: seed then following members (UI / migration). */
export function groupKeywordTargetRowsInOrder<T extends KeywordTargetRowLike>(rows: T[]): { seed: T; members: T[] }[] {
  const groups: { seed: T; members: T[] }[] = [];
  for (const r of rows) {
    if (r.clusterRole !== "member") {
      groups.push({ seed: r, members: [] });
    } else if (groups.length > 0) {
      groups[groups.length - 1]!.members.push(r);
    }
  }
  return groups;
}

/**
 * Members missing `clusterId` break UI grouping (each row falls back to its own id). Copy seed `clusterId` when empty.
 */
export function ensureMemberClusterIdsFromSeed<T extends KeywordTargetRowLike>(rows: T[]): T[] {
  const groups = groupKeywordTargetRowsInOrder(rows);
  const byId = new Map(rows.map((r, i) => [r.id, i] as const));
  const next = [...rows];
  let changed = false;
  for (const g of groups) {
    const sid = (g.seed.clusterId ?? "").trim();
    if (!sid) continue;
    for (const m of g.members) {
      const mi = byId.get(m.id);
      if (mi === undefined) continue;
      if (!(next[mi]!.clusterId ?? "").trim()) {
        next[mi] = { ...next[mi]!, clusterId: sid };
        changed = true;
      }
    }
  }
  return changed ? next : rows;
}

/**
 * Legacy sessions: seed held cluster SAP while members had 0. Move budget to members and clear seed.
 */
export function migrateClusterSapToMembers<T extends KeywordTargetRowLike>(rows: T[]): T[] {
  const withIds = ensureMemberClusterIdsFromSeed(rows);
  const groups = groupKeywordTargetRowsInOrder(withIds);
  const next = [...withIds];
  const byId = new Map(next.map((r, i) => [r.id, i] as const));
  for (const g of groups) {
    if (g.members.length === 0) continue;
    const seedBudget = Math.floor(g.seed.sapPages);
    if (seedBudget <= 0) continue;
    if (!g.members.every((m) => (Math.floor(m.sapPages) || 0) === 0)) continue;
    const splits = splitIntegerTotalAcrossMemberSlots(seedBudget, g.members.length, LOCAL_ANALYSIS_SAP_MIN, LOCAL_ANALYSIS_SAP_MAX);
    const si = byId.get(g.seed.id);
    if (si !== undefined) next[si] = { ...next[si]!, sapPages: 0 };
    for (let j = 0; j < g.members.length; j++) {
      const mi = byId.get(g.members[j]!.id);
      if (mi !== undefined) next[mi] = { ...next[mi]!, sapPages: splits[j]! };
    }
  }
  return next;
}

/** Order used by Local analysis Generate: members when present, else lone seed. */
export function keywordTargetsInGenerationOrder<T extends KeywordTargetRowLike>(rows: T[]): T[] {
  const migrated = migrateClusterSapToMembers(rows);
  const groups = groupKeywordTargetRowsInOrder(migrated);
  const out: T[] = [];
  for (const g of groups) {
    if (g.members.length > 0) {
      for (const m of g.members) {
        if (m.keyword.trim() && (Math.floor(m.sapPages) || 0) > 0) out.push(m);
      }
    } else if (g.seed.keyword.trim() && (Math.floor(g.seed.sapPages) || 0) > 0) {
      out.push(g.seed);
    }
  }
  return out;
}

/**
 * Stripe distinct **`orderedPoolTitles`** onto rows that contribute SAP counts (members with sapPages > 0;
 * lone seed clusters: the seed row), so geography varies across keyword targets vs repeating one anchor.
 */
export function stripeEntityHintsFromOrderedPool(
  rough: SapRoughClusterRow[],
  orderedPoolTitles: string[],
): SapRoughClusterRow[] {
  const pool = orderedPoolTitles
    .map((t) => normalizeEntityHintCommaLabel(t.trim()))
    .filter((t) => t.length > 0);
  if (pool.length === 0) return rough;

  const usedLower = new Set<string>();
  let rr = 0;
  const takeNext = (): string | undefined => {
    const unused = pool.find((t) => !usedLower.has(t.toLowerCase()));
    if (unused) {
      usedLower.add(unused.toLowerCase());
      return unused;
    }
    const t = pool[rr % pool.length]!;
    rr++;
    return t;
  };

  const rows = rough.map((r) => ({ ...r }));
  const groups = groupRoughClustersInOrder(rows);
  for (const g of groups) {
    if (g.members.length > 0) {
      for (const m of g.members) {
        if ((Math.floor(m.sapPages) || 0) < 1) continue;
        const h = takeNext();
        if (!h) continue;
        m.entityHint = h;
      }
    } else if ((Math.floor(g.seed.sapPages) || 0) > 0) {
      const h = takeNext();
      if (h) g.seed.entityHint = h;
    }
  }
  return rows;
}

/** Copy seed `entityHint` to members that still lack a hint (after optional pool striping). */
export function propagateSeedEntityHintsToMembers(rows: SapRoughClusterRow[]): SapRoughClusterRow[] {
  const seedHintByCluster = new Map<string, string>();
  for (const r of rows) {
    if (r.clusterRole === "seed") {
      const h = normalizeEntityHintCommaLabel(r.entityHint ?? "");
      if (h) seedHintByCluster.set(r.clusterId, h);
    }
  }
  return rows.map((r) => {
    if (r.clusterRole !== "member") return r;
    const memberOwn = normalizeEntityHintCommaLabel(r.entityHint ?? "");
    if (memberOwn.length > 0) return r;
    const h = seedHintByCluster.get(r.clusterId);
    return h ? { ...r, entityHint: h } : r;
  });
}

export function distinctKeywordCountRows(rows: { keyword: string }[]): number {
  const s = new Set(rows.map((r) => r.keyword.trim().toLowerCase()).filter(Boolean));
  return s.size;
}

/** Distinct entity hints counting only seed rows (clusters can share entity across members). */
export function distinctEntityHintCountSeeds(rows: SapRoughClusterRow[]): number {
  const s = new Set(
    rows
      .filter((r) => r.clusterRole === "seed")
      .map((r) => (r.entityHint ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  return s.size;
}

/** Members may carry their own `entityHint`; when unset, UI/strategy inherits the seed (cluster anchor). */
export type KeywordTargetRowLike = {
  id: string;
  keyword: string;
  entityHint: string;
  sapPages: number;
  clusterId?: string;
  clusterRole?: ClusterRole;
};

export function inheritKeywordTargetEntityHints(rows: KeywordTargetRowLike[]): KeywordTargetRowLike[] {
  const seedHint = new Map<string, string>();
  for (const r of rows) {
    if (r.clusterRole !== "member") {
      const h = normalizeEntityHintCommaLabel(r.entityHint ?? "");
      if (h) seedHint.set(r.clusterId ?? r.id, h);
    }
  }
  return rows.map((r) => {
    if (r.clusterRole !== "member") {
      return { ...r, entityHint: normalizeEntityHintCommaLabel(r.entityHint ?? "") };
    }
    const memberOwn = normalizeEntityHintCommaLabel(r.entityHint ?? "");
    if (memberOwn.length > 0) return { ...r, entityHint: memberOwn };
    const cid = r.clusterId?.trim();
    if (!cid) return { ...r, entityHint: normalizeEntityHintCommaLabel(r.entityHint ?? "") };
    const h = seedHint.get(cid);
    return h
      ? { ...r, entityHint: h }
      : { ...r, entityHint: normalizeEntityHintCommaLabel(r.entityHint ?? "") };
  });
}

/** Resolve Wikipedia anchor row id for a target row (seed id for the cluster). */
export function seedRowIdForKeywordTarget(row: KeywordTargetRowLike, all: KeywordTargetRowLike[]): string {
  const cid = row.clusterId ?? row.id;
  const seed = all.find((r) => (r.clusterId ?? r.id) === cid && r.clusterRole !== "member");
  return seed?.id ?? row.id;
}

/** Entity hint for UI: members prefer their own pooled `entityHint` when set; otherwise show the seed row's hint. Raw values allow spaces while editing. */
export function resolveClusterSeedEntityHint<T extends KeywordTargetRowLike>(rows: T[], row: T): string {
  if (row.clusterRole !== "member") return row.entityHint ?? "";
  const memberOwn = (row.entityHint ?? "").trim();
  if (memberOwn.length > 0) return memberOwn;
  const groups = groupKeywordTargetRowsInOrder(rows);
  for (const g of groups) {
    if (g.members.some((m) => m.id === row.id)) return g.seed.entityHint ?? "";
  }
  const sid = seedRowIdForKeywordTarget(row, rows);
  const seed = rows.find((r) => r.id === sid);
  if (seed && seed.clusterRole !== "member") return seed.entityHint ?? "";
  return "";
}

/**
 * Flat list for `fetchLocalSeoStrategyFromGrid`: members inherit seed `entityHint` when their hint is empty; otherwise strips use their pooled hint.
 */
export function expandKeywordTargetsForApi(rows: KeywordTargetRowLike[]): { keyword: string; sapPages: number; entityHint?: string }[] {
  const expanded = inheritKeywordTargetEntityHints(rows);
  const clusterIdsWithMembers = new Set<string>();
  for (const r of expanded) {
    if (r.clusterRole === "member" && r.clusterId?.trim()) clusterIdsWithMembers.add(r.clusterId.trim());
  }
  return expanded
    .map((r) => {
      const keyword = r.keyword.trim();
      const cid = r.clusterId?.trim();
      const isMember = r.clusterRole === "member";
      const isLoneSeed = !isMember && (!cid || !clusterIdsWithMembers.has(cid));
      const sapPages = isMember
        ? Math.min(
            LOCAL_ANALYSIS_SAP_MAX,
            Math.max(LOCAL_ANALYSIS_SAP_MIN, Math.floor(r.sapPages) || 0),
          )
        : isLoneSeed
          ? Math.min(
              LOCAL_ANALYSIS_SAP_MAX,
              Math.max(LOCAL_ANALYSIS_SAP_MIN, Math.floor(r.sapPages) || LOCAL_ANALYSIS_DEFAULT_SAP_PAGES),
            )
          : 0;
      const hint = normalizeEntityHintCommaLabel(r.entityHint ?? "");
      return {
        keyword,
        sapPages,
        ...(hint.length > 0 ? { entityHint: hint } : {}),
      };
    })
    .filter((r) => r.keyword.length > 0 && r.sapPages > 0);
}
