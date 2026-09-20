import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import { overviewRowInBulkScope } from "@/lib/overview/overview-bulk-row-scope";
import { lookupOverviewInventoryHitForUrl } from "@/hooks/content-optimization/bulk-seo-extra-text-fast-path";
import { resolveHarnessPrependSourceHtml } from "@/lib/overview/overview-blog-overview-prepend";
import {
  postBodyHtmlFromInventoryRow,
  sentimentHtmlFromInventoryRow,
} from "@/lib/overview/overview-inventory-seo-fields";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import { resolveOverviewPlaceEntityForRow } from "@/lib/overview/resolve-overview-place-entity";
import { updateBulkStateWithEntity } from "@/hooks/content-optimization/continue-optimization-entity-helpers";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import type { Dispatch, SetStateAction } from "react";

export type OverviewHarnessCatalogRow = {
  index: number;
  url: string;
  title: string;
  focusKeyword: string;
  html: string;
  seoResearchBrief?: string;
  entity?: string;
  pageKind: "post" | "entity";
};

export function resolveHarnessRowHtmlFromSources(args: {
  row: OverviewRow;
  site: WordPressSite;
  sitemapSource: OverviewSitemapSource;
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
  rowHtmlByIndex?: Record<number, string>;
  index: number;
}): string {
  const { row, site, sitemapSource, getInventoryMatchForUrl, rowHtmlByIndex, index } = args;
  const trimmedUrl = row.url?.trim() ?? "";
  const snapshotHit = trimmedUrl
    ? lookupOverviewInventoryHitForUrl(site, trimmedUrl, sitemapSource)
    : undefined;
  const invMatch =
    snapshotHit != null
      ? {
          row: snapshotHit.row,
          subtype:
            snapshotHit.source === "pages"
              ? ("page" as const)
              : snapshotHit.source === "posts"
                ? ("post" as const)
                : snapshotHit.source,
        }
      : trimmedUrl
        ? getInventoryMatchForUrl(site, trimmedUrl)
        : undefined;

  const inventoryHtml = snapshotHit?.row?.fields?.content?.trim() ?? "";
  const gridHtml = resolveHarnessPrependSourceHtml(row).trim();
  return (
    rowHtmlByIndex?.[index]?.trim() ||
    gridHtml ||
    inventoryHtml ||
    (invMatch?.row ? postBodyHtmlFromInventoryRow(invMatch.row)?.trim() : "") ||
    (invMatch?.row ? sentimentHtmlFromInventoryRow(invMatch.row)?.trim() : "") ||
    ""
  );
}

export async function buildOverviewHarnessCatalogWithHtml(args: {
  site: WordPressSite;
  rows: OverviewRow[];
  indices: number[];
  sitemapSource: OverviewSitemapSource;
  bindings: Record<string, OverviewBinding | undefined>;
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
  bulkScopeUrlKeys: Set<string>;
  onProgress?: (message: string) => void;
}): Promise<{
  catalog: OverviewHarnessCatalogRow[];
  rowHtmlByIndex: Record<number, string>;
  mergedBindings: Record<string, OverviewBinding | undefined>;
}> {
  const {
    site,
    rows,
    indices,
    sitemapSource,
    bindings,
    getInventoryMatchForUrl,
    bulkScopeUrlKeys,
    onProgress,
  } = args;

  const scopedIndices = indices.filter((index) => {
    const url = rows[index]?.url?.trim();
    return url && overviewRowInBulkScope(url, bulkScopeUrlKeys);
  });

  const mergedBindings: Record<string, OverviewBinding | undefined> = { ...bindings };
  const rowHtmlByIndex: Record<number, string> = {};
  const pageKind: "post" | "entity" = sitemapSource === "sap" ? "entity" : "post";
  onProgress?.("Using cached page HTML…");

  const catalog: OverviewHarnessCatalogRow[] = [];
  for (const index of scopedIndices) {
    const row = rows[index];
    if (!row) continue;
    const url = row.url?.trim();
    if (!url) continue;

    const html = resolveHarnessRowHtmlFromSources({
      row,
      site,
      sitemapSource,
      getInventoryMatchForUrl,
      rowHtmlByIndex,
      index,
    });
    if (html) rowHtmlByIndex[index] = html;

    catalog.push({
      index,
      url,
      title: (row.title || "").trim(),
      focusKeyword: (row.focusKeyword || "").trim(),
      html,
      seoResearchBrief: row.seoResearch?.trim() || undefined,
      pageKind,
    });
  }

  return { catalog, rowHtmlByIndex, mergedBindings };
}

/** Answer catalog from inventory/row cache only. Never fetches WordPress. Skips rows with no body at run time. */
export function buildOverviewAnswerCatalogFromCache(args: {
  site: WordPressSite;
  rows: OverviewRow[];
  indices: number[];
  sitemapSource: OverviewSitemapSource;
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
  bulkScopeUrlKeys: Set<string>;
}): OverviewHarnessCatalogRow[] {
  const pageKind: "post" | "entity" = args.sitemapSource === "sap" ? "entity" : "post";
  const catalog: OverviewHarnessCatalogRow[] = [];
  for (const index of args.indices) {
    const row = args.rows[index];
    if (!row) continue;
    const url = row.url?.trim();
    if (!url || !overviewRowInBulkScope(url, args.bulkScopeUrlKeys)) continue;
    catalog.push({
      index,
      url,
      title: (row.title || "").trim(),
      focusKeyword: (row.focusKeyword || "").trim(),
      html: resolveHarnessRowHtmlFromSources({
        row,
        site: args.site,
        sitemapSource: args.sitemapSource,
        getInventoryMatchForUrl: args.getInventoryMatchForUrl,
        index,
      }),
      seoResearchBrief: row.seoResearch?.trim() || undefined,
      pageKind,
    });
  }
  return catalog;
}

export function cacheRowHtmlByIndex(args: {
  site: WordPressSite;
  rows: OverviewRow[];
  indices: number[];
  sitemapSource: OverviewSitemapSource;
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
}): Record<number, string> {
  const out: Record<number, string> = {};
  for (const index of args.indices) {
    const row = args.rows[index];
    if (!row) continue;
    const html = resolveHarnessRowHtmlFromSources({
      row,
      site: args.site,
      sitemapSource: args.sitemapSource,
      getInventoryMatchForUrl: args.getInventoryMatchForUrl,
      index,
    });
    if (html) out[index] = html;
  }
  return out;
}

export async function enrichHarnessCatalogWithEntities(args: {
  catalog: OverviewHarnessCatalogRow[];
  rows: OverviewRow[];
  site: WordPressSite;
  sitemapSource: OverviewSitemapSource;
  apiKey: string;
  urlEntities?: Record<string, string>;
  setBulkOptimizationState?: Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
  batchKey?: string;
}): Promise<OverviewHarnessCatalogRow[]> {
  const { catalog, rows, site, sitemapSource, apiKey, urlEntities, setBulkOptimizationState, batchKey } =
    args;
  if (sitemapSource !== "sap") return catalog;

  const out: OverviewHarnessCatalogRow[] = [];
  for (const entry of catalog) {
    const row = rows[entry.index];
    if (!row) {
      out.push(entry);
      continue;
    }
    const entity = await resolveOverviewPlaceEntityForRow({
      row,
      site,
      sitemapSource,
      urlEntities,
      apiKey,
    });
    if (entity && setBulkOptimizationState && batchKey) {
      await updateBulkStateWithEntity(
        site,
        entry.url,
        entry.focusKeyword,
        entity,
        entry.title,
        setBulkOptimizationState,
      );
    }
    out.push({ ...entry, entity, pageKind: "entity" });
  }
  return out;
}

export function applyHarnessHtmlPatchesToRows(args: {
  rowHtmlByIndex: Record<number, string>;
  updateRow: (index: number, patch: Partial<OverviewRow>) => void;
}): void {
  for (const [indexKey, html] of Object.entries(args.rowHtmlByIndex)) {
    const trimmed = html?.trim();
    if (!trimmed) continue;
    args.updateRow(Number(indexKey), { postContentOptimized: trimmed });
  }
}

export async function loadOverviewHarnessRowHtmlPatches(args: {
  site: WordPressSite;
  rows: OverviewRow[];
  indices: number[];
  sitemapSource: OverviewSitemapSource;
  bindings: Record<string, OverviewBinding | undefined>;
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
  bulkScopeUrlKeys: Set<string>;
  prefetchOverviewInventory?: (
    site: WordPressSite,
    options: {
      includeContent: boolean;
      includePageHeading: boolean;
      source: OverviewSitemapSource;
      silent: boolean;
    },
  ) => Promise<void>;
  onProgress?: (message: string) => void;
}): Promise<Record<number, string>> {
  const { rowHtmlByIndex } = await buildOverviewHarnessCatalogWithHtml({
    site: args.site,
    rows: args.rows,
    indices: args.indices,
    sitemapSource: args.sitemapSource,
    bindings: args.bindings,
    getInventoryMatchForUrl: args.getInventoryMatchForUrl,
    bulkScopeUrlKeys: args.bulkScopeUrlKeys,
    onProgress: args.onProgress,
  });
  return rowHtmlByIndex;
}
