import type { GridMaxUrlsPerPost } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

function sortLoosePostIds(
  ids: string[],
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
 * Pack every 1-URL cluster and singleton into shared groups (up to maxUrlsPerPost).
 * Keeps AI multi-URL clusters (2+) unchanged so intentional merges stay intact.
 */
export function packGridLooseClusters(
  result: SitemapOptimizerClusterResult,
  rows: readonly SitemapOptimizerPostRow[],
  maxUrlsPerPost: GridMaxUrlsPerPost,
): SitemapOptimizerClusterResult {
  const rowById = new Map(rows.map((r) => [r.postId, r]));
  const kept: SitemapOptimizerCluster[] = [];
  const looseIds: string[] = [];

  for (const c of result.clusters) {
    if (c.memberPostIds.length >= 2) {
      kept.push(c);
      continue;
    }
    if (c.memberPostIds.length === 1) {
      looseIds.push(c.memberPostIds[0]!);
    }
  }

  for (const id of result.singletons) {
    if (rowById.has(id)) looseIds.push(id);
  }

  const sorted = sortLoosePostIds(looseIds, rowById);
  let packIndex = 0;

  for (let i = 0; i < sorted.length; i += maxUrlsPerPost) {
    const chunk = sorted.slice(i, i + maxUrlsPerPost);
    if (!chunk.length) continue;
    const first = rowById.get(chunk[0]!);
    const rawLabel = first?.title?.trim() || `New post group ${packIndex + 1}`;
    const label = rawLabel.length > 80 ? `${rawLabel.slice(0, 77).trim()}...` : rawLabel;
    kept.push({
      clusterId: `grid-pack-${packIndex + 1}`,
      label,
      intent: "mixed",
      memberPostIds: chunk,
      confidence: "medium",
      rationale: `Packed ${chunk.length} GSC URL(s) into one new post (max ${maxUrlsPerPost} per group).`,
    });
    packIndex += 1;
  }

  return { clusters: kept, singletons: [] };
}
