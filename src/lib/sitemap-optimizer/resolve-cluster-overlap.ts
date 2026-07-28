import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
} from "@/lib/sitemap-optimizer/types";

const CONFIDENCE_RANK: Record<SitemapOptimizerCluster["confidence"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function clusterScore(c: SitemapOptimizerCluster): number {
  return CONFIDENCE_RANK[c.confidence] * 100 + c.memberPostIds.length;
}

/**
 * Ensures each postId appears in at most one cluster (prevents duplicate redirect sources).
 */
export function resolveClusterOverlap(
  result: SitemapOptimizerClusterResult,
): SitemapOptimizerClusterResult {
  const sorted = [...result.clusters].sort((a, b) => clusterScore(b) - clusterScore(a));
  const claimed = new Set<string>();
  const clusters: SitemapOptimizerCluster[] = [];

  for (const c of sorted) {
    const members = c.memberPostIds.filter((id) => !claimed.has(id));
    if (members.length >= 2) {
      for (const id of members) claimed.add(id);
      clusters.push({ ...c, memberPostIds: members });
    }
  }

  const singletonSet = new Set(result.singletons);
  for (const c of result.clusters) {
    for (const id of c.memberPostIds) {
      if (!claimed.has(id)) singletonSet.add(id);
    }
  }
  for (const id of claimed) singletonSet.delete(id);

  return { clusters, singletons: [...singletonSet] };
}
