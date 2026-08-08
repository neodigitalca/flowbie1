import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { stripPipeBrandSuffixFromTitle } from "@/lib/sap-title-pipe-brand";
import { replaceTemplateVariables } from "@/components/integrations/entity-generation/csv/csvGenerator";

export interface CompetitorBulkRowOptions {
  titleFormat: string;
  keyword: string;
  siteName?: string;
}

export function buildCompetitorBulkRows(
  rows: CSVRow[],
  options: CompetitorBulkRowOptions,
): CSVRow[] {
  const kw = options.keyword.trim();
  if (!kw) {
    throw new Error("Keyword is required to build competitor bulk rows.");
  }

  return rows.map((row) => {
    const entity = row.entity ?? "";
    let title = row.title?.trim() ?? "";
    if (!title && options.titleFormat.trim()) {
      title = replaceTemplateVariables(options.titleFormat, entity, kw);
      title = stripPipeBrandSuffixFromTitle(title, options.siteName);
    }
    if (!title) {
      throw new Error(`Missing title for competitor row: ${entity || "(no entity)"}`);
    }
    const keyword = row.keyword?.trim() ?? "";
    if (!keyword) {
      throw new Error(`Missing keyword for competitor row: ${entity || "(no entity)"}`);
    }
    return {
      keyword,
      entity,
      title,
      modifier: row.modifier,
      featuredImage: row.featuredImage ?? "n",
    };
  });
}

export function competitorRowsToCsvContent(rows: CSVRow[]): string {
  const headers = ["keyword", "entity", "title", "modifier", "featuredImage"];
  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.keyword ? `"${row.keyword.replace(/"/g, '""')}"` : "",
        `"${(row.entity ?? "").replace(/"/g, '""')}"`,
        `"${(row.title ?? "").replace(/"/g, '""')}"`,
        row.modifier ? `"${String(row.modifier).replace(/"/g, '""')}"` : "",
        row.featuredImage ?? "n",
      ].join(","),
    ),
  ].join("\n");
}

export function downloadCompetitorCsv(rows: CSVRow[], siteName: string): void {
  const blob = new Blob([competitorRowsToCsvContent(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `competitors-${siteName.replace(/\s+/g, "-")}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
