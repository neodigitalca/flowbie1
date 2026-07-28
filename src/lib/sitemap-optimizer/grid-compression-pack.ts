import {
  targetGridClusterCount,
  type GridCompressionLevel,
} from "@/lib/sitemap-optimizer/grid-compression-policy";
import type { GridMaxUrlsPerPost } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import { packGridLooseClusters } from "@/lib/sitemap-optimizer/grid-pack-loose-clusters";
import type {
  SitemapOptimizerClusterResult,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

/** Pack undersized 1-URL clusters when compression produced too many groups vs max URLs target. */
export function packGridClustersIfOverTarget(
  result: SitemapOptimizerClusterResult,
  rows: readonly SitemapOptimizerPostRow[],
  maxUrlsPerPost: GridMaxUrlsPerPost,
  compression: GridCompressionLevel,
): SitemapOptimizerClusterResult {
  if (compression === "none" || !rows.length) return result;
  const target = targetGridClusterCount(rows.length, maxUrlsPerPost);
  if (result.clusters.length <= target) return result;
  return packGridLooseClusters(result, rows, maxUrlsPerPost);
}
