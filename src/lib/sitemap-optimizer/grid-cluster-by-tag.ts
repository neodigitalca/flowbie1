import { repackGridClustersByTopicTag } from "@/lib/sitemap-optimizer/grid-repack-clusters-by-topic";
import { splitOversizedGridClusters } from "@/lib/sitemap-optimizer/grid-finalize-clusters";
import type { GridMaxUrlsPerPost } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import { ensureAllPostIdsInClusterResult } from "@/lib/sitemap-optimizer/ensure-cluster-catalog-coverage";
import type {
  SitemapOptimizerClusterResult,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

export type GridClusterByTagProgress = {
  tagBucketsCompleted: number;
  tagBucketsTotal: number;
  urlsProcessed: number;
  clustersCreated: number;
};

/**
 * Cluster only within matching topic tags: deterministic packs of up to maxUrlsPerPost.
 */
export async function runGridClusterByTag(
  rows: SitemapOptimizerPostRow[],
  maxUrlsPerPost: GridMaxUrlsPerPost,
  _apiKey: string,
  signal?: AbortSignal,
  onProgress?: (p: GridClusterByTagProgress) => void,
): Promise<SitemapOptimizerClusterResult> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const allPostIds = rows.map((r) => r.postId);
  const topicSet = new Set(
    rows.map((r) => (r.gridTopicTag ?? "untagged").trim().toLowerCase() || "untagged"),
  );

  let result = repackGridClustersByTopicTag(rows, maxUrlsPerPost);
  result = splitOversizedGridClusters(result, maxUrlsPerPost);

  onProgress?.({
    tagBucketsCompleted: topicSet.size,
    tagBucketsTotal: topicSet.size,
    urlsProcessed: rows.length,
    clustersCreated: result.clusters.length,
  });

  return ensureAllPostIdsInClusterResult(allPostIds, result);
}
