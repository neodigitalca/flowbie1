import { isCompanyNewsRow } from "@/lib/sitemap-optimizer/grid-company-news";
import { isTemporalCannibalizationCluster } from "@/lib/sitemap-optimizer/grid-temporal-cannibalization";
import {
  getGridContentYear,
  refreshContentSheetRowTitles,
  refreshGridRowDestinationUrl,
  refreshMergeRecommendationTitles,
  refreshYearsInText,
  refreshYearsInUrl,
  shouldRefreshYearsForCluster,
} from "@/lib/sitemap-optimizer/grid-title-year";
import { displayPostTitle } from "@/lib/sitemap-optimizer/merge-results-display";
import { resolvedMemberRows } from "@/lib/sitemap-optimizer/resolved-cluster-members";
import type {
  SitemapOptimizerClusterResult,
  SitemapOptimizerContentSheetRow,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

/** Editorial destination URL with slug years rolled forward (e.g. canada-2023-budget → canada-2026-budget). */
export function editorialDestinationWithContentYear(
  url: string,
  year: number,
  row?: SitemapOptimizerPostRow,
): string {
  if (row && isCompanyNewsRow(row)) return url.trim();
  return refreshYearsInUrl(url.trim(), year);
}

export function refreshContentSheetRowYears(
  row: SitemapOptimizerContentSheetRow,
  year: number,
): SitemapOptimizerContentSheetRow {
  if (row.action === "keep") return row;
  const keyword = refreshYearsInText(row.proposedPrimaryKeyword.trim(), year);
  return {
    ...row,
    sourceUrl: refreshYearsInUrl(row.sourceUrl, year),
    proposedDestinationUrl: row.proposedDestinationUrl
      ? refreshYearsInUrl(row.proposedDestinationUrl, year)
      : undefined,
    sourceTitle: refreshYearsInText(displayPostTitle(row.sourceTitle), year),
    proposedTitle: refreshYearsInText(displayPostTitle(row.proposedTitle), year),
    proposedPrimaryKeyword: keyword,
    proposedMeta: refreshYearsInText(row.proposedMeta.trim(), year),
  };
}

/** Roll forward years in editorial rows, merges, and content sheet (redirect + compression paths). */
export function applyContentYearPolicy(args: {
  rows: readonly SitemapOptimizerPostRow[];
  merges: readonly SitemapOptimizerMergeRecommendation[];
  contentSheet: readonly SitemapOptimizerContentSheetRow[];
  clusters: SitemapOptimizerClusterResult;
  analyzedAt?: string;
}): {
  rows: SitemapOptimizerPostRow[];
  merges: SitemapOptimizerMergeRecommendation[];
  contentSheet: SitemapOptimizerContentSheetRow[];
} {
  const year = getGridContentYear(args.analyzedAt);
  const clusterById = new Map(args.clusters.clusters.map((c) => [c.clusterId, c]));

  const rows = args.rows.map((r) => {
    const cluster = args.clusters.clusters.find((c) => c.memberPostIds.includes(r.postId));
    if (cluster && isTemporalCannibalizationCluster(cluster)) return r;
    return refreshGridRowDestinationUrl(r, year);
  });
  const rowMap = new Map(rows.map((r) => [r.postId, r]));

  const merges = args.merges.map((m) => {
    const cluster = clusterById.get(m.clusterId);
    const members = cluster ? resolvedMemberRows(cluster, rowMap) : [];
    return refreshMergeRecommendationTitles(m, members, year, cluster);
  });

  const contentSheet = args.contentSheet.map((row) => {
    if (row.action === "keep") return row;
    const cluster = row.mergeClusterId ? clusterById.get(row.mergeClusterId) : undefined;
    const members = cluster ? resolvedMemberRows(cluster, rowMap) : [];
    if (cluster && isTemporalCannibalizationCluster(cluster)) return row;
    if (members.length && shouldRefreshYearsForCluster(members, cluster)) {
      return refreshContentSheetRowTitles(row, members, year, cluster);
    }
    return refreshContentSheetRowYears(row, year);
  });

  return { rows, merges, contentSheet };
}
