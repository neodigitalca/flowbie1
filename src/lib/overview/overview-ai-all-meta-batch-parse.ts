import { extractFirstBalancedJsonValue } from "@/lib/competitor-research/competitor-report-json-parse";
import { parseFaqEntries, serializeFaqEntriesPlain, type FaqEntry } from "@/lib/faq-entries";
import { normalizeOverviewKeywordUrlKey } from "@/lib/overview/overview-keyword-batch-parse";
import type { AiAllMetaCatalogRow } from "@/lib/overview/overview-ai-all-meta-batch-catalog";

export type AiAllMetaBatchRawResult = {
  url: string;
  metaDescription: string;
  title?: string;
  faq?: string;
};

export type AiAllMetaRowPatch = {
  metaDescription: string;
  aiMeta: string;
  title?: string;
  aiTitle?: string;
  faq?: string;
};

function stripMarkdownFence(raw: string): string {
  const t = raw.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1]!.trim() : t;
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFaqPairs(value: unknown): string {
  if (!Array.isArray(value) || !value.length) return "";

  const entries: FaqEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const question = asTrimmedString(row.question);
    const answer = asTrimmedString(row.answer);
    if (question) entries.push({ question, answer });
  }

  return entries.length ? serializeFaqEntriesPlain(entries) : "";
}

function normalizeResultItem(item: unknown): AiAllMetaBatchRawResult | null {
  if (!item || typeof item !== "object") return null;
  const p = item as Record<string, unknown>;
  const url = asTrimmedString(p.url) || asTrimmedString(p.page);
  const metaDescription =
    asTrimmedString(p.metaDescription) ||
    asTrimmedString(p.meta) ||
    asTrimmedString(p.description);
  if (!url || !metaDescription) return null;
  const title = asTrimmedString(p.title);
  const faq = normalizeFaqPairs(p.faqPairs) || asTrimmedString(p.faq);
  return {
    url,
    metaDescription,
    ...(title ? { title } : {}),
    ...(faq ? { faq } : {}),
  };
}

function normalizeResults(list: unknown[]): AiAllMetaBatchRawResult[] {
  const out: AiAllMetaBatchRawResult[] = [];
  for (const item of list) {
    const row = normalizeResultItem(item);
    if (row) out.push(row);
  }
  return out;
}

export function parseAiAllMetaBatchJson(content: string): AiAllMetaBatchRawResult[] {
  const trimmed = stripMarkdownFence(content ?? "");
  if (!trimmed) return [];

  const jsonSlice = extractFirstBalancedJsonValue(trimmed) ?? trimmed;
  if (!jsonSlice.trim()) return [];

  try {
    const raw = JSON.parse(jsonSlice) as unknown;
    if (Array.isArray(raw)) {
      return normalizeResults(raw);
    }
    if (raw && typeof raw === "object") {
      const obj = raw as { results?: unknown[]; rows?: unknown[] };
      const list = obj.results ?? obj.rows;
      if (Array.isArray(list)) return normalizeResults(list);
    }
  } catch {
    return [];
  }
  return [];
}

export function aiAllMetaBatchResultsToMap(
  results: AiAllMetaBatchRawResult[],
  catalogByUrl: Map<string, AiAllMetaCatalogRow>,
): Map<string, AiAllMetaRowPatch> {
  const map = new Map<string, AiAllMetaRowPatch>();
  for (const r of results) {
    const key = normalizeOverviewKeywordUrlKey(r.url);
    const catalog = catalogByUrl.get(key);
    if (!catalog) continue;

    const metaDescription = r.metaDescription.trim();
    const patch: AiAllMetaRowPatch = {
      metaDescription,
      aiMeta: metaDescription,
    };

    if (catalog.includeTitle && r.title?.trim()) {
      const title = r.title.trim();
      patch.title = title;
      patch.aiTitle = title;
    }

    map.set(key, patch);
  }
  return map;
}
