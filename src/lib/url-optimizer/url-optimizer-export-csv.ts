import type { UrlOptimizerResultRow } from "@/lib/url-optimizer/types";

function csvQuote(s: string): string {
  return `"${String(s).replace(/"/g, '""')}"`;
}

function formatCtrForExport(ctr: number): string {
  const pct = ctr * 100;
  if (Number.isInteger(pct) || Math.abs(pct - Math.round(pct)) < 0.001) {
    return `${Math.round(pct)}%`;
  }
  return `${pct.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function formatPositionForExport(position: number): string {
  if (Number.isInteger(position)) return String(position);
  return position.toFixed(2).replace(/\.?0+$/, "");
}

function sortRowsForExport(rows: readonly UrlOptimizerResultRow[]): UrlOptimizerResultRow[] {
  return [...rows].sort((a, b) => {
    const ai = a.csvUploadRow ?? 0;
    const bi = b.csvUploadRow ?? 0;
    if (ai !== bi) return ai - bi;
    return a.page.localeCompare(b.page);
  });
}

/** 1:1 export matching GSC upload shape: Top pages,new_url,Clicks,Impressions,CTR,Position */
export function buildUrlOptimizerExportCsv(rows: readonly UrlOptimizerResultRow[]): string {
  const ordered = sortRowsForExport(rows);
  const lines = ["Top pages,new_url,Clicks,Impressions,CTR,Position"];

  for (const row of ordered) {
    const newUrl = row.proposedUrl?.trim() ?? "";
    lines.push(
      [
        csvQuote(row.page),
        csvQuote(newUrl),
        String(row.clicks),
        String(row.impressions),
        formatCtrForExport(row.ctr),
        formatPositionForExport(row.position),
      ].join(","),
    );
  }

  return lines.join("\n");
}

export function countExportableUrlOptimizerRows(rows: readonly UrlOptimizerResultRow[]): number {
  return sortRowsForExport(rows).filter((row) => row.proposedUrl?.trim()).length;
}
