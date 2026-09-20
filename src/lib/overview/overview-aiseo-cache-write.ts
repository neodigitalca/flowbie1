import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import {
  getEntitySiteWarmCacheIfReady,
  mergeSitePrefetchBulkInventoryRows,
} from "@/lib/local-analysis/entity-site-warm-cache";
import type { SiteInventoryBulkRow } from "@/lib/wordpress-api/types";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";

export type AiseoCacheWriteAccumulator = {
  push: (url: string, html: string) => void;
  applyToRows: (rows: OverviewRow[]) => OverviewRow[];
  flush: () => void;
  size: () => number;
};

function urlCacheKey(url: string): string {
  return normalizePageUrlKey(url) || url.trim().toLowerCase();
}

function mergePendingIntoInventoryRows(
  base: SiteInventoryBulkRow[],
  pending: Map<string, string>,
): SiteInventoryBulkRow[] {
  return base.map((row) => {
    const html = pending.get(urlCacheKey(row.url ?? ""));
    if (!html) return row;
    return {
      ...row,
      fields: { ...row.fields, content: html },
    } as SiteInventoryBulkRow;
  });
}

/** Set postContentOptimized on one grid row (before per-row WordPress upload). */
export function applyAiseoHtmlToRowsRef(
  rowsRef: { current: OverviewRow[] },
  url: string,
  html: string,
): void {
  const key = urlCacheKey(url);
  const body = html.trim();
  if (!key || !body) return;
  rowsRef.current = rowsRef.current.map((row) =>
    urlCacheKey(row.url ?? "") === key ? { ...row, postContentOptimized: body } : row,
  );
}

/** Apply cache bodies to grid rows, then merge into warm inventory (batch end). */
export function finalizeAiseoCacheWriteForUpload(
  acc: AiseoCacheWriteAccumulator,
  rowsRef: { current: OverviewRow[] },
): void {
  if (acc.size() === 0) return;
  rowsRef.current = acc.applyToRows(rowsRef.current);
  acc.flush();
}

/** Accumulate AISEO body HTML during bulk; one flush path at batch end. */
export function createAiseoCacheWriteAccumulator(site: WordPressSite): AiseoCacheWriteAccumulator {
  const pending = new Map<string, string>();

  return {
    push(url: string, html: string) {
      const key = urlCacheKey(url);
      const body = html.trim();
      if (!key || !body) return;
      pending.set(key, body);
    },
    applyToRows(rows: OverviewRow[]) {
      if (!pending.size) return rows;
      return rows.map((row) => {
        const html = pending.get(urlCacheKey(row.url ?? ""));
        if (!html) return row;
        return { ...row, postContentOptimized: html };
      });
    },
    flush() {
      if (!pending.size) return;
      const warm = getEntitySiteWarmCacheIfReady(site.id);
      const bulk = warm?.bulkInventoryRows;
      if (!bulk?.length) return;

      mergeSitePrefetchBulkInventoryRows(site, mergePendingIntoInventoryRows(bulk, pending));
      pending.clear();
    },
    size() {
      return pending.size;
    },
  };
}

/** Strip large body fields before optional small grid patches (H2 list, timestamps). */
export function overviewRowPatchWithoutBody(patch: Partial<OverviewRow>): Partial<OverviewRow> {
  const { postContent: _pc, postContentOptimized: _po, ...rest } = patch;
  return rest;
}
