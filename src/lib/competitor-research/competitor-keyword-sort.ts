import type { CompetitorDomainEnrichment, CompetitorKeywordRow, CompetitorResearchSemrushResponse } from "@/lib/competitor-research/types";

/** Highest volume first (surfaces head non-brand terms); then traffic; then phrase. */
export function sortKeywordsByVolumeThenTraffic(rows: CompetitorKeywordRow[]): CompetitorKeywordRow[] {
  return [...rows].sort((a, b) => {
    const va = a.volume ?? Number.NEGATIVE_INFINITY;
    const vb = b.volume ?? Number.NEGATIVE_INFINITY;
    if (vb !== va) return vb - va;
    const ta = a.traffic;
    const tb = b.traffic;
    const hasA = ta != null && Number.isFinite(ta);
    const hasB = tb != null && Number.isFinite(tb);
    if (hasA && hasB && tb !== ta) return tb - ta;
    if (hasA && !hasB) return -1;
    if (!hasA && hasB) return 1;
    return (a.phrase || "").localeCompare(b.phrase || "");
  });
}

/** Highest traffic first; null traffic after numeric; then volume; then phrase. */
export function sortKeywordsByTrafficThenVolume(rows: CompetitorKeywordRow[]): CompetitorKeywordRow[] {
  return [...rows].sort((a, b) => {
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

export function enrichmentSortedByTopTraffic(
  enrichment: CompetitorResearchSemrushResponse["enrichmentByDomain"],
): CompetitorResearchSemrushResponse["enrichmentByDomain"] {
  if (!enrichment) return enrichment;
  const out: Record<string, CompetitorDomainEnrichment> = {};
  for (const [domain, enr] of Object.entries(enrichment)) {
    out[domain] = {
      ...enr,
      topKeywords: sortKeywordsByTrafficThenVolume(enr.topKeywords ?? []),
    };
  }
  return out;
}

/** Report wire: when no seed+GSC anchor relevance sort, prefer volume so informational/transactional head terms lead. */
export function enrichmentTopKeywordsVolumeFirst(
  enrichment: CompetitorResearchSemrushResponse["enrichmentByDomain"],
): CompetitorResearchSemrushResponse["enrichmentByDomain"] {
  if (!enrichment) return enrichment;
  const out: Record<string, CompetitorDomainEnrichment> = {};
  for (const [domain, enr] of Object.entries(enrichment)) {
    out[domain] = {
      ...enr,
      topKeywords: sortKeywordsByVolumeThenTraffic(enr.topKeywords ?? []),
    };
  }
  return out;
}
