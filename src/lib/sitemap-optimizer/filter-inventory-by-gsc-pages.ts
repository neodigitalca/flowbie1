import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import type { GscParsedPageRow } from "@/lib/sitemap-optimizer/parse-gsc-pages-csv";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

export type FilterInventoryByGscPagesResult = {
  rows: SitemapOptimizerPostRow[];
  matchedCount: number;
  uploadRowCount: number;
  unmatchedUploadCount: number;
};

function gscUploadByUrlKey(upload: GscParsedPageRow[]): Map<string, GscParsedPageRow> {
  const uploadByKey = new Map<string, GscParsedPageRow>();
  for (const u of upload) {
    uploadByKey.set(normalizePageUrlKey(u.page), u);
  }
  return uploadByKey;
}

function rowWithGscPageMetrics(
  row: SitemapOptimizerPostRow,
  gsc: GscParsedPageRow,
): SitemapOptimizerPostRow {
  return {
    ...row,
    gscPageClicks: gsc.clicks,
    gscPageImpressions: gsc.impressions,
    gscPageCtr: gsc.ctr,
    gscPagePosition: gsc.position,
  };
}

/** Keep every inventory row; attach GSC page metrics when the CSV path matches. */
export function mergeInventoryWithGscPagesUpload(
  inventory: SitemapOptimizerPostRow[],
  upload: GscParsedPageRow[],
): { rows: SitemapOptimizerPostRow[]; matchedCount: number; uploadRowCount: number } {
  const uploadByKey = gscUploadByUrlKey(upload);
  let matchedCount = 0;
  const rows = inventory.map((row) => {
    const gsc = uploadByKey.get(normalizePageUrlKey(row.url));
    if (!gsc) return row;
    matchedCount += 1;
    return rowWithGscPageMetrics(row, gsc);
  });
  return { rows, matchedCount, uploadRowCount: upload.length };
}

export function filterInventoryByGscPages(
  inventory: SitemapOptimizerPostRow[],
  upload: GscParsedPageRow[],
): FilterInventoryByGscPagesResult {
  const uploadByKey = gscUploadByUrlKey(upload);
  const matchedKeys = new Set<string>();
  const rows: SitemapOptimizerPostRow[] = [];

  for (const row of inventory) {
    const key = normalizePageUrlKey(row.url);
    const gsc = uploadByKey.get(key);
    if (!gsc) continue;
    matchedKeys.add(key);
    rows.push(rowWithGscPageMetrics(row, gsc));
  }

  return {
    rows,
    matchedCount: rows.length,
    uploadRowCount: upload.length,
    unmatchedUploadCount: upload.length - matchedKeys.size,
  };
}
