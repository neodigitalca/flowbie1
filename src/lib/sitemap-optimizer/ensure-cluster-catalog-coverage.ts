import type { SitemapOptimizerClusterResult } from "@/lib/sitemap-optimizer/types";

/** Every catalog postId must appear in exactly one cluster or singletons. */
export function ensureAllPostIdsInClusterResult(
  allPostIds: readonly string[],
  result: SitemapOptimizerClusterResult,
): SitemapOptimizerClusterResult {
  const assigned = new Set<string>();
  for (const c of result.clusters) {
    for (const id of c.memberPostIds) assigned.add(id);
  }
  const singletonSet = new Set(result.singletons);
  for (const id of allPostIds) {
    if (!assigned.has(id)) singletonSet.add(id);
  }
  for (const id of assigned) singletonSet.delete(id);
  return { clusters: result.clusters, singletons: [...singletonSet] };
}
