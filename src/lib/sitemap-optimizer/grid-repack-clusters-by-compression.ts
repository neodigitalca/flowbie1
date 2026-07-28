import {
  compressionClusterKey,
  type GridCompressionLevel,
} from "@/lib/sitemap-optimizer/grid-compression-policy";
import type { GridMaxUrlsPerPost } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

function sortPostIdsByUploadRow(
  ids: readonly string[],
  rowById: Map<string, SitemapOptimizerPostRow>,
): string[] {
  return [...ids].sort((a, b) => {
    const ra = rowById.get(a);
    const rb = rowById.get(b);
    const ia = ra?.uploadRowIndex ?? 0;
    const ib = rb?.uploadRowIndex ?? 0;
    if (ia !== ib) return ia - ib;
    return (ra?.url ?? "").localeCompare(rb?.url ?? "");
  });
}

function packIdsIntoClusters(args: {
  bucketKey: string;
  bucketIndex: number;
  sortedIds: string[];
  rowById: Map<string, SitemapOptimizerPostRow>;
  maxUrlsPerPost: GridMaxUrlsPerPost;
  rationale: string;
}): SitemapOptimizerCluster[] {
  const { bucketKey, bucketIndex, sortedIds, rowById, maxUrlsPerPost, rationale } = args;
  const clusters: SitemapOptimizerCluster[] = [];
  const chunks: string[][] = [];

  for (let offset = 0; offset < sortedIds.length; offset += maxUrlsPerPost) {
    chunks.push(sortedIds.slice(offset, offset + maxUrlsPerPost));
  }
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1]!;
    const prev = chunks[chunks.length - 2]!;
    if (
      maxUrlsPerPost >= 3 &&
      last.length > 0 &&
      last.length < 3 &&
      prev.length + last.length <= maxUrlsPerPost
    ) {
      chunks[chunks.length - 2] = [...prev, ...last];
      chunks.pop();
    }
  }

  for (let part = 0; part < chunks.length; part += 1) {
    const chunk = chunks[part]!;
    if (!chunk.length) continue;
    const first = rowById.get(chunk[0]!);
    const partNum = part + 1;
    const label =
      first?.gridTagLabel?.trim() ||
      first?.title?.trim() ||
      bucketKey.replace(/^geo:|^topic:/, "").replace(/_/g, " ");
    clusters.push({
      clusterId: `grid-compress-${bucketIndex}-${partNum}`,
      label,
      intent: first?.gridIntent ?? "mixed",
      memberPostIds: chunk,
      confidence: "high",
      rationale,
    });
  }

  return clusters;
}

/** Pack URLs into clusters using compression bucket keys (geo/topic). */
export function repackGridClustersByCompression(
  rows: readonly SitemapOptimizerPostRow[],
  maxUrlsPerPost: GridMaxUrlsPerPost,
  compression: GridCompressionLevel,
): SitemapOptimizerClusterResult {
  const rowById = new Map(rows.map((r) => [r.postId, r]));
  const byBucket = new Map<string, string[]>();

  for (const row of rows) {
    const key = compressionClusterKey(row, compression);
    const list = byBucket.get(key) ?? [];
    list.push(row.postId);
    byBucket.set(key, list);
  }

  const bucketKeys = [...byBucket.keys()].sort();
  const clusters: SitemapOptimizerCluster[] = [];

  for (let bucketIndex = 0; bucketIndex < bucketKeys.length; bucketIndex += 1) {
    const bucketKey = bucketKeys[bucketIndex]!;
    const sorted = sortPostIdsByUploadRow(byBucket.get(bucketKey)!, rowById);
    clusters.push(
      ...packIdsIntoClusters({
        bucketKey,
        bucketIndex,
        sortedIds: sorted,
        rowById,
        maxUrlsPerPost,
        rationale: `Compressed ${sorted.length} URL(s) under "${bucketKey}" (${compression}, max ${maxUrlsPerPost} per new post).`,
      }),
    );
  }

  return { clusters, singletons: [] };
}
