export function countClusterCoverage(result: {
  clusters: { memberPostIds: string[] }[];
  singletons: string[];
}): { inClusters: number; singletons: number; total: number; mergeGroups: number } {
  const inClusters = result.clusters.reduce((n, c) => n + c.memberPostIds.length, 0);
  return {
    inClusters,
    singletons: result.singletons.length,
    total: inClusters + result.singletons.length,
    mergeGroups: result.clusters.length,
  };
}
