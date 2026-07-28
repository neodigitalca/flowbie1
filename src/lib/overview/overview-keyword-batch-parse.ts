import { extractFirstBalancedJsonValue } from "@/lib/competitor-research/competitor-report-json-parse";
import { normalizeFocusKeywordPhrase } from "@/lib/seo-redirect-csv";

export type OverviewKeywordBatchResult = {
  url: string;
  focusKeyword: string;
};

function stripMarkdownFence(raw: string): string {
  const t = raw.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1]!.trim() : t;
}

export function normalizeOverviewKeywordUrlKey(url: string): string {
  return url.trim().toLowerCase();
}

function normalizeResultItem(item: unknown): OverviewKeywordBatchResult | null {
  if (!item || typeof item !== "object") return null;
  const p = item as Record<string, unknown>;
  const url =
    (typeof p.url === "string" ? p.url : "") ||
    (typeof p.page === "string" ? p.page : "");
  const kw =
    (typeof p.focusKeyword === "string" ? p.focusKeyword : "") ||
    (typeof p.proposedPrimaryKeyword === "string" ? p.proposedPrimaryKeyword : "") ||
    (typeof p.keyword === "string" ? p.keyword : "");
  const urlTrim = url.trim();
  const kwTrim = kw.trim();
  if (!urlTrim || !kwTrim) return null;
  const normalized = normalizeFocusKeywordPhrase(
    kwTrim.replace(/^["']+|["']+$/g, "").trim(),
  );
  if (!normalized) return null;
  return { url: urlTrim, focusKeyword: normalized };
}

function normalizeResults(list: unknown[]): OverviewKeywordBatchResult[] {
  const out: OverviewKeywordBatchResult[] = [];
  for (const item of list) {
    const row = normalizeResultItem(item);
    if (row) out.push(row);
  }
  return out;
}

export function parseOverviewKeywordBatchJson(content: string): OverviewKeywordBatchResult[] {
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
      const obj = raw as { results?: unknown[]; proposals?: unknown[]; rows?: unknown[] };
      const list = obj.results ?? obj.proposals ?? obj.rows;
      if (Array.isArray(list)) return normalizeResults(list);
    }
  } catch {
    return [];
  }
  return [];
}

export function keywordBatchResultsToMap(
  results: OverviewKeywordBatchResult[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of results) {
    map.set(normalizeOverviewKeywordUrlKey(r.url), r.focusKeyword);
  }
  return map;
}
