import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";
import type { SemrushCompetitorRow } from "@/lib/competitor-research/types";

/** Report + competitor table: top N by estimated organic traffic (ties: commonKeywords). */
export const REPORT_MAX_COMPETITORS = 5;

export function topCompetitorRowsByTraffic(rows: SemrushCompetitorRow[], max: number): SemrushCompetitorRow[] {
  return [...rows]
    .sort((a, b) => {
      const ta = a.organicTraffic ?? -1;
      const tb = b.organicTraffic ?? -1;
      if (tb !== ta) return tb - ta;
      return (b.commonKeywords ?? 0) - (a.commonKeywords ?? 0);
    })
    .slice(0, max);
}

/**
 * Sort **only** the traffic-top-N rows by commonKeywords (desc). Remaining rows keep **original** order from `rows`.
 */
export function sortOnlyTopCompetitorsByCommonKeywords(rows: SemrushCompetitorRow[], topN: number): SemrushCompetitorRow[] {
  if (rows.length === 0) return rows;
  const top = topCompetitorRowsByTraffic(rows, topN);
  const topSet = new Set(top.map((r) => normalizeCompetitorDomainKey(r.domain)));
  const topSorted = [...top].sort((a, b) => (b.commonKeywords ?? 0) - (a.commonKeywords ?? 0));
  const rest: SemrushCompetitorRow[] = [];
  for (const r of rows) {
    const k = normalizeCompetitorDomainKey(r.domain);
    if (!topSet.has(k)) rest.push(r);
  }
  return [...topSorted, ...rest];
}
