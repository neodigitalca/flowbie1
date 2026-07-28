import { SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT } from "@/lib/sitemap-optimizer/constants";
import { entityCompressPlaceKeyForRow } from "@/lib/sitemap-optimizer/entity-compress-geo-split";
import {
  pickRedirectPillarPostId,
  redirectPlanCoverageGap,
  type EntityRedirectFamily,
  type EntityRedirectPlan,
} from "@/lib/sitemap-optimizer/entity-redirect-plan-parse";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function chunkIds(ids: readonly string[], maxSize: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += maxSize) {
    out.push(ids.slice(i, i + maxSize));
  }
  return out;
}

/** Pack postIds into redirect families by place key, max sources per family. Never mixes places. */
export function packPostIdsIntoCompressFamilies(
  postIds: readonly string[],
  rowById: ReadonlyMap<string, SitemapOptimizerPostRow>,
  familyIdPrefix: string,
): EntityRedirectFamily[] {
  if (!postIds.length) return [];

  const byKey = new Map<string, string[]>();
  for (const id of postIds) {
    const row = rowById.get(id);
    const key = row ? entityCompressPlaceKeyForRow(row) : "unknown";
    const list = byKey.get(key) ?? [];
    list.push(id);
    byKey.set(key, list);
  }

  const families: EntityRedirectFamily[] = [];
  let familyIndex = 0;
  for (const [, ids] of byKey) {
    for (const chunk of chunkIds(ids, SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT)) {
      familyIndex += 1;
      const destinationPostId = pickRedirectPillarPostId(chunk, rowById);
      families.push({
        familyId: `${familyIdPrefix}-${familyIndex}`,
        destinationPostId,
        sourcePostIds: chunk,
        rationale: "Deterministic compress pack for full consolidate coverage.",
      });
    }
  }
  return families;
}

/** Ensure every allowedPostId appears in exactly one family; pack gaps deterministically by place. */
export function ensureEntityCompressCoverage(
  plan: EntityRedirectPlan,
  allowedPostIds: readonly string[],
  rowById: ReadonlyMap<string, SitemapOptimizerPostRow>,
): EntityRedirectPlan {
  const { missingPostIds } = redirectPlanCoverageGap(plan, allowedPostIds);
  if (!missingPostIds.length) return plan;

  const packed = packPostIdsIntoCompressFamilies(
    missingPostIds,
    rowById,
    `compress-fill-${plan.families.length + 1}`,
  );
  return { families: [...plan.families, ...packed] };
}
