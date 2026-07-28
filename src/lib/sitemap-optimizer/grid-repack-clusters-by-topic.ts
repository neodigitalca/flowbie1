import { normalizeGridTopicTag } from "@/lib/sitemap-optimizer/grid-tag-key";
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

/**
 * Pack every URL sharing a topic tag into clusters of up to maxUrlsPerPost.
 * Maximizes consolidation; never merges across different topic tags.
 */
export function repackGridClustersByTopicTag(
  rows: readonly SitemapOptimizerPostRow[],
  maxUrlsPerPost: GridMaxUrlsPerPost,
): SitemapOptimizerClusterResult {
  const rowById = new Map(rows.map((r) => [r.postId, r]));
  const byTopic = new Map<string, string[]>();

  for (const row of rows) {
    const topic = normalizeGridTopicTag(row.gridTopicTag ?? "untagged");
    const list = byTopic.get(topic) ?? [];
    list.push(row.postId);
    byTopic.set(topic, list);
  }

  const topicKeys = [...byTopic.keys()].sort();
  const clusters: SitemapOptimizerCluster[] = [];

  for (let topicIndex = 0; topicIndex < topicKeys.length; topicIndex += 1) {
    const topic = topicKeys[topicIndex]!;
    const sorted = sortPostIdsByUploadRow(byTopic.get(topic)!, rowById);

    const chunks: string[][] = [];
    for (let offset = 0; offset < sorted.length; offset += maxUrlsPerPost) {
      chunks.push(sorted.slice(offset, offset + maxUrlsPerPost));
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
        topic.replace(/_/g, " ");
      clusters.push({
        clusterId: `grid-topic-${topicIndex}-${partNum}`,
        label,
        intent: first?.gridIntent ?? "mixed",
        memberPostIds: chunk,
        confidence: "high",
        rationale: `Packed ${chunk.length} URL(s) under topic tag "${topic}" (max ${maxUrlsPerPost} per new post).`,
      });
    }
  }

  return { clusters, singletons: [] };
}
