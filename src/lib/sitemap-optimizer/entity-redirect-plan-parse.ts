import { parseAssistantJsonObject } from "@/lib/competitor-research/competitor-report-json-parse";
import { z } from "zod";
import { SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT } from "@/lib/sitemap-optimizer/constants";
import {
  isPlaceholderKeyword,
  isPlaceholderSapEntity,
  isPlaceholderStrategyField,
} from "@/lib/sitemap-optimizer/entity-strategy-placeholders";
import { resolveCatalogPostId } from "@/lib/sitemap-optimizer/resolve-catalog-post-id";
import { isWordPressNumberedSlugDuplicate } from "@/lib/sitemap-optimizer/wordpress-numbered-slug-duplicate";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

export type EntityRedirectFamily = {
  familyId: string;
  destinationPostId: string;
  sourcePostIds: string[];
  rationale: string;
  recommendedPrimaryKeyword?: string;
  recommendedTitle?: string;
  recommendedMeta?: string;
  sapEntity?: string;
  sapModifier?: string;
  combinedOutline?: string[];
  whatToKeepFromEach?: Array<{ url: string; title: string; bullets: string[] }>;
};

export type EntityRedirectPlan = {
  families: EntityRedirectFamily[];
};

const keepSchema = z
  .object({
    url: z.string().optional(),
    title: z.string().optional(),
    bullets: z.array(z.string()).optional(),
  })
  .transform((k) => ({
    url: (k.url ?? "").trim(),
    title: (k.title ?? "").trim(),
    bullets: (k.bullets ?? []).map((b) => String(b).trim()).filter(Boolean),
  }));

const familySchema = z.object({
  familyId: z.string().optional(),
  destinationPostId: z.string(),
  sourcePostIds: z.array(z.string()).min(1),
  rationale: z.string().optional(),
  recommendedPrimaryKeyword: z.string().optional(),
  recommendedTitle: z.string().optional(),
  recommendedMeta: z.string().optional(),
  sapEntity: z.string().optional(),
  sapModifier: z.string().optional(),
  combinedOutline: z.array(z.string()).optional(),
  whatToKeepFromEach: z.array(keepSchema).optional(),
  keyword: z.string().optional(),
  title: z.string().optional(),
  meta: z.string().optional(),
  entity: z.string().optional(),
  modifier: z.string().optional(),
});

const planSchema = z.object({
  families: z.array(familySchema).min(1),
});

function readFamilyStrategy(f: z.infer<typeof familySchema>): Pick<
  EntityRedirectFamily,
  | "recommendedPrimaryKeyword"
  | "recommendedTitle"
  | "recommendedMeta"
  | "sapEntity"
  | "sapModifier"
  | "combinedOutline"
  | "whatToKeepFromEach"
> {
  const recommendedPrimaryKeyword = (f.recommendedPrimaryKeyword ?? f.keyword ?? "").trim();
  const recommendedTitle = (f.recommendedTitle ?? f.title ?? "").trim();
  const recommendedMeta = (f.recommendedMeta ?? f.meta ?? "").trim();
  const sapEntity = (f.sapEntity ?? f.entity ?? "").trim();
  const sapModifier = (f.sapModifier ?? f.modifier ?? "").trim();
  const combinedOutline = (f.combinedOutline ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  const whatToKeepFromEach = (f.whatToKeepFromEach ?? []).filter(
    (k) => k.url || k.title || k.bullets.length,
  );
  return {
    recommendedPrimaryKeyword: recommendedPrimaryKeyword || undefined,
    recommendedTitle: recommendedTitle || undefined,
    recommendedMeta: recommendedMeta || undefined,
    sapEntity: sapEntity || undefined,
    sapModifier: sapModifier || undefined,
    combinedOutline: combinedOutline.length ? combinedOutline : undefined,
    whatToKeepFromEach: whatToKeepFromEach.length ? whatToKeepFromEach : undefined,
  };
}

function sortByGscPerformance(a: SitemapOptimizerPostRow, b: SitemapOptimizerPostRow): number {
  const clickDiff = (b.gscPageClicks ?? 0) - (a.gscPageClicks ?? 0);
  if (clickDiff !== 0) return clickDiff;
  return (b.gscPageImpressions ?? 0) - (a.gscPageImpressions ?? 0);
}

/** Prefer non-numbered-slug URLs, then highest clicks, then impressions. */
export function pickRedirectPillarPostId(
  sourcePostIds: readonly string[],
  rowById: ReadonlyMap<string, SitemapOptimizerPostRow>,
): string {
  const members = sourcePostIds
    .map((id) => rowById.get(id))
    .filter((r): r is SitemapOptimizerPostRow => r != null);
  if (!members.length) return sourcePostIds[0]!;
  const nonDuplicates = members.filter((m) => !isWordPressNumberedSlugDuplicate(m.url));
  const pool = nonDuplicates.length > 0 ? nonDuplicates : members;
  return [...pool].sort(sortByGscPerformance)[0]!.postId;
}

export function redirectPlanCoverageGap(
  plan: EntityRedirectPlan | null,
  allowedPostIds: readonly string[],
): { missingPostIds: string[]; assignedCount: number } {
  const allowed = new Set(allowedPostIds);
  const seen = new Set<string>();
  if (plan) {
    for (const family of plan.families) {
      for (const id of family.sourcePostIds) seen.add(id);
    }
  }
  const missingPostIds = [...allowed].filter((id) => !seen.has(id));
  return { missingPostIds, assignedCount: seen.size };
}

function resolveAllowedPostIds(
  rawIds: readonly string[],
  allowedPostIds: readonly string[],
  alreadyAssigned: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawIds) {
    const resolved = resolveCatalogPostId(raw, allowedPostIds);
    if (!resolved || alreadyAssigned.has(resolved) || seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}

function chunkPostIds(ids: readonly string[], maxSize: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += maxSize) {
    chunks.push(ids.slice(i, i + maxSize));
  }
  return chunks;
}

function filterKeepEntriesForMembers(
  keep: EntityRedirectFamily["whatToKeepFromEach"],
  memberIds: readonly string[],
  rowById: ReadonlyMap<string, SitemapOptimizerPostRow>,
): EntityRedirectFamily["whatToKeepFromEach"] {
  if (!keep?.length) return keep;
  const memberUrls = new Set(
    memberIds
      .map((id) => rowById.get(id)?.url.trim().toLowerCase())
      .filter(Boolean),
  );
  const filtered = keep.filter((entry) => {
    const url = entry.url.trim().toLowerCase();
    if (url && memberUrls.has(url)) return true;
    return memberIds.some((id) => {
      const row = rowById.get(id);
      if (!row) return false;
      const title = entry.title.trim().toLowerCase();
      return title.length > 0 && title === row.title.trim().toLowerCase();
    });
  });
  return filtered.length ? filtered : keep.slice(0, memberIds.length);
}

export function parseEntityRedirectPlanJson(
  content: string,
  allowedPostIds: readonly string[],
  rowById?: ReadonlyMap<string, SitemapOptimizerPostRow>,
): EntityRedirectPlan | null {
  let parsed: unknown;
  try {
    parsed = parseAssistantJsonObject(content);
  } catch {
    return null;
  }
  const result = planSchema.safeParse(parsed);
  if (!result.success) return null;

  const assigned = new Set<string>();
  const families: EntityRedirectFamily[] = [];

  for (let i = 0; i < result.data.families.length; i += 1) {
    const f = result.data.families[i]!;
    const sourcePostIds = resolveAllowedPostIds(f.sourcePostIds, allowedPostIds, assigned);
    if (!sourcePostIds.length) continue;

    const strategy = readFamilyStrategy(f);
    const baseFamilyId = (f.familyId ?? `redirect-family-${i + 1}`).trim();
    const idChunks = chunkPostIds(sourcePostIds, SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT);

    for (let chunkIndex = 0; chunkIndex < idChunks.length; chunkIndex += 1) {
      const chunk = idChunks[chunkIndex]!;
      let destinationPostId = resolveCatalogPostId(f.destinationPostId, allowedPostIds);
      const destRow = destinationPostId && rowById ? rowById.get(destinationPostId) : undefined;
      const destIsNumberedDup =
        destRow != null && isWordPressNumberedSlugDuplicate(destRow.url);
      const chunkHasNonDup =
        rowById != null &&
        chunk.some((id) => {
          const r = rowById.get(id);
          return r != null && !isWordPressNumberedSlugDuplicate(r.url);
        });
      if (
        !destinationPostId ||
        !chunk.includes(destinationPostId) ||
        (destIsNumberedDup && chunkHasNonDup)
      ) {
        destinationPostId = rowById
          ? pickRedirectPillarPostId(chunk, rowById)
          : chunk[0]!;
      }

      for (const id of chunk) assigned.add(id);

      const familyId =
        idChunks.length > 1 ? `${baseFamilyId}-${chunkIndex + 1}` : baseFamilyId;
      const whatToKeepFromEach = rowById
        ? filterKeepEntriesForMembers(strategy.whatToKeepFromEach, chunk, rowById)
        : strategy.whatToKeepFromEach;

      families.push({
        familyId,
        destinationPostId,
        sourcePostIds: chunk,
        rationale: (f.rationale ?? "").trim(),
        ...strategy,
        whatToKeepFromEach,
      });
    }
  }

  if (!families.length) return null;
  return { families };
}

export function familyHasCompleteAiStrategy(family: EntityRedirectFamily): boolean {
  if (!family.rationale.trim() || isPlaceholderStrategyField(family.rationale)) return false;
  if (isPlaceholderKeyword(family.recommendedPrimaryKeyword)) return false;
  if (!family.recommendedTitle?.trim() || isPlaceholderStrategyField(family.recommendedTitle)) {
    return false;
  }
  if (!family.recommendedMeta?.trim() || isPlaceholderStrategyField(family.recommendedMeta)) {
    return false;
  }
  if (isPlaceholderSapEntity(family.sapEntity)) return false;
  if (!family.sapModifier?.trim() || isPlaceholderStrategyField(family.sapModifier)) return false;
  if (!family.combinedOutline?.length) return false;
  if (!family.whatToKeepFromEach?.length) return false;
  if (family.whatToKeepFromEach.length < family.sourcePostIds.length) return false;
  return true;
}

/** @deprecated Use familyHasCompleteAiStrategy */
export function familyHasAiStrategy(family: EntityRedirectFamily): boolean {
  return familyHasCompleteAiStrategy(family);
}

export function validateEntityRedirectPlanStrategy(plan: EntityRedirectPlan): boolean {
  return plan.families.every((family) => familyHasCompleteAiStrategy(family));
}

export function validateEntityRedirectPlanCoverage(
  plan: EntityRedirectPlan,
  allowedPostIds: readonly string[],
): boolean {
  const allowed = new Set(allowedPostIds);
  const seen = new Set<string>();
  for (const family of plan.families) {
    if (family.sourcePostIds.length > SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT) {
      return false;
    }
    if (!family.sourcePostIds.includes(family.destinationPostId)) return false;
    for (const id of family.sourcePostIds) {
      if (!allowed.has(id) || seen.has(id)) return false;
      seen.add(id);
    }
  }
  return seen.size === allowed.size;
}
