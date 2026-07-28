import type {
  SitemapOptimizerClusterResult,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

export function isWeakConsolidateCandidate(
  row: SitemapOptimizerPostRow,
  p25Clicks: number,
  p25Impressions: number,
): boolean {
  if (row.gscDisposition === "consolidate") return true;
  const clicks = row.gscPageClicks ?? 0;
  const impressions = row.gscPageImpressions ?? 0;
  return clicks <= p25Clicks || impressions <= p25Impressions;
}

export function collectRewriteSingletonIds(
  clusters: SitemapOptimizerClusterResult,
  rowMap: Map<string, SitemapOptimizerPostRow>,
  p25Clicks: number,
  p25Impressions: number,
): string[] {
  return clusters.singletons.filter((postId) => {
    const row = rowMap.get(postId);
    if (!row) return false;
    return isWeakConsolidateCandidate(row, p25Clicks, p25Impressions);
  });
}
