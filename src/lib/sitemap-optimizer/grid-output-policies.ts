import { buildContentSheetRowsGrid } from "@/lib/sitemap-optimizer/build-content-sheet-rows-grid";
import { mergesForCoalescedClusters } from "@/lib/sitemap-optimizer/grid-coalesce-merges";
import type { GridMaxUrlsPerPost } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import { splitOversizedGridClusters } from "@/lib/sitemap-optimizer/grid-finalize-clusters";
import {
  applyCanonicalDestinationUrlsToRows,
  applyMergeLockedDestinationsToRows,
  coalesceGridClustersByCannibalizationFamily,
  coalesceGridClustersByDestination,
} from "@/lib/sitemap-optimizer/grid-prefilled-group-cluster";
import { resolvedMemberRows } from "@/lib/sitemap-optimizer/resolved-cluster-members";
import {
  getGridContentYear,
  refreshContentSheetRowTitles,
  refreshGridRowDestinationUrl,
  refreshMergeRecommendationTitles,
} from "@/lib/sitemap-optimizer/grid-title-year";
import { dedupeContentSheetRowsByDestination } from "@/lib/sitemap-optimizer/dedupe-content-sheet-by-destination";
import { isTemporalCannibalizationCluster } from "@/lib/sitemap-optimizer/grid-temporal-cannibalization";
import type {
  SitemapOptimizerClusterResult,
  SitemapOptimizerContentSheetRow,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

export function applyGridOutputPolicies(args: {
  rows: SitemapOptimizerPostRow[];
  clusters: SitemapOptimizerClusterResult;
  merges: SitemapOptimizerMergeRecommendation[];
  gridMaxUrlsPerPost: GridMaxUrlsPerPost;
  macroMode?: boolean;
  analyzedAt?: string;
}): {
  rows: SitemapOptimizerPostRow[];
  clusters: SitemapOptimizerClusterResult;
  merges: SitemapOptimizerMergeRecommendation[];
  contentSheet: SitemapOptimizerContentSheetRow[];
} {
  const year = getGridContentYear(args.analyzedAt);
  let rows = args.rows.map((row) => {
    const cluster = args.clusters.clusters.find((c) => c.memberPostIds.includes(row.postId));
    if (cluster && isTemporalCannibalizationCluster(cluster)) return row;
    return refreshGridRowDestinationUrl(row, year);
  });
  const rowMap = new Map(rows.map((r) => [r.postId, r]));

  const isRedirectMapMode =
    rows.length > 0 && rows.every((r) => Boolean(r.gridRedirectFromUrl?.trim()));
  const isRedirectMapPacked = isRedirectMapMode && args.gridMaxUrlsPerPost > 1;
  const priorClusters = args.clusters;
  let clusters = args.clusters;
  let merges = args.merges;
  if (isRedirectMapMode) {
    rows = applyMergeLockedDestinationsToRows(rows, priorClusters, merges);
    if (isRedirectMapPacked) {
      const afterSplit = splitOversizedGridClusters(priorClusters, args.gridMaxUrlsPerPost, rows, {
        splitSharedDestinations: true,
      });
      clusters = afterSplit;
      rows = applyMergeLockedDestinationsToRows(rows, afterSplit, merges);
    } else {
      // 1:1 Basic: keep Gemini temporal clusters; do not re-coalesce to CSV quarter destinations.
      clusters = priorClusters;
    }
  }

  const clusterById = new Map(clusters.clusters.map((c) => [c.clusterId, c]));

  merges = merges.map((merge) => {
    const cluster = clusterById.get(merge.clusterId);
    const members = cluster ? resolvedMemberRows(cluster, rowMap) : [];
    return refreshMergeRecommendationTitles(merge, members, year, cluster);
  });

  const contentSheet = dedupeContentSheetRowsByDestination(
    buildContentSheetRowsGrid({
      rows,
      clusters,
      merges,
      macroMode: args.macroMode ?? true,
      gridMaxUrlsPerPost: args.gridMaxUrlsPerPost,
    }).map((sheetRow) => {
      const cluster = sheetRow.mergeClusterId
        ? clusterById.get(sheetRow.mergeClusterId)
        : undefined;
      const members = cluster ? resolvedMemberRows(cluster, rowMap) : [];
      return refreshContentSheetRowTitles(sheetRow, members, year, cluster);
    }),
  );

  return { rows, merges, contentSheet, clusters };
}
