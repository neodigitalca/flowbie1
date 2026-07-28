import { buildDeterministicGridBrief } from "@/lib/sitemap-optimizer/grid-deterministic-brief";
import type {
  SitemapOptimizerClusterResult,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

/** After clusters merge by shared new_url, attach one brief per cluster and union source angles. */
export function mergesForCoalescedClusters(
  clusters: SitemapOptimizerClusterResult,
  priorClusters: SitemapOptimizerClusterResult,
  priorMerges: readonly SitemapOptimizerMergeRecommendation[],
  rowById: Map<string, SitemapOptimizerPostRow>,
): SitemapOptimizerMergeRecommendation[] {
  const mergeByCluster = new Map(priorMerges.map((m) => [m.clusterId, m]));
  const postToOldCluster = new Map<string, string>();
  for (const c of priorClusters.clusters) {
    for (const id of c.memberPostIds) postToOldCluster.set(id, c.clusterId);
  }

  return clusters.clusters.map((cluster) => {
    const candidateIds = new Set<string>();
    const candidates: SitemapOptimizerMergeRecommendation[] = [];
    for (const postId of cluster.memberPostIds) {
      const oldClusterId = postToOldCluster.get(postId);
      if (!oldClusterId || candidateIds.has(oldClusterId)) continue;
      const merge = mergeByCluster.get(oldClusterId);
      if (merge) {
        candidateIds.add(oldClusterId);
        candidates.push(merge);
      }
    }

    const leadPostId = cluster.memberPostIds[0];
    const leadOldCluster = leadPostId ? postToOldCluster.get(leadPostId) : undefined;
    const primary =
      (leadOldCluster ? mergeByCluster.get(leadOldCluster) : undefined) ??
      candidates[0] ??
      buildDeterministicGridBrief(cluster, rowById);

    if (!primary) {
      throw new Error(`Missing brief for coalesced cluster ${cluster.clusterId}`);
    }

    const keepByUrl = new Map<string, (typeof primary.whatToKeepFromEach)[number]>();
    for (const merge of candidates) {
      for (const keep of merge.whatToKeepFromEach) {
        const key = keep.url.trim().toLowerCase();
        if (key && !keepByUrl.has(key)) keepByUrl.set(key, keep);
      }
    }

    return {
      ...primary,
      clusterId: cluster.clusterId,
      whatToKeepFromEach: [...keepByUrl.values()],
    };
  });
}
