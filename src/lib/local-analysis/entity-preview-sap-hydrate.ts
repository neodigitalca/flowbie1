import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { applySapOriginFromTitleToRows } from "@/lib/sap-origin-from-title";
import { applySapTargetSlugsFromKeywordEntity } from "@/lib/sap-slug-from-keyword-entity";
import { fillSapRowMetaFromOpenRouter } from "@/lib/local-analysis/entity-sap-meta-agent";
import { fillSapRowTitlesFromOpenRouter } from "@/lib/local-analysis/entity-sap-title-agent";

export type HydrateEntityPreviewSapRowsOptions = {
  apiKey: string;
  model: string;
  siteId?: string;
  siteName: string;
  gridLocations: string[];
  entityTypeFocus?: string[];
  rows: CSVRow[];
  onTitleProgress?: (done: number, total: number) => void;
  onMetaProgress?: (done: number, total: number) => void;
  onRowsUpdate?: (rows: CSVRow[]) => void;
};

/**
 * No-op: schedule picker owns publish dates. Do not invent publish_date_gmt here.
 * Kept for call-site compatibility.
 */
export function applyPublishDatesToSapRows(rows: CSVRow[]): CSVRow[] {
  return rows;
}

/** @deprecated Use {@link applyPublishDatesToSapRows} after OpenRouter meta fill. */
export function applyPublishAndMetaToSapRows(rows: CSVRow[]): CSVRow[] {
  return applyPublishDatesToSapRows(rows);
}

/** After Clusters: slugs, OpenRouter titles, meta descriptions. */
export async function hydrateEntityClusterSapRows(
  options: HydrateEntityPreviewSapRowsOptions,
): Promise<CSVRow[]> {
  const { apiKey, model, siteId, siteName, gridLocations, entityTypeFocus, rows, onTitleProgress, onMetaProgress, onRowsUpdate } =
    options;
  if (rows.length === 0) return rows;

  const withSlugs = applySapTargetSlugsFromKeywordEntity(rows);
  onRowsUpdate?.(withSlugs.map((row) => ({ ...row })));

  const titled = await fillSapRowTitlesFromOpenRouter(withSlugs, {
    apiKey,
    model,
    siteId,
    siteName,
    gridLocations,
    entityTypeFocus,
    onProgress: onTitleProgress,
    onRowsUpdate,
  });

  const withMeta = await fillSapRowMetaFromOpenRouter(titled, {
    apiKey,
    model,
    siteId,
    siteName,
    onProgress: onMetaProgress,
  });
  onRowsUpdate?.(withMeta.map((row) => ({ ...row })));

  return applySapOriginFromTitleToRows(withMeta);
}

/** Slugs, OpenRouter titles, meta descriptions. */
export async function hydrateEntityPreviewSapRows(
  options: HydrateEntityPreviewSapRowsOptions,
): Promise<CSVRow[]> {
  const { apiKey, model, siteId, siteName, gridLocations, entityTypeFocus, rows, onTitleProgress, onMetaProgress, onRowsUpdate } =
    options;
  if (rows.length === 0) return rows;

  const withSlugs = applySapTargetSlugsFromKeywordEntity(rows);
  const titled = await fillSapRowTitlesFromOpenRouter(withSlugs, {
    apiKey,
    model,
    siteId,
    siteName,
    gridLocations,
    entityTypeFocus,
    onProgress: onTitleProgress,
    onRowsUpdate,
  });

  const withMeta = await fillSapRowMetaFromOpenRouter(titled, {
    apiKey,
    model,
    siteId,
    siteName,
    onProgress: onMetaProgress,
  });
  onRowsUpdate?.(withMeta.map((row) => ({ ...row })));

  return applySapOriginFromTitleToRows(withMeta);
}
