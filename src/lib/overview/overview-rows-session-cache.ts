import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import { clearOverviewSitemapLoadFingerprints } from "@/lib/overview/overview-sitemap-load-cache";

function cacheKey(siteId: string, source: OverviewSitemapSource): string {
  return `neo-pulse-overview-rows-v2:${siteId}:${source}`;
}

const memoryByKey = new Map<string, OverviewRow[]>();

function normalizeStoredRow(row: OverviewRow): OverviewRow {
  return {
    ...row,
    status: "idle",
    aiTitle: row.aiTitle ?? "",
    aiMeta: row.aiMeta ?? "",
    metaDescription: row.metaDescription ?? "",
    title: row.title ?? "",
    pageHeading: row.pageHeading ?? "",
  };
}

export function getOverviewRowsSessionCache(
  siteId: string,
  source: OverviewSitemapSource,
): OverviewRow[] | null {
  const key = cacheKey(siteId, source);
  const mem = memoryByKey.get(key);
  if (mem?.length) return mem.map(normalizeStoredRow);

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OverviewRow[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const rows = parsed.filter((r) => r?.url?.trim()).map(normalizeStoredRow);
    if (rows.length) memoryByKey.set(key, rows);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

export function setOverviewRowsSessionCache(
  siteId: string,
  source: OverviewSitemapSource,
  rows: OverviewRow[],
): void {
  if (!rows.length) return;
  const key = cacheKey(siteId, source);
  const snapshot = rows.map(normalizeStoredRow);
  memoryByKey.set(key, snapshot);
  try {
    sessionStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // quota or private mode
  }
}

export function clearOverviewRowsSessionCache(siteId: string): void {
  clearOverviewSitemapLoadFingerprints(siteId);
  for (const source of ["pages", "posts", "sap"] as const) {
    const key = cacheKey(siteId, source);
    memoryByKey.delete(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/** Merge sitemap URL list with cached row data (editor fields preserved on remount). */
export function mergeOverviewRowsForSitemapLoad(
  urls: string[],
  existingByUrl: Map<string, OverviewRow>,
  sessionByUrl: Map<string, OverviewRow>,
  emptyRow: (url: string) => OverviewRow,
): OverviewRow[] {
  return urls.map((url) => {
    const existing = existingByUrl.get(url);
    const session = sessionByUrl.get(url);
    const base = existing || session || emptyRow(url);
    return {
      ...base,
      url,
      postId: base.postId ?? null,
      postType: base.postType ?? null,
      wpStatus: base.wpStatus,
      wpDateGmt: base.wpDateGmt,
      status: "idle",
    };
  });
}
