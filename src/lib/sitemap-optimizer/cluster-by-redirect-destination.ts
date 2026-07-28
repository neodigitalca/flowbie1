import { normalizeGridDestinationKey } from "@/lib/sitemap-optimizer/grid-merge-group-ids";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

function labelFromDestination(
  destinationUrl: string,
  members: readonly SitemapOptimizerPostRow[],
): string {
  const tag = members.find((m) => m.gridTagLabel?.trim())?.gridTagLabel?.trim();
  if (tag) return tag;
  try {
    const segments = new URL(destinationUrl).pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1] ?? "cluster";
    return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "Redirect cluster";
  }
}

/**
 * Group redirect-map rows by CSV new_url (row.url after inventory remap).
 * One cluster per unique destination = one content plan per family.
 */
export function clusterResultFromRedirectDestinations(
  rows: readonly SitemapOptimizerPostRow[],
): SitemapOptimizerClusterResult {
  const byDest = new Map<string, SitemapOptimizerPostRow[]>();
  for (const row of rows) {
    if (!row.gridRedirectFromUrl?.trim()) continue;
    const key = normalizeGridDestinationKey(row.url);
    if (!key) continue;
    const list = byDest.get(key) ?? [];
    list.push(row);
    byDest.set(key, list);
  }

  const clusters: SitemapOptimizerCluster[] = [];
  let index = 0;
  for (const [destKey, members] of [...byDest.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    index += 1;
    const rep = members[0]!;
    clusters.push({
      clusterId: `redirect-dest-${index}`,
      label: labelFromDestination(rep.url, members),
      intent: "mixed",
      memberPostIds: members.map((m) => m.postId),
      confidence: members.length > 1 ? "high" : "medium",
      rationale: `${members.length} legacy URL(s) → ${destKey}`,
    });
  }

  const assigned = new Set(clusters.flatMap((c) => c.memberPostIds));
  const singletons = rows.filter((r) => !assigned.has(r.postId)).map((r) => r.postId);

  return { clusters, singletons };
}

export function redirectDestinationFamilyStats(rows: readonly SitemapOptimizerPostRow[]): {
  families: number;
  redirectRows: number;
  maxFamilySize: number;
} {
  const result = clusterResultFromRedirectDestinations(rows);
  const sizes = result.clusters.map((c) => c.memberPostIds.length);
  return {
    families: result.clusters.length,
    redirectRows: sizes.reduce((a, b) => a + b, 0),
    maxFamilySize: sizes.length ? Math.max(...sizes) : 0,
  };
}
