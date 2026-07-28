import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { urlPathTail } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import {
  buildGscSitePerformanceBenchmarks,
  formatGscBenchmarksForPrompt,
  gscRowPerformanceRanks,
  type GscSitePerformanceBenchmarks,
} from "@/lib/sitemap-optimizer/gsc-site-performance-benchmarks";
import {
  parseGscPerformanceTriageJson,
  type GscPerformanceDisposition,
  type ParsedGscTriageDecision,
} from "@/lib/sitemap-optimizer/gsc-performance-triage-parse";
import { SITEMAP_OPTIMIZER_GSC_TOP_QUERIES } from "@/lib/sitemap-optimizer/constants";
import { daysSincePublish } from "@/lib/sitemap-optimizer/content-maturity-gate";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const TRIAGE_BATCH_SIZE = 40;
const TRIAGE_CONCURRENCY = 3;

const TRIAGE_SYSTEM = `You are a senior SEO strategist triaging URLs using Google Search Console performance relative to the rest of the site.

Return ONLY valid JSON (no markdown fences):
{ "decisions": [ { "postId": "...", "disposition": "keep" | "consolidate", "rationale": "...", "confidence": "high" | "medium" | "low" } ] }

Rules:
- Compare each URL to SITE medians and percentiles, not fixed click thresholds.
- disposition "keep": meaningful relative traffic, strong CTR/position for its niche, or strategic geo coverage worth preserving.
- disposition "consolidate": zero or weak impressions/clicks vs site peers, thin local duplicates, clear underperformers, cannibalization candidates.
- Every allowedPostId must appear exactly once in decisions.
- Copy postId character-for-character from the catalog.`;

const ENTITY_TRIAGE_SYSTEM = `You are a senior SEO strategist triaging service-area URLs using Google Search Console performance relative to the rest of the site.

Return ONLY valid JSON (no markdown fences):
{ "decisions": [ { "postId": "...", "disposition": "keep" | "consolidate", "rationale": "...", "confidence": "high" | "medium" | "low" } ] }

Rules:
- Compare each URL to SITE medians and percentiles, not fixed click thresholds.
- disposition "keep" ONLY when the URL has meaningful relative clicks vs site peers (above bottom quartile on clicks; prefer above median when peers have traffic). Strong CTR/position may support keep only when clicks are also not in the bottom quartile.
- Do NOT keep for strategic geo coverage alone. City coverage is not a keep reason.
- disposition "consolidate" for zero clicks, bottom-quartile clicks OR impressions, thin local duplicates, underperformers, and cannibalization candidates.
- Every allowedPostId must appear exactly once as keep or consolidate. Non-keep URLs must consolidate.
- Copy postId character-for-character from the catalog.`;

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
  fn: (item: T) => Promise<R>,
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
      ret[idx] = await fn(items[idx]!);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), n);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return ret;
}

function catalogEntryForTriage(
  row: SitemapOptimizerPostRow,
  allRows: readonly SitemapOptimizerPostRow[],
  analyzedAt?: string,
) {
  const ranks = gscRowPerformanceRanks(row, allRows);
  return {
    postId: row.postId,
    url: row.url,
    urlPathTail: urlPathTail(row.url),
    title: row.title,
    collection: row.collection,
    publishedAtGmt: row.publishedAtGmt ?? "",
    daysSincePublish: analyzedAt ? daysSincePublish(row.publishedAtGmt, analyzedAt) : null,
    gscPageClicks: row.gscPageClicks ?? 0,
    gscPageImpressions: row.gscPageImpressions ?? 0,
    gscPageCtr: row.gscPageCtr ?? 0,
    gscPagePosition: row.gscPagePosition ?? 0,
    clicksPercentile: ranks.clicksPercentile,
    impressionsPercentile: ranks.impressionsPercentile,
    topQueries: row.gscQueries.slice(0, SITEMAP_OPTIMIZER_GSC_TOP_QUERIES).map((q) => q.query),
  };
}

function deterministicFallbackTriage(
  rows: readonly SitemapOptimizerPostRow[],
  benchmarks: GscSitePerformanceBenchmarks,
  entityMode?: boolean,
): ParsedGscTriageDecision[] {
  return rows.map((row) => {
    const clicks = row.gscPageClicks ?? 0;
    const impressions = row.gscPageImpressions ?? 0;
    const consolidate = entityMode
      ? clicks <= benchmarks.p25Clicks || impressions <= benchmarks.p25Impressions
      : clicks <= benchmarks.p25Clicks && impressions <= benchmarks.p25Impressions;
    return {
      postId: row.postId,
      disposition: consolidate ? "consolidate" : "keep",
      rationale: consolidate
        ? entityMode
          ? "Fallback (entity): clicks or impressions at or below site p25."
          : "Fallback: clicks and impressions at or below site p25."
        : entityMode
          ? "Fallback (entity): above site p25 on both clicks and impressions."
          : "Fallback: above site p25 on clicks or impressions.",
      confidence: "low" as const,
    };
  });
}

async function triageOneBatch(
  batch: SitemapOptimizerPostRow[],
  allRows: readonly SitemapOptimizerPostRow[],
  benchmarks: GscSitePerformanceBenchmarks,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
  options?: { entityMode?: boolean; analyzedAt?: string },
): Promise<ParsedGscTriageDecision[]> {
  const allowedPostIds = batch.map((r) => r.postId);
  const catalog = batch.map((row) =>
    catalogEntryForTriage(row, allRows, options?.analyzedAt),
  );
  const baseUser = `${formatGscBenchmarksForPrompt(benchmarks)}

allowedPostIds: ${JSON.stringify(allowedPostIds)}

catalog:
${JSON.stringify(catalog, null, 2)}`;

  const entityMode = options?.entityMode === true;

  try {
    const maxTokens = getCompetitorReportMaxOutputTokens(model);
    const { content } = await callOpenRouterChatCompletion({
      apiKey,
      model,
      system: entityMode ? ENTITY_TRIAGE_SYSTEM : TRIAGE_SYSTEM,
      user: baseUser,
      maxTokens,
      temperature: 0.35,
      responseFormat: entityMode ? { type: "json_object" } : undefined,
      signal,
    });
    const parsed = parseGscPerformanceTriageJson(content ?? "", allowedPostIds);
    if (parsed.length > 0) {
      return parsed;
    }
  } catch {
    // OpenRouter errors: continue with deterministic triage for this batch.
  }

  return deterministicFallbackTriage(batch, benchmarks, entityMode);
}

export type GscPerformanceTriageResult = {
  rows: SitemapOptimizerPostRow[];
  keepRows: SitemapOptimizerPostRow[];
  consolidateRows: SitemapOptimizerPostRow[];
  benchmarks: GscSitePerformanceBenchmarks;
};

export async function runGscPerformanceTriage(
  rows: readonly SitemapOptimizerPostRow[],
  apiKey: string,
  options?: {
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
    entityMode?: boolean;
    analyzedAt?: string;
  },
): Promise<GscPerformanceTriageResult> {
  if (!rows.length) {
    const emptyBenchmarks = buildGscSitePerformanceBenchmarks([]);
    return { rows: [], keepRows: [], consolidateRows: [], benchmarks: emptyBenchmarks };
  }

  const benchmarks = buildGscSitePerformanceBenchmarks(rows);
  const model = getResearchModel();
  const batches = chunk(rows, TRIAGE_BATCH_SIZE);
  let completed = 0;
  const total = rows.length;

  const batchResults = await mapWithConcurrency(
    batches,
    TRIAGE_CONCURRENCY,
    async (batch) => {
      const decisions = await triageOneBatch(
        batch,
        rows,
        benchmarks,
        apiKey,
        model,
        options?.signal,
        { entityMode: options?.entityMode, analyzedAt: options?.analyzedAt },
      );
      completed += batch.length;
      options?.onProgress?.(completed, total);
      return decisions;
    },
    options?.signal,
  );

  const decisionByPostId = new Map<string, ParsedGscTriageDecision>();
  for (const batch of batchResults) {
    for (const d of batch) {
      decisionByPostId.set(d.postId, d);
    }
  }

  const triagedRows: SitemapOptimizerPostRow[] = [];
  const keepRows: SitemapOptimizerPostRow[] = [];
  const consolidateRows: SitemapOptimizerPostRow[] = [];

  for (const row of rows) {
    const decision = decisionByPostId.get(row.postId);
    if (!decision) {
      applyDecision(
        row,
        deterministicFallbackTriage([row], benchmarks, options?.entityMode)[0]!,
        triagedRows,
        keepRows,
        consolidateRows,
      );
      continue;
    }
    applyDecision(row, decision, triagedRows, keepRows, consolidateRows);
  }

  return { rows: triagedRows, keepRows, consolidateRows, benchmarks };
}

function applyDecision(
  row: SitemapOptimizerPostRow,
  decision: ParsedGscTriageDecision,
  triagedRows: SitemapOptimizerPostRow[],
  keepRows: SitemapOptimizerPostRow[],
  consolidateRows: SitemapOptimizerPostRow[],
): void {
  const disposition: GscPerformanceDisposition = decision.disposition;
  const updated: SitemapOptimizerPostRow = {
    ...row,
    gscDisposition: disposition,
    gscTriageRationale: decision.rationale,
  };
  triagedRows.push(updated);
  if (disposition === "keep") keepRows.push(updated);
  else consolidateRows.push(updated);
}

export function splitRowsByGscDisposition(rows: readonly SitemapOptimizerPostRow[]): {
  keepRows: SitemapOptimizerPostRow[];
  consolidateRows: SitemapOptimizerPostRow[];
} {
  const keepRows: SitemapOptimizerPostRow[] = [];
  const consolidateRows: SitemapOptimizerPostRow[] = [];
  for (const row of rows) {
    if (row.gscDisposition === "keep") keepRows.push(row);
    else consolidateRows.push(row);
  }
  return { keepRows, consolidateRows };
}
