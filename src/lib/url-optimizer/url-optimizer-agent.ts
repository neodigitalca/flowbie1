import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import {
  URL_OPTIMIZER_AGENT_BATCH_SIZE,
  URL_OPTIMIZER_AGENT_CONCURRENCY,
  URL_OPTIMIZER_AGENT_MAX_RETRIES,
  URL_OPTIMIZER_AGENT_MAX_TOKENS,
} from "@/lib/url-optimizer/constants";
import {
  buildOptimizedUrl,
  deterministicKeywordFromRow,
  urlsDiffer,
} from "@/lib/url-optimizer/build-optimized-url";
import { parseUrlOptimizerAgentBatchJson } from "@/lib/url-optimizer/url-optimizer-parse";
import type {
  UrlOptimizerAgentProposal,
  UrlOptimizerContentRow,
  UrlOptimizerResultRow,
} from "@/lib/url-optimizer/types";

const URL_OPTIMIZER_SYSTEM = `You are a senior SEO strategist optimizing WordPress blog URL slugs.

For EVERY page URL in allowedPages you MUST return exactly one proposal object.

Hard rules:
- Include every page from allowedPages exactly once. No omissions.
- proposedPrimaryKeyword: required, 2-4 word focus phrase reflecting the page's actual content and search intent (read title, meta, body excerpt).
- The optimized URL will be placed under /blog/ with a short slug derived from the keyword (3-5 words, max ~48 chars).
- Do NOT preserve legacy /YYYY/MM/DD/ date paths — the destination is always /blog/{short-slug}/ on the same domain.
- rationale: one short sentence explaining the slug improvement.
- Return ONLY valid JSON (no markdown fences).`;

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  signal?: AbortSignal,
  onItemDone?: (completed: number, total: number) => void,
): Promise<R[]> {
  const n = items.length;
  const ret: R[] = new Array(n);
  let next = 0;
  let finished = 0;
  async function worker(): Promise<void> {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const idx = next++;
      if (idx >= n) return;
      ret[idx] = await fn(items[idx]!);
      finished += 1;
      onItemDone?.(finished, n);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), n);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return ret;
}

function chunkRows(rows: UrlOptimizerContentRow[], size: number): UrlOptimizerContentRow[][] {
  const batches: UrlOptimizerContentRow[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    batches.push(rows.slice(i, i + size));
  }
  return batches;
}

function normalizePageKey(url: string): string {
  return url.trim().toLowerCase();
}

async function optimizeOneBatch(
  batch: UrlOptimizerContentRow[],
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<UrlOptimizerAgentProposal[]> {
  const catalog = batch.map((row) => ({
    page: row.page,
    title: row.title,
    meta: row.meta,
    bodyExcerpt: row.bodyExcerpt,
    focusKeyword: row.focusKeyword ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    position: row.position,
  }));

  const user = JSON.stringify({
    task: "url_slug_optimizer",
    requiredCount: catalog.length,
    allowedPages: catalog.map((c) => c.page),
    catalog,
    outputSchema: {
      proposals: [
        {
          page: "string (exact URL from catalog)",
          proposedPrimaryKeyword: "string",
          rationale: "string",
        },
      ],
    },
  });

  try {
    const { content } = await callOpenRouterChatCompletion({
      apiKey,
      model,
      system: URL_OPTIMIZER_SYSTEM,
      user,
      maxTokens: URL_OPTIMIZER_AGENT_MAX_TOKENS,
      temperature: 0.25,
      responseFormat: { type: "json_object" },
      signal,
    });

    const parsed = parseUrlOptimizerAgentBatchJson(content);
    const allowed = new Set(catalog.map((c) => normalizePageKey(c.page)));
    const byPage = new Map<string, UrlOptimizerAgentProposal>();
    for (const p of parsed) {
      const key = normalizePageKey(p.page);
      if (!allowed.has(key)) continue;
      byPage.set(key, {
        page: p.page.trim(),
        proposedPrimaryKeyword: p.proposedPrimaryKeyword.trim(),
        rationale: (p.rationale ?? "").trim(),
      });
    }
    return [...byPage.values()];
  } catch {
    return [];
  }
}

function applyProposalToRow(
  row: UrlOptimizerContentRow,
  proposal: UrlOptimizerAgentProposal | null,
): UrlOptimizerResultRow {
  const keyword = proposal?.proposedPrimaryKeyword.trim() || deterministicKeywordFromRow(row);
  const title = row.title.trim() || keyword;
  const proposedUrl = buildOptimizedUrl(row.page, keyword, title);

  if (!proposedUrl) {
    return {
      ...row,
      proposedKeyword: keyword,
      status: "error",
      skipReason: "Could not build optimized URL",
      rationale: proposal?.rationale,
    };
  }

  if (!urlsDiffer(row.page, proposedUrl)) {
    return {
      ...row,
      proposedKeyword: keyword,
      proposedUrl,
      status: "unchanged",
      rationale: proposal?.rationale ?? "Slug already optimal",
    };
  }

  return {
    ...row,
    proposedKeyword: keyword,
    proposedUrl,
    status: "optimized",
    rationale: proposal?.rationale ?? "AI-optimized slug",
  };
}

export async function runUrlOptimizerAgent(
  rows: UrlOptimizerContentRow[],
  apiKey: string,
  signal?: AbortSignal,
  onProgress?: (completed: number, total: number, detail?: string) => void,
): Promise<UrlOptimizerResultRow[]> {
  const resolvedRows = rows.filter((r) => r.contentStatus === "resolved");
  const unresolvedRows: UrlOptimizerResultRow[] = rows
    .filter((r) => r.contentStatus === "unresolved")
    .map((r) => ({ ...r, status: "unresolved" as const, skipReason: "Could not resolve URL in WordPress" }));

  if (!resolvedRows.length) {
    return unresolvedRows;
  }

  const model = getResearchModel();
  const byPage = new Map<string, UrlOptimizerAgentProposal>();
  let missing = [...resolvedRows];
  let batchSize = URL_OPTIMIZER_AGENT_BATCH_SIZE;
  let attempt = 0;

  while (missing.length > 0 && attempt < URL_OPTIMIZER_AGENT_MAX_RETRIES) {
    const effectiveBatchSize = missing.length <= 3 ? 1 : batchSize;
    const batches = chunkRows(missing, effectiveBatchSize);
    let batchesStarted = 0;

    await mapWithConcurrency(
      batches,
      URL_OPTIMIZER_AGENT_CONCURRENCY,
      async (batch) => {
        const batchNum = ++batchesStarted;
        onProgress?.(
          byPage.size,
          resolvedRows.length,
          `Batch ${batchNum} / ${batches.length} (${batch.length} URLs)`,
        );
        const part = await optimizeOneBatch(batch, apiKey, model, signal);
        for (const p of part) byPage.set(normalizePageKey(p.page), p);
        onProgress?.(byPage.size, resolvedRows.length, `Proposals ${byPage.size} / ${resolvedRows.length}`);
        return part;
      },
      signal,
    );

    missing = resolvedRows.filter((r) => !byPage.has(normalizePageKey(r.page)));
    attempt += 1;
    if (missing.length > 0 && batchSize > 4) {
      batchSize = Math.max(4, Math.floor(batchSize / 2));
    }
  }

  const optimized = resolvedRows.map((row) => {
    const proposal = byPage.get(normalizePageKey(row.page)) ?? null;
    return applyProposalToRow(row, proposal);
  });

  onProgress?.(resolvedRows.length, resolvedRows.length);
  return [...optimized, ...unresolvedRows].sort((a, b) => {
    const ai = a.csvUploadRow ?? 0;
    const bi = b.csvUploadRow ?? 0;
    if (ai !== bi) return ai - bi;
    return a.page.localeCompare(b.page);
  });
}

export function buildUrlOptimizerStats(rows: readonly UrlOptimizerResultRow[]) {
  return {
    total: rows.length,
    resolved: rows.filter((r) => r.status !== "unresolved").length,
    unresolved: rows.filter((r) => r.status === "unresolved").length,
    changed: rows.filter((r) => r.status === "optimized").length,
    unchanged: rows.filter((r) => r.status === "unchanged").length,
    errors: rows.filter((r) => r.status === "error").length,
  };
}
