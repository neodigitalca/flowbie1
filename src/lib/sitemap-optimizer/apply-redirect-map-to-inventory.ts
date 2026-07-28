import { ensureBlogDestinationUrl } from "@/lib/sitemap-optimizer/blog-destination-url";
import { buildPostRowsFromGscGrid } from "@/lib/sitemap-optimizer/grid-csv-catalog";
import { normalizeGridGeoTag, normalizeGridTopicTag } from "@/lib/sitemap-optimizer/grid-tag-key";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import { redirectMapSourceMatchKey } from "@/lib/sitemap-optimizer/redirect-map-source-key";
import type { GscParsedPageRow } from "@/lib/sitemap-optimizer/parse-gsc-pages-csv";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

export type ApplyRedirectMapResult = {
  rows: SitemapOptimizerPostRow[];
  matchedCount: number;
  uploadRowCount: number;
};

export type RedirectMapPipelineResult = {
  rows: SitemapOptimizerPostRow[];
  linkedCount: number;
  uploadRowCount: number;
};

/** Remap inventory URLs from redirect-grid CSV (old_url → new_url). */
export function applyRedirectMapToInventory(
  inventory: readonly SitemapOptimizerPostRow[],
  upload: readonly GscParsedPageRow[],
): ApplyRedirectMapResult {
  const uploadByOldKey = new Map<string, GscParsedPageRow>();
  for (const u of upload) {
    const oldUrl = u.redirectFromUrl?.trim();
    if (!oldUrl) continue;
    const key = redirectMapSourceMatchKey(oldUrl) ?? normalizePageUrlKey(oldUrl);
    uploadByOldKey.set(key, u);
  }

  const rows: SitemapOptimizerPostRow[] = [];
  for (const row of inventory) {
    const key =
      redirectMapSourceMatchKey(row.url) ??
      normalizePageUrlKey(row.url);
    const mapped = uploadByOldKey.get(key);
    if (!mapped) continue;

    const tagLabel = mapped.gridTagLabel?.trim();
    const topicTag = mapped.gridTopicTag?.trim();

    const destination =
      ensureBlogDestinationUrl(mapped.page.trim()) ?? mapped.page.trim();

    rows.push({
      ...row,
      url: destination,
      gridRedirectFromUrl: row.url.trim(),
      gridRedirectGroup: mapped.gridGroup ?? row.gridRedirectGroup,
      uploadRowIndex: mapped.csvUploadRow ?? row.uploadRowIndex,
      gridTopicTag: topicTag ? normalizeGridTopicTag(topicTag) : row.gridTopicTag,
      gridGeoTag: mapped.gridGeoTag?.trim()
        ? normalizeGridGeoTag(mapped.gridGeoTag)
        : row.gridGeoTag,
      gridTagLabel: tagLabel || row.gridTagLabel,
      title: tagLabel || row.title,
      gscPageClicks: mapped.clicks || row.gscPageClicks,
      gscPageImpressions: mapped.impressions || row.gscPageImpressions,
      gscPageCtr: mapped.ctr || row.gscPageCtr,
      gscPagePosition: mapped.position || row.gscPagePosition,
    });
  }

  return {
    rows,
    matchedCount: rows.length,
    uploadRowCount: upload.length,
  };
}

/** Redirect CSV rows drive the plan; link WP post IDs only when legacy source still matches inventory. */
export function buildRedirectMapPipelineRows(
  inventory: readonly SitemapOptimizerPostRow[],
  upload: readonly GscParsedPageRow[],
): RedirectMapPipelineResult {
  const csvRows = buildPostRowsFromGscGrid(upload);
  const remapped = applyRedirectMapToInventory(inventory, upload);
  const matchedByLegacyKey = new Map<string, SitemapOptimizerPostRow>();
  for (const row of remapped.rows) {
    const legacy = row.gridRedirectFromUrl?.trim();
    if (!legacy) continue;
    const key = redirectMapSourceMatchKey(legacy) ?? normalizePageUrlKey(legacy);
    matchedByLegacyKey.set(key, row);
  }

  let linkedCount = 0;
  const rows = csvRows.map((csvRow) => {
    const legacy = csvRow.gridRedirectFromUrl?.trim();
    if (!legacy) return csvRow;
    const key = redirectMapSourceMatchKey(legacy) ?? normalizePageUrlKey(legacy);
    const hit = matchedByLegacyKey.get(key);
    if (!hit) return csvRow;
    linkedCount += 1;
    return {
      ...csvRow,
      postId: hit.postId,
      collection: hit.collection,
      keyword: hit.keyword || csvRow.keyword,
      meta: hit.meta || csvRow.meta,
      contentSnippet: hit.contentSnippet || csvRow.contentSnippet,
      gscQueries: hit.gscQueries.length ? hit.gscQueries : csvRow.gscQueries,
    };
  });

  return { rows, linkedCount, uploadRowCount: upload.length };
}

export function isRedirectGridUpload(upload: readonly GscParsedPageRow[]): boolean {
  return upload.length > 0 && upload.every((r) => Boolean(r.redirectFromUrl?.trim() && r.page.trim()));
}

/** Redirect grid with CSV `group` on every row — Sheet4-style prefilled clusters. */
export function isPrefilledRedirectGridUpload(upload: readonly GscParsedPageRow[]): boolean {
  return (
    isRedirectGridUpload(upload) &&
    upload.every((r) => r.gridGroup != null && Number.isFinite(r.gridGroup))
  );
}
