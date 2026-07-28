import { SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT } from "@/lib/sitemap-optimizer/constants";
import { urlPathTail } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import { entityRedirectGroupingKey } from "@/lib/sitemap-optimizer/entity-redirect-grouping-key";
import {
  pickRedirectPillarPostId,
  type EntityRedirectFamily,
  type EntityRedirectPlan,
} from "@/lib/sitemap-optimizer/entity-redirect-plan-parse";
import { stripWordPressNumberedSlugSuffix } from "@/lib/sitemap-optimizer/wordpress-numbered-slug-duplicate";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function chunkIds(ids: readonly string[], maxSize: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += maxSize) {
    out.push(ids.slice(i, i + maxSize));
  }
  return out;
}

/** Place bucket for compress packing (strip WP -2 clones so near-dupes stay together). */
export function entityCompressPlaceKey(url: string): string {
  const cleaned = stripWordPressNumberedSlugSuffix(url.trim());
  return entityRedirectGroupingKey(cleaned || url);
}

export function entityCompressPlaceKeyForRow(row: SitemapOptimizerPostRow): string {
  return entityCompressPlaceKey(row.url);
}

function titleCasePlaceKey(key: string): string {
  return key
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Human-readable place labels for Transform briefs (unique, stable order). */
export function entityCompressPlaceLabelsForMembers(
  memberIds: readonly string[],
  rowById: ReadonlyMap<string, SitemapOptimizerPostRow>,
): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const id of memberIds) {
    const row = rowById.get(id);
    if (!row) continue;
    const key = entityCompressPlaceKeyForRow(row);
    if (seen.has(key)) continue;
    seen.add(key);
    const fromNeighborhood = urlPathTail(row.url);
    labels.push(titleCasePlaceKey(key) || fromNeighborhood || id);
  }
  return labels;
}

/**
 * Split families that mix distinct place keys into one family per place (max 5 sources each).
 * Re-picks pillar per chunk. Leaves same-place families unchanged aside from oversized splits.
 */
export function splitMixedGeoCompressFamilies(
  plan: EntityRedirectPlan,
  rowById: ReadonlyMap<string, SitemapOptimizerPostRow>,
): EntityRedirectPlan {
  const out: EntityRedirectFamily[] = [];

  for (const family of plan.families) {
    const byPlace = new Map<string, string[]>();
    for (const id of family.sourcePostIds) {
      const row = rowById.get(id);
      const key = row ? entityCompressPlaceKeyForRow(row) : id;
      const list = byPlace.get(key) ?? [];
      list.push(id);
      byPlace.set(key, list);
    }

    if (byPlace.size <= 1) {
      const onlyIds = family.sourcePostIds;
      const chunks = chunkIds(onlyIds, SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT);
      if (chunks.length <= 1) {
        out.push({
          ...family,
          destinationPostId: pickRedirectPillarPostId(onlyIds, rowById),
          sourcePostIds: [...onlyIds],
        });
        continue;
      }
      chunks.forEach((chunk, i) => {
        out.push({
          familyId: `${family.familyId}-part-${i + 1}`,
          destinationPostId: pickRedirectPillarPostId(chunk, rowById),
          sourcePostIds: chunk,
          rationale: family.rationale || "Same-place compress family split to max pack size.",
        });
      });
      continue;
    }

    let part = 0;
    for (const [, ids] of byPlace) {
      for (const chunk of chunkIds(ids, SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT)) {
        part += 1;
        out.push({
          familyId: `${family.familyId}-geo-${part}`,
          destinationPostId: pickRedirectPillarPostId(chunk, rowById),
          sourcePostIds: chunk,
          rationale:
            family.rationale.trim() ||
            "Split mixed-geo compress family into one place per replacement.",
        });
      }
    }
  }

  return { families: out };
}
