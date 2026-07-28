import { ensureAllPostIdsInClusterResult } from "@/lib/sitemap-optimizer/ensure-cluster-catalog-coverage";
import { SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE } from "@/lib/sitemap-optimizer/constants";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

/**
 * Grid harness: every upload postId must be in a multi-URL cluster (2+ resolvable members)
 * or in singletons. Underfilled clusters (phantom ids, size 1) become singletons.
 */
export function normalizeGridClusterAssignments(
  result: SitemapOptimizerClusterResult,
  rows: readonly SitemapOptimizerPostRow[],
  options?: { keepSingleMemberClusters?: boolean },
): SitemapOptimizerClusterResult {
  const keepSingle = options?.keepSingleMemberClusters === true;
  const allPostIds = rows.map((r) => r.postId);
  const rowSet = new Set(allPostIds);
  const clusters: SitemapOptimizerCluster[] = [];
  const singletonSet = new Set<string>();

  for (const id of result.singletons) {
    if (rowSet.has(id)) singletonSet.add(id);
  }

  for (const c of result.clusters) {
    const members = c.memberPostIds.filter((id) => rowSet.has(id));
    if (
      members.length >= SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE ||
      (keepSingle && members.length >= 1)
    ) {
      clusters.push({ ...c, memberPostIds: members });
    } else {
      for (const id of members) singletonSet.add(id);
    }
  }

  const assigned = new Set(clusters.flatMap((c) => c.memberPostIds));
  for (const id of assigned) singletonSet.delete(id);

  return ensureAllPostIdsInClusterResult(allPostIds, {
    clusters,
    singletons: [...singletonSet],
  });
}

export function gridClusterForPostId(
  postId: string,
  clusters: SitemapOptimizerClusterResult,
): SitemapOptimizerCluster | undefined {
  for (const c of clusters.clusters) {
    if (c.memberPostIds.includes(postId)) return c;
  }
  if (clusters.singletons.includes(postId)) {
    return {
      clusterId: `singleton:${postId}`,
      label: "Singleton new blog",
      intent: "mixed",
      memberPostIds: [postId],
      confidence: "medium",
      rationale: "",
    };
  }
  return undefined;
}
