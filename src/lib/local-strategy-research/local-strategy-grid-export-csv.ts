import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";
import type {
  CompetitorResearchSemrushResponse,
  TieredCompetitorsResult,
} from "@/lib/competitor-research/types";
import { escapeCsvCell } from "@/lib/local-strategy-research/local-strategy-csv-utils";

/** Map domain key → tier label from AI tiers (first match). */
function tierLabelForDomain(
  domainKey: string,
  tiers: TieredCompetitorsResult | null,
): string {
  if (!tiers?.tiers?.length) return "";
  for (const g of tiers.tiers) {
    for (const c of g.competitors) {
      if (normalizeCompetitorDomainKey(c.domain) === domainKey) {
        return `${g.tier}: ${g.label}`;
      }
    }
  }
  return "";
}

/**
 * Export competitors in a Local Dominator–friendly grid CSV (Rank + domain-centric columns).
 * Place ID / cid are not stored from DFS-only organic runs - leave empty or fill from a future grid import.
 */
export function buildLocalStrategyGridExportCsv(args: {
  semrush: CompetitorResearchSemrushResponse;
  tiers: TieredCompetitorsResult | null;
}): string {
  const rows = [...(args.semrush.rows ?? [])].sort(
    (a, b) => (b.organicTraffic ?? 0) - (a.organicTraffic ?? 0),
  );
  const header = [
    "Rank",
    "Business Name",
    "Domain",
    "Place ID",
    "Google Maps URL",
    "Organic Traffic",
    "Organic Keywords",
    "Traffic Value",
    "Tier",
  ];
  const lines = [header.map(escapeCsvCell).join(",")];
  let rank = 1;
  const enrichment = args.semrush.enrichmentByDomain ?? {};
  for (const r of rows) {
    const dk = normalizeCompetitorDomainKey(r.domain);
    const enr = enrichment[dk] ?? enrichment[r.domain];
    const business = (enr?.pageTitle || enr?.topPageUrl || dk).trim();
    lines.push(
      [
        String(rank++),
        escapeCsvCell(business),
        escapeCsvCell(dk),
        "", // Place ID - add manually or re-export from Local Dominator
        "", // Maps URL
        escapeCsvCell(String(r.organicTraffic ?? "")),
        escapeCsvCell(String(r.organicKeywords ?? "")),
        escapeCsvCell(String(r.trafficCost ?? "")),
        escapeCsvCell(tierLabelForDomain(dk, args.tiers)),
      ].join(","),
    );
  }
  return lines.join("\r\n");
}
