import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";
import type {
  CompetitorResearchSemrushResponse,
  TieredCompetitorsResult,
} from "@/lib/competitor-research/types";

export function filterCompetitorResearchBySelection(
  semrush: CompetitorResearchSemrushResponse,
  selectedKeys: Set<string>,
): CompetitorResearchSemrushResponse {
  if (selectedKeys.size === 0) {
    return { ...semrush, rows: [], enrichmentByDomain: {}, domainOrganicCsvByDomain: {} };
  }
  const rows = semrush.rows.filter((r) => selectedKeys.has(normalizeCompetitorDomainKey(r.domain)));
  const enrichmentByDomain = (() => {
    const e = semrush.enrichmentByDomain;
    if (!e) return e;
    const next: typeof e = {};
    for (const [k, v] of Object.entries(e)) {
      if (selectedKeys.has(normalizeCompetitorDomainKey(k))) {
        next[k] = v;
      }
    }
    return next;
  })();
  const domainOrganicCsvByDomain = (() => {
    const c = semrush.domainOrganicCsvByDomain;
    if (!c) return c;
    const next: typeof c = {};
    for (const [k, v] of Object.entries(c)) {
      if (selectedKeys.has(normalizeCompetitorDomainKey(k))) {
        next[k] = v;
      }
    }
    return next;
  })();
  return { ...semrush, rows, enrichmentByDomain, domainOrganicCsvByDomain };
}

export function filterTieredCompetitorsBySelection(
  tiers: TieredCompetitorsResult,
  selectedKeys: Set<string>,
): TieredCompetitorsResult {
  if (selectedKeys.size === 0) {
    return { ...tiers, tiers: [] };
  }
  const nextTiers = tiers.tiers
    .map((g) => ({
      ...g,
      competitors: g.competitors.filter((c) => selectedKeys.has(normalizeCompetitorDomainKey(c.domain))),
    }))
    .filter((g) => g.competitors.length > 0);
  return { ...tiers, tiers: nextTiers };
}
