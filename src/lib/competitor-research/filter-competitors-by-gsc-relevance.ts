import type { CompetitorResearchSemrushResponse, GscSiteQueryRow, SemrushCompetitorRow } from "@/lib/competitor-research/types";
import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";

const GSC_QUERY_CAP = 150;
const MIN_TOKEN_LEN = 3;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= MIN_TOKEN_LEN);
}

function enrichmentForDomain(
  domain: string,
  enrichmentByDomain: CompetitorResearchSemrushResponse["enrichmentByDomain"],
): { topKeywords: { phrase: string }[] } | undefined {
  if (!enrichmentByDomain) return undefined;
  const key = normalizeCompetitorDomainKey(domain);
  for (const [k, v] of Object.entries(enrichmentByDomain)) {
    if (normalizeCompetitorDomainKey(k) === key) return v;
  }
  return undefined;
}

function scoreRow(row: SemrushCompetitorRow, enrichmentByDomain: CompetitorResearchSemrushResponse["enrichmentByDomain"], gscRanked: GscSiteQueryRow[]): number {
  const enr = enrichmentForDomain(row.domain, enrichmentByDomain);
  const phrases = (enr?.topKeywords ?? []).map((p) => p.phrase).filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  if (!phrases.length) return 0;

  const phraseTokens = new Set<string>();
  for (const p of phrases) {
    for (const t of tokenize(p)) phraseTokens.add(t);
  }
  if (phraseTokens.size === 0) return 0;

  let total = 0;
  for (const q of gscRanked) {
    const qt = tokenize(q.query);
    for (const t of qt) {
      if (phraseTokens.has(t)) total += 1;
    }
  }
  return total;
}

/**
 * Re-orders and optionally drops weak overlap rows using GSC query × competitor keyword token overlap.
 * No-op when GSC is empty or when no row scores above zero.
 */
export function filterCompetitorsByGscRelevance(
  input: CompetitorResearchSemrushResponse,
  gscQueries: GscSiteQueryRow[],
): CompetitorResearchSemrushResponse {
  if (!gscQueries.length || !input.rows.length) return input;

  const gscRanked = [...gscQueries]
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, GSC_QUERY_CAP);

  const n = input.rows.length;
  const minKeep = Math.min(3, n);

  const scored = input.rows.map((row) => ({
    row,
    score: scoreRow(row, input.enrichmentByDomain, gscRanked),
    common: row.commonKeywords ?? 0,
  }));

  const maxScore = Math.max(...scored.map((s) => s.score), 0);
  if (maxScore <= 0) return input;

  const positive = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (b.common ?? 0) - (a.common ?? 0));
  const zero = scored
    .filter((s) => s.score <= 0)
    .sort((a, b) => (b.common ?? 0) - (a.common ?? 0));

  const picked: typeof scored = [...positive];
  if (picked.length < minKeep) {
    for (const z of zero) {
      if (picked.length >= minKeep) break;
      picked.push(z);
    }
  }

  const keptKeys = new Set(picked.map((p) => normalizeCompetitorDomainKey(p.row.domain)));
  const rows = picked.map((p) => p.row);

  const enrichmentByDomain = (() => {
    const e = input.enrichmentByDomain;
    if (!e || Object.keys(e).length === 0) return e;
    const next: typeof e = {};
    for (const [k, v] of Object.entries(e)) {
      if (keptKeys.has(normalizeCompetitorDomainKey(k))) next[k] = v;
    }
    return next;
  })();

  return {
    ...input,
    rows,
    enrichmentByDomain,
  };
}
