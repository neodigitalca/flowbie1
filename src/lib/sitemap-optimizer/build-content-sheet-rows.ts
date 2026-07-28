import type { BlogDestinationPolicy } from "@/lib/sitemap-optimizer/blog-destination-policy";
import {
  resolveContentSheetDestinationUrl,
  resolveContentSheetLegacySourceUrlForRow,
} from "@/lib/sitemap-optimizer/content-sheet-source-url";
import { buildDeterministicStandaloneProposal } from "@/lib/sitemap-optimizer/deterministic-standalone-proposal";
import {
  dedupeContentSheetRowsByDestination,
  dedupeContentSheetRowsByIntent,
} from "@/lib/sitemap-optimizer/dedupe-content-sheet-by-destination";
import { buildMergeContentModifier } from "@/lib/sitemap-optimizer/merge-content-brief";
import { displayPostTitle } from "@/lib/sitemap-optimizer/merge-results-display";
import { buildMergePublishContract } from "@/lib/sitemap-optimizer/sitemap-merge-publish-contract";
import { resolveCatalogPostId } from "@/lib/sitemap-optimizer/resolve-catalog-post-id";
import {
  filterMergeableMerges,
  resolvedMemberRows,
} from "@/lib/sitemap-optimizer/resolved-cluster-members";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerContentSheetRow,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
  SitemapOptimizerStandaloneProposal,
} from "@/lib/sitemap-optimizer/types";
import { isImmatureKeepRationale } from "@/lib/sitemap-optimizer/content-maturity-gate";

function mergeByClusterId(
  merges: SitemapOptimizerMergeRecommendation[],
): Map<string, SitemapOptimizerMergeRecommendation> {
  return new Map(merges.map((m) => [m.clusterId, m]));
}

function representativeMember(members: readonly SitemapOptimizerPostRow[]): SitemapOptimizerPostRow {
  return [...members].sort(
    (a, b) =>
      (a.uploadRowIndex ?? Number.MAX_SAFE_INTEGER) - (b.uploadRowIndex ?? Number.MAX_SAFE_INTEGER),
  )[0]!;
}

function aggregateGscMetric(
  members: readonly SitemapOptimizerPostRow[],
  pick: (row: SitemapOptimizerPostRow) => number | undefined,
): number | undefined {
  let sum = 0;
  let any = false;
  for (const m of members) {
    const v = pick(m);
    if (v != null && Number.isFinite(v)) {
      sum += v;
      any = true;
    }
  }
  return any ? sum : undefined;
}

export function buildContentSheetRows(args: {
  rows: SitemapOptimizerPostRow[];
  clusters: SitemapOptimizerClusterResult;
  merges: SitemapOptimizerMergeRecommendation[];
  standaloneProposals?: SitemapOptimizerStandaloneProposal[];
  blogDestination?: BlogDestinationPolicy | null;
  /** When 1, emit one content row per redirect-map family (including single-URL destinations). */
  minClusterMembers?: number;
  /** Service-area SAP runs: use AI sapModifier on merges, not template merge briefs. */
  entityMode?: boolean;
}): SitemapOptimizerContentSheetRow[] {
  const { rows, clusters, merges, blogDestination, entityMode = false } = args;
  const minClusterMembers = args.minClusterMembers ?? 2;
  const rowMap = new Map(rows.map((r) => [r.postId, r]));
  const mergeableMerges = filterMergeableMerges(merges, clusters.clusters, rows, minClusterMembers);
  const mergeByCluster = mergeByClusterId(mergeableMerges);
  const catalogPostIds = rows.map((r) => r.postId);
  const proposalByPostId = new Map<string, SitemapOptimizerStandaloneProposal>();
  for (const p of args.standaloneProposals ?? []) {
    const resolvedId = resolveCatalogPostId(p.postId, catalogPostIds);
    if (!resolvedId) continue;
    proposalByPostId.set(resolvedId, { ...p, postId: resolvedId });
  }

  const contracts = mergeableMerges.flatMap((merge) => {
    const cluster = clusters.clusters.find((c) => c.clusterId === merge.clusterId);
    if (!cluster) return [];
    const members = resolvedMemberRows(cluster, rowMap);
    const contract = buildMergePublishContract(merge, members, "", {
      minMembers: minClusterMembers,
      blogDestination,
    });
    return contract ? [contract] : [];
  });
  const contractByCluster = new Map(contracts.map((c) => [c.clusterId, c]));

  const sheet: SitemapOptimizerContentSheetRow[] = [];

  for (const cluster of clusters.clusters) {
    const members = resolvedMemberRows(cluster, rowMap);
    if (members.length < minClusterMembers) continue;
    const merge = mergeByCluster.get(cluster.clusterId);
    if (!merge) continue;

    const rep = representativeMember(members);
    const contract = contractByCluster.get(cluster.clusterId);
    const destinationUrl = resolveContentSheetDestinationUrl({
      row: rep,
      merge,
      contract,
      blogDestination,
    });

    sheet.push({
      postId: rep.postId,
      sourceUrl: destinationUrl,
      legacySourceUrl: resolveContentSheetLegacySourceUrlForRow(rep, destinationUrl),
      sourceTitle: "",
      action: "merge",
      priority: merge.priority,
      proposedTitle: displayPostTitle(merge.recommendedTitle || "New post"),
      proposedPrimaryKeyword: merge.recommendedPrimaryKeyword.trim(),
      proposedMeta: merge.recommendedMeta.trim(),
      mergeClusterId: cluster.clusterId,
      mergeGroupLabel: cluster.label,
      rationale: merge.rationale,
      gscClicks: aggregateGscMetric(members, (m) => m.gscPageClicks),
      gscImpressions: aggregateGscMetric(members, (m) => m.gscPageImpressions),
      combinedOutline: merge.combinedOutline,
      modifier: entityMode
        ? merge.sapModifier?.trim() ?? ""
        : buildMergeContentModifier(merge),
      bulkEntityLabel: entityMode ? merge.sapEntity?.trim() : undefined,
      whatToKeepFromEach: merge.whatToKeepFromEach,
      mergeSourceCount: members.length,
      proposedDestinationUrl: destinationUrl,
      uploadRowIndex: rep.uploadRowIndex,
      isSingletonCluster: false,
    });
  }

  for (const postId of clusters.singletons) {
    const row = rowMap.get(postId);
    if (!row) continue;
    const proposal =
      proposalByPostId.get(postId) ?? buildDeterministicStandaloneProposal(row);
    const destinationUrl = resolveContentSheetDestinationUrl({
      row,
      blogDestination,
      standaloneKeyword: proposal.proposedPrimaryKeyword,
      standaloneTitle: proposal.proposedTitle,
    });

    sheet.push({
      postId: row.postId,
      sourceUrl: destinationUrl,
      legacySourceUrl: resolveContentSheetLegacySourceUrlForRow(row, destinationUrl),
      sourceTitle: "",
      action: "refresh",
      priority: proposal.priority,
      proposedTitle: displayPostTitle(proposal.proposedTitle),
      proposedPrimaryKeyword: proposal.proposedPrimaryKeyword.trim(),
      proposedMeta: proposal.proposedMeta.trim(),
      rationale: proposal.rationale,
      gscClicks: row.gscPageClicks,
      gscImpressions: row.gscPageImpressions,
      proposedDestinationUrl: destinationUrl,
      uploadRowIndex: row.uploadRowIndex,
      isSingletonCluster: true,
    });
  }

  if (entityMode) {
    return dedupeContentSheetRowsByIntent(sheet);
  }
  return dedupeContentSheetRowsByDestination(sheet);
}

function postIdToMergeCluster(
  clusterList: SitemapOptimizerCluster[],
  mergeList: SitemapOptimizerMergeRecommendation[],
  rowMap: Map<string, SitemapOptimizerPostRow>,
): Map<string, { clusterId: string }> {
  const mergeMap = mergeByClusterId(mergeList);
  const out = new Map<string, { clusterId: string }>();
  for (const cluster of clusterList) {
    const merge = mergeMap.get(cluster.clusterId);
    if (!merge) continue;
    if (resolvedMemberRows(cluster, rowMap).length < 2) continue;
    for (const id of cluster.memberPostIds) {
      out.set(id, { clusterId: cluster.clusterId });
    }
  }
  return out;
}

export function standalonePostIdsFromClusters(
  clusters: SitemapOptimizerClusterResult,
  merges: SitemapOptimizerMergeRecommendation[],
  rows: SitemapOptimizerPostRow[],
): string[] {
  const rowMap = new Map(rows.map((r) => [r.postId, r]));
  const inMerge = postIdToMergeCluster(clusters.clusters, merges, rowMap);
  const assigned = new Set<string>();
  for (const c of clusters.clusters) {
    for (const id of c.memberPostIds) assigned.add(id);
  }
  for (const id of clusters.singletons) assigned.add(id);
  return rows.map((r) => r.postId).filter((id) => !inMerge.has(id));
}

/** Rows that need a new replacement post (merge or grid new_blog). */
export function isReplacementContentSheetRow(row: SitemapOptimizerContentSheetRow): boolean {
  return row.action === "merge" || row.action === "new_blog";
}

export function replacementContentSheetRows(
  sheet: readonly SitemapOptimizerContentSheetRow[],
): SitemapOptimizerContentSheetRow[] {
  return sheet.filter(isReplacementContentSheetRow);
}

/** Plain-language summary for the results toolbar (replacements + redirects only). */
export function replacementPlanSummaryLine(args: {
  inventoryCount: number;
  merges: readonly SitemapOptimizerMergeRecommendation[];
  contentSheet: readonly SitemapOptimizerContentSheetRow[];
  entityPrimary?: boolean;
}): string {
  const { inventoryCount, merges, contentSheet, entityPrimary } = args;
  const noun = entityPrimary ? "service areas" : "URLs";
  const replacements = replacementContentSheetRows(contentSheet);
  const mergeClusterIds = new Set(
    replacements.map((r) => r.mergeClusterId).filter((id): id is string => Boolean(id)),
  );
  const newPostCount = mergeClusterIds.size || merges.length;
  const redirectingUrls = replacements
    .filter((r) => r.action === "merge")
    .reduce((n, r) => n + (r.mergeSourceCount ?? 1), 0);

  if (newPostCount === 0) {
    return `${inventoryCount} ${noun} scanned · no replacements needed`;
  }

  const postLabel = newPostCount === 1 ? "new replacement post" : "new replacement posts";
  const redirectLabel =
    redirectingUrls === 1 ? "1 redirect" : `${redirectingUrls} redirects`;
  return `${inventoryCount} ${noun} scanned · ${newPostCount} ${postLabel} · ${redirectLabel}`;
}

export type ReplacementPlanBreakdown = {
  inventoryCount: number;
  immatureKeepCount: number;
  performingKeepCount: number;
  mustCompressCount: number;
  replacementCount: number;
  redirectCount: number;
};

export function replacementPlanBreakdown(args: {
  rows: readonly SitemapOptimizerPostRow[];
  contentSheet: readonly SitemapOptimizerContentSheetRow[];
  merges: readonly SitemapOptimizerMergeRecommendation[];
}): ReplacementPlanBreakdown {
  const { rows, contentSheet, merges } = args;
  let immatureKeepCount = 0;
  let performingKeepCount = 0;
  let mustCompressCount = 0;
  for (const row of rows) {
    if (row.gscDisposition === "consolidate") {
      mustCompressCount += 1;
      continue;
    }
    if (row.gscDisposition !== "keep") continue;
    if (isImmatureKeepRationale(row.gscTriageRationale)) immatureKeepCount += 1;
    else performingKeepCount += 1;
  }
  const replacements = replacementContentSheetRows(contentSheet);
  const mergeClusterIds = new Set(
    replacements.map((r) => r.mergeClusterId).filter((id): id is string => Boolean(id)),
  );
  const replacementCount = mergeClusterIds.size || merges.length;
  const redirectCount = replacements
    .filter((r) => r.action === "merge")
    .reduce((n, r) => n + (r.mergeSourceCount ?? 1), 0);
  return {
    inventoryCount: rows.length,
    immatureKeepCount,
    performingKeepCount,
    mustCompressCount,
    replacementCount,
    redirectCount,
  };
}

export function replacementPlanBreakdownLine(breakdown: ReplacementPlanBreakdown): string {
  const parts: string[] = [];
  if (breakdown.immatureKeepCount > 0) {
    parts.push(`${breakdown.immatureKeepCount} kept (immature)`);
  }
  if (breakdown.performingKeepCount > 0) {
    parts.push(`${breakdown.performingKeepCount} kept (performing)`);
  }
  if (breakdown.mustCompressCount > 0) {
    parts.push(`${breakdown.mustCompressCount} to compress`);
  }
  if (breakdown.replacementCount > 0) {
    parts.push(`${breakdown.replacementCount} replacements proposed`);
  }
  return parts.join(" · ");
}

export function contentSheetSummaryCounts(sheet: SitemapOptimizerContentSheetRow[]): {
  mergeRows: number;
  refreshRows: number;
  keepRows: number;
  mergeGroups: number;
  urlsConsolidating: number;
} {
  const mergeClusterIds = new Set<string>();
  let urlsConsolidating = 0;
  let mergeRows = 0;
  let refreshRows = 0;
  let keepRows = 0;
  for (const row of sheet) {
    if (row.action === "merge") {
      mergeRows += 1;
      urlsConsolidating += row.mergeSourceCount ?? 1;
      if (row.mergeClusterId) mergeClusterIds.add(row.mergeClusterId);
    } else if (row.action === "refresh") {
      refreshRows += 1;
    } else {
      keepRows += 1;
    }
  }
  return {
    mergeRows,
    refreshRows,
    keepRows,
    mergeGroups: mergeClusterIds.size,
    urlsConsolidating,
  };
}
