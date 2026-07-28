import {
  fetchGSCPagesPerformanceBatch,
  type GSCPagePerformanceResult,
} from "@/lib/wordpress-api/gsc";
import {
  SITEMAP_OPTIMIZER_GSC_BATCH_CONCURRENCY,
  SITEMAP_OPTIMIZER_GSC_BATCH_SIZE,
} from "@/lib/sitemap-optimizer/constants";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import { gscPageQueriesToRows } from "@/lib/sitemap-optimizer/types";
import type {
  SitemapOptimizerGscDateRange,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const n = items.length;
  const ret: R[] = new Array(n);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const idx = next++;
      if (idx >= n) return;
      ret[idx] = await fn(items[idx]!, idx);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), n);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return ret;
}

function indexBatchPages(pages: GSCPagePerformanceResult[]): Map<string, GSCPagePerformanceResult> {
  const map = new Map<string, GSCPagePerformanceResult>();
  for (const p of pages) {
    const key = normalizePageUrlKey(p.pageUrl);
    map.set(key, p);
    if (p.matchedUrl?.trim()) {
      map.set(normalizePageUrlKey(p.matchedUrl), p);
    }
  }
  return map;
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

export type EnrichGscProgress = (completed: number, total: number) => void;

/** Inventory already matched to GSC Pages CSV; do not call Search Console API. */
export function enrichSitemapOptimizerRowsFromGscCsvUpload(
  rows: SitemapOptimizerPostRow[],
): { rows: SitemapOptimizerPostRow[]; missCount: number } {
  let missCount = 0;
  const enriched = rows.map((row) => {
    const hasPageMetrics =
      row.gscPageImpressions != null ||
      row.gscPageClicks != null ||
      row.gscPagePosition != null;
    if (!hasPageMetrics) missCount += 1;
    return {
      ...row,
      gscQueries: row.gscQueries ?? [],
      gscFetched: hasPageMetrics,
    };
  });
  return { rows: enriched, missCount };
}

export async function enrichSitemapOptimizerRowsWithGsc(
  siteUrl: string,
  rows: SitemapOptimizerPostRow[],
  dateRange: SitemapOptimizerGscDateRange,
  onProgress?: EnrichGscProgress,
  signal?: AbortSignal,
): Promise<{ rows: SitemapOptimizerPostRow[]; missCount: number }> {
  const total = rows.length;
  if (total === 0) {
    return { rows: [], missCount: 0 };
  }

  let missCount = 0;
  let completed = 0;
  const perfByUrl = new Map<string, GSCPagePerformanceResult>();

  const rowChunks = chunkRows(rows, SITEMAP_OPTIMIZER_GSC_BATCH_SIZE);

  await mapWithConcurrency(
    rowChunks,
    SITEMAP_OPTIMIZER_GSC_BATCH_CONCURRENCY,
    async (chunk) => {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const batch = await fetchGSCPagesPerformanceBatch(
        siteUrl,
        chunk.map((r) => r.url),
        dateRange.startDate,
        dateRange.endDate,
        signal,
      );
      const indexed = indexBatchPages(batch.pages ?? []);
      for (const [k, v] of indexed) {
        perfByUrl.set(k, v);
      }
      completed += chunk.length;
      onProgress?.(completed, total);
    },
    signal,
  );

  const enriched = rows.map((row) => {
    const perf = perfByUrl.get(normalizePageUrlKey(row.url));
    if (!perf?.success) {
      missCount += 1;
      return { ...row, gscQueries: [], gscFetched: false };
    }
    const queries = gscPageQueriesToRows(perf.queries ?? []);
    if (queries.length === 0) missCount += 1;
    const stats = perf.pageStats;
    return {
      ...row,
      gscQueries: queries,
      gscFetched: true,
      gscPageClicks: stats?.clicks ?? row.gscPageClicks,
      gscPageImpressions: stats?.impressions ?? row.gscPageImpressions,
      gscPageCtr: stats?.ctr ?? row.gscPageCtr,
      gscPagePosition: stats?.position ?? row.gscPagePosition,
    };
  });

  return { rows: enriched, missCount };
}
