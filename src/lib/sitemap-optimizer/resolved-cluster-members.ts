import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

export function resolvedMemberRows(
  cluster: SitemapOptimizerCluster,
  rowMap: Map<string, SitemapOptimizerPostRow>,
): SitemapOptimizerPostRow[] {
  return resolvedMemberRowsFromIds(cluster.memberPostIds, rowMap);
}

export function resolvedMemberRowsFromIds(
  memberPostIds: readonly string[],
  rowMap: Map<string, SitemapOptimizerPostRow>,
): SitemapOptimizerPostRow[] {
  return memberPostIds
    .map((id) => rowMap.get(id))
    .filter((r): r is SitemapOptimizerPostRow => r != null);
}

export function isMergeableCluster(
  cluster: SitemapOptimizerCluster,
  rowMap: Map<string, SitemapOptimizerPostRow>,
  minMembers = 2,
): boolean {
  return resolvedMemberRows(cluster, rowMap).length >= minMembers;
}

export function filterMergeableClusters(
  clusters: SitemapOptimizerCluster[],
  rowMap: Map<string, SitemapOptimizerPostRow>,
  minMembers = 2,
): SitemapOptimizerCluster[] {
  return clusters.filter((c) => isMergeableCluster(c, rowMap, minMembers));
}

export function filterMergeableMerges(
  merges: SitemapOptimizerMergeRecommendation[],
  clusters: SitemapOptimizerCluster[],
  rows: SitemapOptimizerPostRow[],
  minMembers = 2,
): SitemapOptimizerMergeRecommendation[] {
  const rowMap = new Map(rows.map((r) => [r.postId, r]));
  const clusterById = new Map(clusters.map((c) => [c.clusterId, c]));
  return merges.filter((merge) => {
    const cluster = clusterById.get(merge.clusterId);
    if (!cluster) return false;
    return isMergeableCluster(cluster, rowMap, minMembers);
  });
}

export function pruneClusterResultToMergeable(
  result: SitemapOptimizerClusterResult,
  rows: SitemapOptimizerPostRow[],
): SitemapOptimizerClusterResult {
  const rowMap = new Map(rows.map((r) => [r.postId, r]));
  const mergeable = filterMergeableClusters(result.clusters, rowMap);
  const assigned = new Set<string>();
  for (const c of mergeable) {
    for (const id of c.memberPostIds) assigned.add(id);
  }
  const singletonSet = new Set(result.singletons);
  for (const c of result.clusters) {
    for (const id of c.memberPostIds) {
      if (!assigned.has(id)) singletonSet.add(id);
    }
  }
  for (const id of assigned) singletonSet.delete(id);
  return { clusters: mergeable, singletons: [...singletonSet] };
}
