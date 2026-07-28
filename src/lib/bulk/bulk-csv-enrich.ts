import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { fillSapRowMetaFromOpenRouter } from "@/lib/local-analysis/entity-sap-meta-agent";
import { fillSapRowTitlesFromOpenRouter } from "@/lib/local-analysis/entity-sap-title-agent";
import { applySapTargetSlugsFromKeywordEntity } from "@/lib/sap-slug-from-keyword-entity";

export type EnrichCsvRowsFromSheetOptions = {
  apiKey: string;
  model: string;
  siteId?: string;
  siteName: string;
  gridLocations: string[];
  onRowsUpdate?: (rows: CSVRow[]) => void;
};

/** Slugs, then OpenRouter for missing titles/meta. Schedule picker owns publish dates. */
export async function enrichCsvRowsFromSheet(
  rows: CSVRow[],
  options: EnrichCsvRowsFromSheetOptions,
): Promise<CSVRow[]> {
  if (rows.length === 0) return rows;

  const withSlugs = applySapTargetSlugsFromKeywordEntity(rows);
  options.onRowsUpdate?.(withSlugs.map((row) => ({ ...row })));

  const titled = await fillSapRowTitlesFromOpenRouter(withSlugs, {
    apiKey: options.apiKey,
    model: options.model,
    siteId: options.siteId,
    siteName: options.siteName,
    gridLocations: options.gridLocations,
    onRowsUpdate: options.onRowsUpdate,
  });

  const withMeta = await fillSapRowMetaFromOpenRouter(titled, {
    apiKey: options.apiKey,
    model: options.model,
    siteId: options.siteId,
    siteName: options.siteName,
    onRowsUpdate: options.onRowsUpdate,
  });

  options.onRowsUpdate?.(withMeta.map((row) => ({ ...row })));

  return withMeta;
}
