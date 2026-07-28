import type { CompetitorKeywordRow } from "@/lib/competitor-research/types";

/** Matches server `DOMAIN_ORGANIC_CSV_TOP_ROWS` - top phrases by traffic for CSV + OpenRouter (capped when building CSV). */
export const DOMAIN_ORGANIC_CSV_TOP_ROWS = 25;

function escapeCsvCell(cell: string): string {
  const t = String(cell ?? "");
  if (/[",\r\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function csvMetricWhole(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(Math.round(n));
}

/** Same column layout as Semrush `domain_organic` CSV exports from the server. */
export function buildDomainOrganicCsvFromKeywordRows(
  rows: CompetitorKeywordRow[],
  limit = DOMAIN_ORGANIC_CSV_TOP_ROWS,
): string {
  const lim = Math.min(Math.max(1, limit), 100);
  const slice = Array.isArray(rows) ? rows.slice(0, lim) : [];
  const lines = ["Keyword,Volume,Traffic,Position"];
  for (const k of slice) {
    const phrase = (k.phrase ?? "").trim();
    if (!phrase) continue;
    const vol = csvMetricWhole(k.volume);
    const tr = csvMetricWhole(k.traffic);
    const pos = csvMetricWhole(k.position);
    lines.push([escapeCsvCell(phrase), escapeCsvCell(vol), escapeCsvCell(tr), escapeCsvCell(pos)].join(","));
  }
  return `${lines.join("\n")}\n`;
}
