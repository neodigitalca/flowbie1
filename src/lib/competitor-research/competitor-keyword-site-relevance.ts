import type {
  CompetitorKeywordRow,
  CompetitorResearchSemrushResponse,
  GscSiteQueryRow,
} from "@/lib/competitor-research/types";
import { sortKeywordsByTrafficThenVolume } from "@/lib/competitor-research/competitor-keyword-sort";

const MIN_TOKEN_LEN = 3;

export function tokenizeForSiteRelevance(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= MIN_TOKEN_LEN);
}

/**
 * Tokens from the connected site's seed keywords + GSC queries (+ seed hostname).
 * Used to drop competitor enrichment phrases that are off-topic vs the client's demand.
 */
export function buildSiteRelevanceTokenSet(
  semrush: CompetitorResearchSemrushResponse,
  gscQueries?: GscSiteQueryRow[] | null,
): Set<string> {
  const tokens = new Set<string>();
  for (const k of semrush.seedTopKeywords ?? []) {
    for (const t of tokenizeForSiteRelevance(k.phrase || "")) tokens.add(t);
  }
  for (const q of gscQueries ?? []) {
    for (const t of tokenizeForSiteRelevance(q.query || "")) tokens.add(t);
  }
  const host = (semrush.seedDomain || "").replace(/^www\./, "").split(".")[0] || "";
  const splitBrand = host.replace(/([a-z])([A-Z])/g, "$1 $2");
  for (const t of tokenizeForSiteRelevance(splitBrand)) tokens.add(t);
  return tokens;
}

/** Token overlap + substring match on longer reference tokens. */
export function phraseSiteRelevanceScore(phrase: string, tokens: Set<string>): number {
  if (tokens.size === 0) return 1;
  const p = phrase.toLowerCase();
  if (p.length < 2) return 0;
  let score = 0;
  for (const t of tokenizeForSiteRelevance(phrase)) {
    if (tokens.has(t)) score += 3;
  }
  for (const t of tokens) {
    if (t.length >= 4 && p.includes(t)) score += 2;
  }
  return score;
}

/** When anchor tokens exist: relevance score first, then traffic/volume (same tie-break as sortKeywordsByTrafficThenVolume). */
export function sortKeywordsByRelevanceThenTraffic(
  rows: CompetitorKeywordRow[],
  tokens: Set<string>,
): CompetitorKeywordRow[] {
  if (tokens.size === 0) return sortKeywordsByTrafficThenVolume(rows);
  return [...rows].sort((a, b) => {
    const ra = phraseSiteRelevanceScore(a.phrase || "", tokens);
    const rb = phraseSiteRelevanceScore(b.phrase || "", tokens);
    if (rb !== ra) return rb - ra;
    const ta = a.traffic;
    const tb = b.traffic;
    const hasA = ta != null && Number.isFinite(ta);
    const hasB = tb != null && Number.isFinite(tb);
    if (hasA && hasB && tb !== ta) return tb - ta;
    if (hasA && !hasB) return -1;
    if (!hasA && hasB) return 1;
    const va = a.volume ?? Number.NEGATIVE_INFINITY;
    const vb = b.volume ?? Number.NEGATIVE_INFINITY;
    if (vb !== va) return vb - va;
    return (a.phrase || "").localeCompare(b.phrase || "");
  });
}

export function filterCompetitorKeywordRowsBySiteRelevance(
  rows: CompetitorKeywordRow[],
  tokens: Set<string>,
): CompetitorKeywordRow[] {
  if (tokens.size === 0) return sortKeywordsByTrafficThenVolume(rows);
  const kept = rows.filter((r) => phraseSiteRelevanceScore(r.phrase || "", tokens) > 0);
  return sortKeywordsByRelevanceThenTraffic(kept, tokens);
}

/** Drops competitor domains whose keywords do not align when anchor tokens exist. */
export function filterEnrichmentBySiteRelevance(
  enrichment: CompetitorResearchSemrushResponse["enrichmentByDomain"],
  semrush: CompetitorResearchSemrushResponse,
  gscQueries?: GscSiteQueryRow[] | null,
): CompetitorResearchSemrushResponse["enrichmentByDomain"] {
  if (!enrichment) return enrichment;
  const tokens = buildSiteRelevanceTokenSet(semrush, gscQueries);
  if (tokens.size === 0) return enrichment;

  const out: NonNullable<typeof enrichment> = {};
  for (const [domain, enr] of Object.entries(enrichment)) {
    const top = filterCompetitorKeywordRowsBySiteRelevance(enr.topKeywords ?? [], tokens);
    if (top.length > 0) {
      out[domain] = { ...enr, topKeywords: top };
    }
  }
  return out;
}
