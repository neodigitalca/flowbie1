import { entityLocationSlugFromRow } from "@/lib/sitemap-optimizer/entity-compression-buckets";
import { leadingPlaceKeyFromPathTail } from "@/lib/sitemap-optimizer/enforce-separate-geo-clusters";
import { urlPathTail } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import {
  SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT,
  SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE,
} from "@/lib/sitemap-optimizer/constants";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";
import { normalizeGridDestinationKey } from "@/lib/sitemap-optimizer/grid-merge-group-ids";

function geoKeyForRow(row: SitemapOptimizerPostRow): string {
  const place = leadingPlaceKeyFromPathTail(urlPathTail(row.url));
  if (place) return place;
  const fromSlug = entityLocationSlugFromRow(row);
  if (fromSlug) return fromSlug.toLowerCase();
  return row.postId;
}

function chunkIds(ids: string[], maxSize: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += maxSize) {
    chunks.push(ids.slice(i, i + maxSize));
  }
  return chunks;
}

function splitClusterByGeo(
  cluster: SitemapOptimizerCluster,
  rowById: Map<string, SitemapOptimizerPostRow>,
  maxMembers: number,
): SitemapOptimizerCluster[] {
  const byGeo = new Map<string, string[]>();
  for (const id of cluster.memberPostIds) {
    const row = rowById.get(id);
    const key = row ? geoKeyForRow(row) : id;
    const list = byGeo.get(key) ?? [];
    list.push(id);
    byGeo.set(key, list);
  }

  const out: SitemapOptimizerCluster[] = [];
  let part = 0;
  for (const [geoKey, ids] of byGeo) {
    const chunks = chunkIds(ids, maxMembers);
    for (const chunk of chunks) {
      part += 1;
      out.push({
        ...cluster,
        clusterId: `${cluster.clusterId}-geo-${geoKey}-${part}`,
        memberPostIds: chunk,
        rationale: cluster.rationale,
      });
    }
  }
  return out;
}

function splitClusterToMaxMembers(
  cluster: SitemapOptimizerCluster,
  rowById: Map<string, SitemapOptimizerPostRow>,
  maxMembers: number,
): SitemapOptimizerCluster[] {
  if (cluster.memberPostIds.length <= maxMembers) return [cluster];
  return splitClusterByGeo(cluster, rowById, maxMembers);
}

/**
 * Split entity clusters so each replacement post receives at most maxMembers legacy redirects.
 */
export function splitOversizedEntityClusters(
  result: SitemapOptimizerClusterResult,
  rows: readonly SitemapOptimizerPostRow[],
  maxMembers = SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT,
): SitemapOptimizerClusterResult {
  const rowById = new Map(rows.map((r) => [r.postId, r]));
  const clusters: SitemapOptimizerCluster[] = [];
  const singletonSet = new Set(result.singletons);

  for (const cluster of result.clusters) {
    const split = splitClusterToMaxMembers(cluster, rowById, maxMembers);
    for (const sub of split) {
      if (sub.memberPostIds.length === 1) {
        singletonSet.add(sub.memberPostIds[0]!);
      } else {
        clusters.push(sub);
      }
    }
  }

  const assigned = new Set(clusters.flatMap((c) => c.memberPostIds));
  for (const id of assigned) singletonSet.delete(id);

  return { clusters, singletons: [...singletonSet] };
}

export function promoteSingletonsToRewriteClusters(
  singletonPostIds: readonly string[],
  rowById: Map<string, SitemapOptimizerPostRow>,
): SitemapOptimizerCluster[] {
  return singletonPostIds.map((postId) => {
    const row = rowById.get(postId);
    return {
      clusterId: `entity-rewrite-${postId}`,
      label: row?.title?.trim() || postId,
      intent: "local" as const,
      memberPostIds: [postId],
      confidence: "medium" as const,
      rationale: "Mature underperformer; full service-area replacement.",
    };
  });
}

function appendSlugSuffix(url: string, index: number): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    u.pathname = `${path}-${index}/`;
    return u.toString();
  } catch {
    return url;
  }
}

/** Give each entity merge a unique destination when multiple clusters share the same slug. */
export function disambiguateEntityMergeDestinations(
  merges: readonly SitemapOptimizerMergeRecommendation[],
): SitemapOptimizerMergeRecommendation[] {
  const seen = new Map<string, number>();
  return merges.map((merge) => {
    const raw = merge.lockedDestinationUrl?.trim();
    if (!raw) return merge;
    const key = normalizeGridDestinationKey(raw);
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 0) return merge;
    return { ...merge, lockedDestinationUrl: appendSlugSuffix(raw, count + 1) };
  });
}

/** Default editorial/blog split threshold (legacy). */
export const ENTITY_CLUSTER_SPLIT_DEFAULT = SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE;
