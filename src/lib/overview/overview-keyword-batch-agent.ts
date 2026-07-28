import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import {
  appendMasterInstructionsToSystemPrompt,
  ensureMasterInstructionsInMemory,
} from "@/lib/master-instructions-storage";
import {
  OVERVIEW_KEYWORD_BATCH_MAX_TOKENS,
  OVERVIEW_KEYWORD_BODY_EXCERPT_MAX,
  OVERVIEW_KEYWORD_FAQ_MAX,
  OVERVIEW_KEYWORD_SEO_BRIEF_MAX,
} from "@/lib/overview/overview-keyword-batch-constants";
import {
  keywordBatchResultsToMap,
  normalizeOverviewKeywordUrlKey,
  parseOverviewKeywordBatchJson,
} from "@/lib/overview/overview-keyword-batch-parse";

export type OverviewKeywordCatalogRow = {
  url: string;
  title: string;
  meta: string;
  faq?: string;
  bodyExcerpt?: string;
  seoResearchBrief?: string;
  pathHint?: string;
};

export type OverviewKeywordBatchAgentOptions = {
  apiKey: string;
  model: string;
  siteId?: string | null;
  napSummary?: string;
  signal?: AbortSignal;
};

const CONTENT_SYSTEM = `You are an expert SEO keyword copywriter.

For EVERY url in allowedUrls you MUST return exactly one result object with that exact url and a focusKeyword.

Hard rules:
- Include every url from allowedUrls exactly once. No omissions.
- focusKeyword: short-tail, intent-only primary SEO / ACF focus keyword.
- 2-5 words (up to 5). Use "vs" not hyphens for comparisons. Spaces only between words.
- When pathHint is present for a row, the keyword MUST stay on that page-path topic.
- seoResearchBrief and bodyExcerpt refine wording only; they must not override pathHint.
- No brand names or site names. No quotes around keywords in JSON.
- Return ONLY valid JSON matching outputSchema (no markdown fences).`;

const ENTITY_SYSTEM = `You are a local SEO entity-optimization specialist.

For EVERY url in allowedUrls you MUST return exactly one result object with that exact url and a focusKeyword.

Hard rules:
- Include every url from allowedUrls exactly once. No omissions.
- focusKeyword: local SEO / ACF focus keyword from URL, title, meta, and NAP.
- Service-area pages: include neighborhood + city + 2-letter province/state when URL encodes sub-city place.
- Single-city: [service] [city] [ST]. Title Case service/place; UPPERCASE ST. Up to 6 words.
- Use NAP context for region when ambiguous. No zip, near me, or brand names.
- Return ONLY valid JSON matching outputSchema (no markdown fences).`;

function trimCatalogField(value: string | undefined, max: number): string | undefined {
  const t = (value ?? "").trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

export function buildContentKeywordCatalogRow(
  row: OverviewKeywordCatalogRow,
): Record<string, string> {
  const out: Record<string, string> = {
    url: row.url.trim(),
    title: (row.title || "").trim() || "(none)",
    meta: (row.meta || "").trim() || "(none)",
  };
  const faq = trimCatalogField(row.faq, OVERVIEW_KEYWORD_FAQ_MAX);
  if (faq) out.faq = faq;
  const body = trimCatalogField(row.bodyExcerpt, OVERVIEW_KEYWORD_BODY_EXCERPT_MAX);
  if (body) out.bodyExcerpt = body;
  const brief = trimCatalogField(row.seoResearchBrief, OVERVIEW_KEYWORD_SEO_BRIEF_MAX);
  if (brief) out.seoResearchBrief = brief;
  const hint = (row.pathHint || "").trim();
  if (hint) out.pathHint = hint;
  return out;
}

export function buildEntityKeywordCatalogRow(
  row: OverviewKeywordCatalogRow,
): Record<string, string> {
  return {
    url: row.url.trim(),
    title: (row.title || "").trim() || "(none)",
    meta: (row.meta || "").trim() || "(none)",
  };
}

async function runKeywordBatch(
  task: "overview_content_focus_keywords" | "overview_entity_focus_keywords",
  catalog: OverviewKeywordCatalogRow[],
  system: string,
  options: OverviewKeywordBatchAgentOptions,
  buildRow: (row: OverviewKeywordCatalogRow) => Record<string, string>,
): Promise<Map<string, string>> {
  if (!catalog.length) return new Map();
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }

  await ensureMasterInstructionsInMemory(options.siteId ?? null);

  const catalogPayload = catalog.map(buildRow);
  const allowedUrls = catalogPayload.map((c) => c.url);

  const user = JSON.stringify({
    task,
    requiredCount: catalog.length,
    allowedUrls,
    napSummary: options.napSummary?.trim() || undefined,
    catalog: catalogPayload,
    outputSchema: {
      results: [{ url: "string (exact from catalog)", focusKeyword: "string" }],
    },
  });

  const systemWithMaster = appendMasterInstructionsToSystemPrompt(system, options.siteId ?? null);

  const { content } = await callOpenRouterChatCompletion({
    apiKey: options.apiKey,
    model: options.model,
    system: systemWithMaster,
    user,
    maxTokens: OVERVIEW_KEYWORD_BATCH_MAX_TOKENS,
    temperature: 0.25,
    responseFormat: { type: "json_object" },
    signal: options.signal,
  });

  const parsed = parseOverviewKeywordBatchJson(content);
  const allowed = new Set(allowedUrls.map(normalizeOverviewKeywordUrlKey));
  const filtered = parsed.filter((r) => allowed.has(normalizeOverviewKeywordUrlKey(r.url)));
  return keywordBatchResultsToMap(filtered);
}

export async function runContentKeywordsBatch(
  catalog: OverviewKeywordCatalogRow[],
  options: OverviewKeywordBatchAgentOptions,
): Promise<Map<string, string>> {
  return runKeywordBatch(
    "overview_content_focus_keywords",
    catalog,
    CONTENT_SYSTEM,
    options,
    buildContentKeywordCatalogRow,
  );
}

export async function runEntityKeywordsBatch(
  catalog: OverviewKeywordCatalogRow[],
  options: OverviewKeywordBatchAgentOptions,
): Promise<Map<string, string>> {
  return runKeywordBatch(
    "overview_entity_focus_keywords",
    catalog,
    ENTITY_SYSTEM,
    options,
    buildEntityKeywordCatalogRow,
  );
}
