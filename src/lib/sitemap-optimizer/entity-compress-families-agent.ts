import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import {
  stripHtmlToPlainText,
  truncatePlainText,
  urlPathTail,
} from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import {
  SITEMAP_OPTIMIZER_ENTITY_COMPRESS_CONCURRENCY,
  SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT,
  SITEMAP_OPTIMIZER_ENTITY_REDIRECT_PLAN_BATCH_SIZE,
  SITEMAP_OPTIMIZER_GSC_TOP_QUERIES,
  SITEMAP_OPTIMIZER_MERGE_CONTENT_MAX,
} from "@/lib/sitemap-optimizer/constants";
import { ensureEntityCompressCoverage } from "@/lib/sitemap-optimizer/entity-compress-coverage";
import { splitMixedGeoCompressFamilies } from "@/lib/sitemap-optimizer/entity-compress-geo-split";
import {
  entityNeighborhoodFromPathTail,
  entityRedirectGroupingKey,
} from "@/lib/sitemap-optimizer/entity-redirect-grouping-key";
import {
  parseEntityRedirectPlanJson,
  type EntityRedirectPlan,
} from "@/lib/sitemap-optimizer/entity-redirect-plan-parse";
import {
  buildGscSitePerformanceBenchmarks,
  formatGscBenchmarksForPrompt,
  gscRowPerformanceRanks,
} from "@/lib/sitemap-optimizer/gsc-site-performance-benchmarks";
import { isWordPressNumberedSlugDuplicate } from "@/lib/sitemap-optimizer/wordpress-numbered-slug-duplicate";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const COMPRESS_SYSTEM = `You are a senior technical SEO packing service-area URLs into redirect families for consolidation.

Return ONLY valid JSON (no markdown fences):
{
  "families": [
    {
      "familyId": "redirect-family-1",
      "destinationPostId": "wp:123",
      "sourcePostIds": ["wp:123", "wp:456"],
      "rationale": "why these URLs share one replacement"
    }
  ]
}

Rules:
- Maximum ${SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT} sourcePostIds per family. Split into multiple families when a group is larger.
- destinationPostId MUST be one of that family's sourcePostIds (pillar).
- NEVER choose a WordPress numbered clone slug (...-2, ...-3, ...-2-2) as destinationPostId when any non-clone member exists in the family. Prefer the highest-click non-clone URL.
- ONE city or town per family. Pack only same-place thin duplicates (same catalog groupingKey / neighborhood / place token). Singletons are valid.
- NEVER invent long-haul regional hubs. Do not redirect East Coast cities to West Coast pages, Central Florida to South Florida, or other distant metros into one family (e.g. Boca Raton with Bradenton, Jupiter with Altamonte Springs).
- Different cities = different families. Prefer matching groupingKey values from the catalog.
- Pillar must be the highest-click non-clone member of that same-place family only.
- Every allowedPostId must appear in exactly one family sourcePostIds list.
- Copy postId values character-for-character from the catalog.
- Before finishing, count unique postIds in sourcePostIds; the count MUST equal allowedPostIds.length.
- Do NOT invent titles, meta, keywords, or SAP fields. Families only.`;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size) as T[]);
  }
  return out;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const n = items.length;
  const ret: R[] = new Array(n);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      if (signal?.aborted) return;
      const idx = next++;
      if (idx >= n) return;
      ret[idx] = await fn(items[idx]!, idx);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), n);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return ret;
}

export function catalogForCompressFamilies(
  batch: readonly SitemapOptimizerPostRow[],
  allRows: readonly SitemapOptimizerPostRow[],
) {
  return batch.map((row) => {
    const ranks = gscRowPerformanceRanks(row, allRows);
    const tail = urlPathTail(row.url);
    const body =
      row.contentSnippet ||
      truncatePlainText(stripHtmlToPlainText(row.seoResearch ?? ""), SITEMAP_OPTIMIZER_MERGE_CONTENT_MAX);
    return {
      postId: row.postId,
      url: row.url,
      urlPathTail: tail,
      groupingKey: entityRedirectGroupingKey(row.url),
      neighborhood: entityNeighborhoodFromPathTail(tail),
      title: row.title,
      keyword: row.keyword,
      meta: row.meta,
      contentSnippet: body,
      isNumberedSlugDuplicate: isWordPressNumberedSlugDuplicate(row.url),
      gscTopQueries: row.gscQueries.slice(0, SITEMAP_OPTIMIZER_GSC_TOP_QUERIES).map((q) => q.query),
      gscPageClicks: row.gscPageClicks ?? 0,
      gscPageImpressions: row.gscPageImpressions ?? 0,
      clicksPercentile: ranks.clicksPercentile,
      impressionsPercentile: ranks.impressionsPercentile,
    };
  });
}

async function compressOneBatch(
  batch: readonly SitemapOptimizerPostRow[],
  allRows: readonly SitemapOptimizerPostRow[],
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<EntityRedirectPlan> {
  const allowedPostIds = batch.map((r) => r.postId);
  const rowById = new Map(batch.map((r) => [r.postId, r]));
  const maxTokens = getCompetitorReportMaxOutputTokens(model);
  const benchmarks = formatGscBenchmarksForPrompt(buildGscSitePerformanceBenchmarks(allRows));
  const catalog = catalogForCompressFamilies(batch, allRows);
  const user = `${benchmarks}

allowedPostIds (${allowedPostIds.length} total — assign every id exactly once across families):
${JSON.stringify(allowedPostIds)}

Coverage requirement: assign all ${allowedPostIds.length} postIds. Max ${SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT} sources per family.
Use each catalog row's groupingKey and neighborhood as hard geo inputs — same place only within a family.

catalog:
${JSON.stringify(catalog, null, 2)}`;

  let plan: EntityRedirectPlan = { families: [] };
  try {
    const { content, finishReason } = await callOpenRouterChatCompletion({
      apiKey,
      model,
      system: COMPRESS_SYSTEM,
      user,
      maxTokens,
      temperature: 0.25,
      responseFormat: { type: "json_object" },
      signal,
    });
    if (finishReason !== "length") {
      const parsed = parseEntityRedirectPlanJson(content ?? "", allowedPostIds, rowById);
      if (parsed?.families.length) plan = parsed;
    }
  } catch {
    // Coverage fill below handles empty plans.
  }

  const geoSafe = splitMixedGeoCompressFamilies(plan, rowById);
  return ensureEntityCompressCoverage(geoSafe, allowedPostIds, rowById);
}

function mergePlans(plans: EntityRedirectPlan[]): EntityRedirectPlan {
  return { families: plans.flatMap((p) => p.families) };
}

/** Stage 2: pack consolidate URLs into redirect families (no titles/meta). Full coverage required. */
export async function runEntityCompressFamiliesAgent(
  consolidateRows: readonly SitemapOptimizerPostRow[],
  apiKey: string,
  options?: {
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
  },
): Promise<EntityRedirectPlan> {
  if (!consolidateRows.length) return { families: [] };

  const model = getResearchModel();
  const rowById = new Map(consolidateRows.map((r) => [r.postId, r]));
  const batches = chunk(consolidateRows, SITEMAP_OPTIMIZER_ENTITY_REDIRECT_PLAN_BATCH_SIZE);
  let completed = 0;
  const total = consolidateRows.length;

  const batchPlans = await mapWithConcurrency(
    batches,
    SITEMAP_OPTIMIZER_ENTITY_COMPRESS_CONCURRENCY,
    async (batch) => {
      const plan = await compressOneBatch(batch, consolidateRows, apiKey, model, options?.signal);
      completed += batch.length;
      options?.onProgress?.(completed, total);
      return plan;
    },
    options?.signal,
  );

  const merged = mergePlans(batchPlans);
  const geoSafe = splitMixedGeoCompressFamilies(merged, rowById);
  return ensureEntityCompressCoverage(
    geoSafe,
    consolidateRows.map((r) => r.postId),
    rowById,
  );
}
