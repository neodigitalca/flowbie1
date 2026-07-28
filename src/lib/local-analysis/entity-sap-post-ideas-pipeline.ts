import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { PromptBulkSitemapInventoryBuckets } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { GscSiteQueryRow } from "@/lib/competitor-research/types";
import { hydrateEntityPreviewSapRows } from "@/lib/local-analysis/entity-preview-sap-hydrate";
import { fillEntitySapRowKeywordsFromInventoryAndGsc } from "@/lib/local-analysis/entity-sap-row-keyword-fill";
import type { EntityTitleClusterKeywordTarget } from "@/lib/local-analysis/entity-sap-title-cluster-jobs";

export type HydrateEntitySapIdeaRowsOptions = {
  apiKey: string;
  model: string;
  siteId?: string;
  siteName: string;
  siteUrl: string;
  keywordTargets: EntityTitleClusterKeywordTarget[];
  maxSapBudget: number;
  rows: CSVRow[];
  seedKeywords: string[];
  buckets: PromptBulkSitemapInventoryBuckets;
  gscQueries: GscSiteQueryRow[];
  gridLocations: string[];
  entityTypeFocus?: string[];
  onKeywordPhase?: (phase: string) => void;
  onTitleProgress?: (done: number, total: number) => void;
  onMetaProgress?: (done: number, total: number) => void;
  onRowsUpdate?: (rows: CSVRow[]) => void;
};

/** One OpenRouter keyword assign from GSC, then titles/meta/publish. */
export async function hydrateEntitySapIdeaRows(
  options: HydrateEntitySapIdeaRowsOptions,
): Promise<CSVRow[]> {
  const {
    apiKey,
    model,
    siteId,
    siteName,
    siteUrl,
    rows,
    seedKeywords,
    buckets,
    gscQueries,
    onKeywordPhase,
    onTitleProgress,
    onMetaProgress,
    onRowsUpdate,
  } = options;

  if (rows.length === 0) return rows;

  onKeywordPhase?.("Assigning unique keywords from GSC");
  const withKeywords = await fillEntitySapRowKeywordsFromInventoryAndGsc({
    apiKey,
    model,
    siteId,
    siteName,
    siteUrl,
    rows,
    seedKeywords,
    buckets,
    gscQueries,
    gridLocations: options.gridLocations,
    entityTypeFocus: options.entityTypeFocus,
  });
  onRowsUpdate?.(withKeywords);

  return hydrateEntityPreviewSapRows({
    apiKey,
    model,
    siteId,
    siteName,
    gridLocations: options.gridLocations,
    entityTypeFocus: options.entityTypeFocus,
    rows: withKeywords,
    onTitleProgress,
    onMetaProgress,
    onRowsUpdate,
  });
}
