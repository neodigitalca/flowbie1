import { buildMergePublishContract } from "@/lib/sitemap-optimizer/sitemap-merge-publish-contract";
import { gridMemberCanonicalUrl } from "@/lib/sitemap-optimizer/grid-member-url";
import { resolvedMemberRows } from "@/lib/sitemap-optimizer/resolved-cluster-members";
import type {
  SitemapOptimizerClusterResult,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
  SitemapOptimizerRunResult,
} from "@/lib/sitemap-optimizer/types";

/** Canonical key so rows sharing a new URL get the same group id. */
export function normalizeGridDestinationKey(destinationUrl: string): string {
  const raw = destinationUrl.trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    let path = u.pathname.replace(/\/+/g, "/").toLowerCase();
    if (!path.endsWith("/")) path += "/";
    return `${u.origin}${path}`;
  } catch {
    return raw.toLowerCase();
  }
}

function compareDestinationKey(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Assign 1-based group numbers per destination URL.
 * Destinations with more than 2 source URLs first (smallest count first),
 * then pairs, then single-URL destinations last.
 */
export function buildMergeGroupNumberByDestinationUrl(
  memberCountByDestination: Map<string, number>,
): Map<string, number> {
  const entries = [...memberCountByDestination.entries()].map(([key, count]) => ({
    key,
    count,
  }));

  const multi = entries
    .filter((e) => e.count > 2)
    .sort((a, b) => {
      if (a.count !== b.count) return a.count - b.count;
      return compareDestinationKey(a.key, b.key);
    });

  const pairs = entries
    .filter((e) => e.count === 2)
    .sort((a, b) => compareDestinationKey(a.key, b.key));

  const singles = entries
    .filter((e) => e.count === 1)
    .sort((a, b) => compareDestinationKey(a.key, b.key));

  const map = new Map<string, number>();
  [...multi, ...pairs, ...singles].forEach((e, index) => {
    map.set(e.key, index + 1);
  });
  return map;
}

/** When every member shares the same CSV new_url, return that destination. */
/** Count redirect source rows per destination URL (for max-pack enforcement checks). */
export function countRedirectSourcesPerDestination(
  rows: readonly SitemapOptimizerPostRow[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.gridRedirectFromUrl?.trim()) continue;
    const key = normalizeGridDestinationKey(row.url);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function maxRedirectSourcesPerDestination(
  counts: ReadonlyMap<string, number>,
): number {
  let max = 0;
  for (const n of counts.values()) max = Math.max(max, n);
  return max;
}

export function sharedGridClusterDestinationUrl(
  members: readonly SitemapOptimizerPostRow[],
): string | null {
  if (!members.length) return null;
  const first = gridMemberCanonicalUrl(members[0]!);
  const key = normalizeGridDestinationKey(first);
  if (!key) return null;
  const allSame = members.every(
    (m) => normalizeGridDestinationKey(gridMemberCanonicalUrl(m)) === key,
  );
  return allSame ? first : null;
}

export function countGridDestinationMembers(args: {
  rows: readonly SitemapOptimizerPostRow[];
  clusters: SitemapOptimizerClusterResult;
  merges: readonly SitemapOptimizerMergeRecommendation[];
  publishedAt?: string;
}): Map<string, number> {
  const { rows, clusters, merges, publishedAt } = args;
  const rowMap = new Map(rows.map((r) => [r.postId, r]));
  const mergeByCluster = new Map(merges.map((m) => [m.clusterId, m]));
  const counts = new Map<string, number>();

  for (const cluster of clusters.clusters) {
    const merge = mergeByCluster.get(cluster.clusterId);
    if (!merge) continue;
    const members = resolvedMemberRows(cluster, rowMap);
    const contract = buildMergePublishContract(merge, members, publishedAt ?? new Date().toISOString(), {
      minMembers: 1,
    });
    if (!contract?.destinationUrl) continue;
    const key = normalizeGridDestinationKey(contract.destinationUrl);
    counts.set(key, (counts.get(key) ?? 0) + members.length);
  }

  return counts;
}

export function buildMergeGroupNumbersForGrid(args: {
  rows: readonly SitemapOptimizerPostRow[];
  clusters: SitemapOptimizerClusterResult;
  merges: readonly SitemapOptimizerMergeRecommendation[];
  publishedAt?: string;
}): Map<string, number> {
  return buildMergeGroupNumberByDestinationUrl(countGridDestinationMembers(args));
}

export function buildMergeGroupNumbersForGridResult(
  result: SitemapOptimizerRunResult,
): Map<string, number> {
  return buildMergeGroupNumbersForGrid({
    rows: result.rows,
    clusters: result.clusters,
    merges: result.merges,
    publishedAt: result.analyzedAt,
  });
}

export function mergeGroupNumberForDestination(
  destinationUrl: string,
  groupByDestination: Map<string, number>,
): number {
  return groupByDestination.get(normalizeGridDestinationKey(destinationUrl)) ?? 0;
}

/** @deprecated Use destination-based grouping via buildMergeGroupNumbersForGrid. */
export function buildMergeGroupNumberByClusterId(
  clusters: SitemapOptimizerClusterResult,
): Map<string, number> {
  const map = new Map<string, number>();
  const sorted = [...clusters.clusters].sort((a, b) => a.clusterId.localeCompare(b.clusterId));
  sorted.forEach((c, index) => {
    map.set(c.clusterId, index + 1);
  });
  return map;
}

/** One group id per cluster in CSV upload order (instant 1:1 redirect mode). */
export function buildMergeGroupNumberByClusterUploadOrder(
  clusters: SitemapOptimizerClusterResult,
  rows: readonly SitemapOptimizerPostRow[],
): Map<string, number> {
  const rowMap = new Map(rows.map((r) => [r.postId, r]));
  const sorted = [...clusters.clusters].sort((a, b) => {
    const ia =
      rowMap.get(a.memberPostIds[0] ?? "")?.uploadRowIndex ?? Number.MAX_SAFE_INTEGER;
    const ib =
      rowMap.get(b.memberPostIds[0] ?? "")?.uploadRowIndex ?? Number.MAX_SAFE_INTEGER;
    if (ia !== ib) return ia - ib;
    return a.clusterId.localeCompare(b.clusterId);
  });
  const map = new Map<string, number>();
  sorted.forEach((c, index) => {
    map.set(c.clusterId, index + 1);
  });
  return map;
}

export function mergeGroupNumberForCluster(
  clusterId: string,
  groupByCluster: Map<string, number>,
): number {
  return groupByCluster.get(clusterId) ?? 0;
}
