import { ensureBlogDestinationUrl } from "@/lib/sitemap-optimizer/blog-destination-url";
import {
  isRedirectMapOverflowPackCluster,
} from "@/lib/sitemap-optimizer/grid-redirect-pack-cluster";
import { isTemporalCannibalizationCluster } from "@/lib/sitemap-optimizer/grid-temporal-cannibalization";
import {
  normalizeGridDestinationKey,
  sharedGridClusterDestinationUrl,
} from "@/lib/sitemap-optimizer/grid-merge-group-ids";
import { gridMemberCanonicalUrl, gridMemberSourceUrl } from "@/lib/sitemap-optimizer/grid-member-url";
import type { SitemapOptimizerCluster, SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";
import { resolvedMemberRows } from "@/lib/sitemap-optimizer/resolved-cluster-members";

export function isRedirectMapCluster(members: readonly SitemapOptimizerPostRow[]): boolean {
  return members.length > 0 && members.every((m) => Boolean(m.gridRedirectFromUrl?.trim()));
}

/** Lock brief/contract destination to CSV new_url when this is a redirect-map cluster. */
export function lockedDestinationForRedirectMapCluster(
  members: readonly SitemapOptimizerPostRow[],
  cluster?: Pick<SitemapOptimizerCluster, "clusterId">,
): string | null {
  if (cluster && isTemporalCannibalizationCluster(cluster)) {
    const shared = sharedGridClusterDestinationUrl(members);
    if (shared) return shared;
    return null;
  }
  if (cluster && isRedirectMapOverflowPackCluster(cluster)) return null;
  if (!isRedirectMapCluster(members)) return null;
  const shared = sharedGridClusterDestinationUrl(members);
  if (shared) return shared;
  const sorted = [...members].sort(
    (a, b) => (a.uploadRowIndex ?? Number.MAX_SAFE_INTEGER) - (b.uploadRowIndex ?? Number.MAX_SAFE_INTEGER),
  );
  const canonical = gridMemberCanonicalUrl(sorted[0]!);
  return ensureBlogDestinationUrl(canonical) ?? canonical;
}

function legacyPathKeys(members: readonly SitemapOptimizerPostRow[]): Set<string> {
  const keys = new Set<string>();
  for (const m of members) {
    const legacy = gridMemberSourceUrl(m);
    const key = normalizeGridDestinationKey(legacy);
    if (key) keys.add(key);
  }
  return keys;
}

/** True when url matches any member's old_url path (not the new blog target). */
export function lockedUrlMatchesLegacySource(
  url: string,
  members: readonly SitemapOptimizerPostRow[],
): boolean {
  const key = normalizeGridDestinationKey(url);
  if (!key) return false;
  return legacyPathKeys(members).has(key);
}

/** Prefer CSV new_url; reject AI output that points at a legacy old_url. */
export function coerceRedirectMapLockedDestination(
  candidate: string | undefined,
  members: readonly SitemapOptimizerPostRow[],
): string | null {
  const preset = lockedDestinationForRedirectMapCluster(members);
  if (preset) return preset;
  const trimmed = candidate?.trim();
  if (!trimmed) return null;
  if (lockedUrlMatchesLegacySource(trimmed, members)) return null;
  return trimmed;
}

export function buildRedirectMapLockedDestinationsByCluster(
  clusters: readonly SitemapOptimizerCluster[],
  rowMap: Map<string, SitemapOptimizerPostRow>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const cluster of clusters) {
    const members = resolvedMemberRows(cluster, rowMap);
    const locked = lockedDestinationForRedirectMapCluster(members, cluster);
    if (locked) out.set(cluster.clusterId, locked);
  }
  return out;
}
