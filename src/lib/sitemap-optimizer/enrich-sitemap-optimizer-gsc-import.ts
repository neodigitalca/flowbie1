import { fetchGSCPagesPerformanceBatch, fetchGSCSitePagesPerformance } from "@/lib/wordpress-api/gsc";
import type { GSCSitePageMetric } from "@/lib/wordpress-api/types";
import {
  SITEMAP_OPTIMIZER_GSC_BATCH_CONCURRENCY,
  SITEMAP_OPTIMIZER_GSC_BATCH_SIZE,
  SITEMAP_OPTIMIZER_GSC_QUERY_BATCH_CONCURRENCY,
  SITEMAP_OPTIMIZER_GSC_QUERY_BATCH_SIZE,
} from "@/lib/sitemap-optimizer/constants";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import { gscPageQueriesToRows } from "@/lib/sitemap-optimizer/types";
import type {
  SitemapOptimizerGscDateRange,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

export type SitemapOptimizerTrafficFilter =
  | "all"
  | "traffic"
  | "zero_clicks"
  | "no_impressions";

export const SITEMAP_OPTIMIZER_TRAFFIC_FILTER_LABEL: Record<
  SitemapOptimizerTrafficFilter,
  string
> = {
  all: "All URLs",
  traffic: "With traffic (clicks)",
  zero_clicks: "0 clicks",
  no_impressions: "No traffic (0 impressions)",
};

export const SITEMAP_OPTIMIZER_TRAFFIC_FILTER_ENTITY_LABEL: Record<
  SitemapOptimizerTrafficFilter,
  string
> = {
  all: "All service areas",
  traffic: "Service areas with clicks",
  zero_clicks: "Service areas with 0 clicks",
  no_impressions: "Service areas with 0 impressions",
};

export function trafficFilterLabelForCollections(
  filter: SitemapOptimizerTrafficFilter,
  entityPrimary: boolean,
): string {
  return entityPrimary
    ? SITEMAP_OPTIMIZER_TRAFFIC_FILTER_ENTITY_LABEL[filter]
    : SITEMAP_OPTIMIZER_TRAFFIC_FILTER_LABEL[filter];
}

/** URL variants used to join inventory rows to GSC page rows (no contains/regex). */
export function buildInventoryUrlAliases(row: SitemapOptimizerPostRow): string[] {
  const seen = new Set<string>();
  const add = (raw: string | undefined) => {
    const t = raw?.trim();
    if (!t) return;
    const key = normalizePageUrlKey(t);
    if (!key || seen.has(key)) return;
    seen.add(key);
  };
  add(row.url);
  add(row.gridRedirectFromUrl);
  for (const raw of [row.url, row.gridRedirectFromUrl]) {
    const t = raw?.trim();
    if (!t) continue;
    try {
      const u = new URL(t);
      add(u.href);
      const pathNoSlash = u.pathname.replace(/\/+$/, "") || "/";
      add(`${u.origin}${pathNoSlash}`);
      if (pathNoSlash !== "/") add(`${u.origin}${pathNoSlash}/`);
    } catch {
      // ignore
    }
  }
  return [...seen];
}

function bestMetricForAliases(
  aliases: string[],
  metricsByKey: Map<string, GSCSitePageMetric>,
): GSCSitePageMetric | null {
  let best: GSCSitePageMetric | null = null;
  for (const alias of aliases) {
    const m = metricsByKey.get(alias);
    if (!m) continue;
    if (!best || (m.clicks ?? 0) > (best.clicks ?? 0)) best = m;
  }
  return best;
}

export function buildSitePageMetricsIndex(
  sitePages: readonly GSCSitePageMetric[],
): Map<string, GSCSitePageMetric> {
  const map = new Map<string, GSCSitePageMetric>();
  for (const p of sitePages) {
    const key = normalizePageUrlKey(p.pageUrl);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || (p.clicks ?? 0) > (existing.clicks ?? 0)) {
      map.set(key, p);
    }
  }
  return map;
}

export function joinInventoryWithSitePageMetrics(
  inventory: readonly SitemapOptimizerPostRow[],
  sitePages: readonly GSCSitePageMetric[],
): SitemapOptimizerPostRow[] {
  const metricsByKey = buildSitePageMetricsIndex(sitePages);
  return inventory.map((row) => {
    const metric = bestMetricForAliases(buildInventoryUrlAliases(row), metricsByKey);
    const clicks = metric?.clicks ?? 0;
    const impressions = metric?.impressions ?? 0;
    return {
      ...row,
      gscPageClicks: clicks,
      gscPageImpressions: impressions,
      gscPageCtr: metric?.ctr ?? (impressions > 0 ? clicks / impressions : 0),
      gscPagePosition: metric?.position ?? 0,
      gscQueries: row.gscQueries ?? [],
      gscFetched: true,
    };
  });
}

export function filterInventoryByTraffic(
  rows: readonly SitemapOptimizerPostRow[],
  mode: SitemapOptimizerTrafficFilter,
): SitemapOptimizerPostRow[] {
  if (mode === "all") return [...rows];
  return rows.filter((row) => {
    const clicks = row.gscPageClicks ?? 0;
    const impressions = row.gscPageImpressions ?? 0;
    if (mode === "traffic") return clicks > 0;
    if (mode === "zero_clicks") return clicks === 0;
    return impressions === 0;
  });
}

/** Picks the broadest useful GSC slice: clicks, then impressions (no clicks), then no impressions, then all. */
export function applyAutoTrafficFilter(rows: readonly SitemapOptimizerPostRow[]): {
  filter: SitemapOptimizerTrafficFilter;
  rows: SitemapOptimizerPostRow[];
} {
  const withClicks = filterInventoryByTraffic(rows, "traffic");
  if (withClicks.length > 0) {
    return { filter: "traffic", rows: withClicks };
  }

  const withImpressionsNoClicks = rows.filter(
    (row) => (row.gscPageClicks ?? 0) === 0 && (row.gscPageImpressions ?? 0) > 0,
  );
  if (withImpressionsNoClicks.length > 0) {
    return { filter: "zero_clicks", rows: withImpressionsNoClicks };
  }

  const noImpressions = filterInventoryByTraffic(rows, "no_impressions");
  if (noImpressions.length > 0) {
    return { filter: "no_impressions", rows: noImpressions };
  }

  return { filter: "all", rows: [...rows] };
}

/** SAP-only runs use the full entity inventory; posts/pages use auto traffic tiers. */
export function resolveSitemapOptimizerTrafficFilter(
  rows: readonly SitemapOptimizerPostRow[],
  options?: { entityOnly?: boolean },
): {
  filter: SitemapOptimizerTrafficFilter;
  rows: SitemapOptimizerPostRow[];
} {
  if (options?.entityOnly) {
    return { filter: "all", rows: [...rows] };
  }
  return applyAutoTrafficFilter(rows);
}

/** Join GSC metrics from analyzed rows back onto the full WordPress inventory. */
export function mergeGscMetricsOntoInventory(
  inventory: readonly SitemapOptimizerPostRow[],
  gscEnriched: readonly SitemapOptimizerPostRow[],
): SitemapOptimizerPostRow[] {
  const byPostId = new Map(gscEnriched.map((row) => [row.postId, row]));
  return inventory.map((row) => {
    const hit = byPostId.get(row.postId);
    if (!hit) {
      return {
        ...row,
        gscPageClicks: row.gscPageClicks ?? 0,
        gscPageImpressions: row.gscPageImpressions ?? 0,
        gscPageCtr: row.gscPageCtr ?? 0,
        gscPagePosition: row.gscPagePosition ?? 0,
        gscQueries: row.gscQueries ?? [],
        gscFetched: row.gscFetched ?? false,
      };
    }
    return {
      ...row,
      gscPageClicks: hit.gscPageClicks ?? 0,
      gscPageImpressions: hit.gscPageImpressions ?? 0,
      gscPageCtr: hit.gscPageCtr ?? 0,
      gscPagePosition: hit.gscPagePosition ?? 0,
      gscQueries: hit.gscQueries ?? [],
      gscFetched: hit.gscFetched ?? true,
    };
  });
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
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
      ret[idx] = await fn(items[idx]!);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), n);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return ret;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size) as T[]);
  }
  return out;
}

export async function enrichTrafficRowsWithQueries(
  siteUrl: string,
  rows: SitemapOptimizerPostRow[],
  dateRange: SitemapOptimizerGscDateRange,
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ rows: SitemapOptimizerPostRow[]; missCount: number }> {
  if (!rows.length) return { rows: [], missCount: 0 };

  let missCount = 0;
  let completed = 0;
  const perfByUrl = new Map<string, { queries: ReturnType<typeof gscPageQueriesToRows> }>();

  const chunks = chunk(rows, SITEMAP_OPTIMIZER_GSC_QUERY_BATCH_SIZE);
  await mapWithConcurrency(
    chunks,
    SITEMAP_OPTIMIZER_GSC_QUERY_BATCH_CONCURRENCY,
    async (urlChunk) => {
      const batch = await fetchGSCPagesPerformanceBatch(
        siteUrl,
        urlChunk.map((r) => r.url),
        dateRange.startDate,
        dateRange.endDate,
        signal,
        { strictPageMatch: true },
      );
      for (const p of batch.pages ?? []) {
        const key = normalizePageUrlKey(p.pageUrl);
        perfByUrl.set(key, { queries: gscPageQueriesToRows(p.queries ?? []) });
        if (p.matchedUrl?.trim()) {
          perfByUrl.set(normalizePageUrlKey(p.matchedUrl), {
            queries: gscPageQueriesToRows(p.queries ?? []),
          });
        }
      }
      completed += urlChunk.length;
      onProgress?.(completed, rows.length);
    },
    signal,
  );

  const enriched = rows.map((row) => {
    const perf = perfByUrl.get(normalizePageUrlKey(row.url));
    const queries = perf?.queries ?? [];
    if (!queries.length) missCount += 1;
    return { ...row, gscQueries: queries, gscFetched: true };
  });

  return { rows: enriched, missCount };
}

export type RunGscImportProgress = {
  phase: "sitewide" | "join" | "filter" | "queries";
  completed: number;
  total: number;
  label: string;
  sitePageCount?: number;
  inventoryCount?: number;
  analyzedCount?: number;
  trafficFilter?: SitemapOptimizerTrafficFilter;
};

export async function runSitemapOptimizerGscImport(args: {
  siteUrl: string;
  inventory: SitemapOptimizerPostRow[];
  dateRange: SitemapOptimizerGscDateRange;
  entityOnly?: boolean;
  onProgress?: (p: RunGscImportProgress) => void;
  signal?: AbortSignal;
}): Promise<{
  rows: SitemapOptimizerPostRow[];
  missCount: number;
  sitePageCount: number;
  analyzedCount: number;
  trafficFilter: SitemapOptimizerTrafficFilter;
}> {
  const { siteUrl, inventory, dateRange, entityOnly = false, onProgress, signal } = args;
  const inventoryCount = inventory.length;

  onProgress?.({
    phase: "sitewide",
    completed: 0,
    total: 1,
    label: "Sitewide: pulling page metrics from Search Console…",
    inventoryCount,
  });
  const siteRes = await fetchGSCSitePagesPerformance(
    siteUrl,
    dateRange.startDate,
    dateRange.endDate,
    signal,
  );
  const sitePages = siteRes.pages ?? [];
  onProgress?.({
    phase: "sitewide",
    completed: 1,
    total: 1,
    label: `Sitewide: ${sitePages.length} GSC URLs in date range`,
    sitePageCount: sitePages.length,
    inventoryCount,
  });

  onProgress?.({
    phase: "join",
    completed: 0,
    total: 1,
    label: `Matching ${inventoryCount} WordPress URLs to GSC pages…`,
    sitePageCount: sitePages.length,
    inventoryCount,
  });
  const withMetrics = joinInventoryWithSitePageMetrics(inventory, sitePages);
  onProgress?.({
    phase: "join",
    completed: 1,
    total: 1,
    label: `Matched metrics for ${inventoryCount} inventory URLs`,
    sitePageCount: sitePages.length,
    inventoryCount,
  });

  onProgress?.({
    phase: "filter",
    completed: 0,
    total: 1,
    label: entityOnly ? "Including all service areas…" : "Auto-selecting traffic slice…",
    sitePageCount: sitePages.length,
    inventoryCount,
  });
  const { filter: trafficFilter, rows: filtered } = resolveSitemapOptimizerTrafficFilter(
    withMetrics,
    { entityOnly },
  );
  const filterLabel = entityOnly
    ? SITEMAP_OPTIMIZER_TRAFFIC_FILTER_ENTITY_LABEL[trafficFilter]
    : SITEMAP_OPTIMIZER_TRAFFIC_FILTER_LABEL[trafficFilter];
  onProgress?.({
    phase: "filter",
    completed: 1,
    total: 1,
    label: entityOnly
      ? `${filtered.length} service areas`
      : `Auto: ${filtered.length} ${filterLabel.toLowerCase()}`,
    sitePageCount: sitePages.length,
    inventoryCount,
    analyzedCount: filtered.length,
    trafficFilter,
  });

  if (
    trafficFilter === "zero_clicks" ||
    trafficFilter === "no_impressions" ||
    trafficFilter === "all"
  ) {
    const rows = filtered.map((row) => ({
      ...row,
      gscQueries: row.gscQueries ?? [],
      gscFetched: true,
    }));
    const withQueryRows = rows.filter((row) => (row.gscPageClicks ?? 0) > 0);
    if (!withQueryRows.length) {
      return {
        rows,
        missCount: 0,
        sitePageCount: sitePages.length,
        analyzedCount: rows.length,
        trafficFilter,
      };
    }
    const { rows: enrichedWithQueries, missCount } = await enrichTrafficRowsWithQueries(
      siteUrl,
      withQueryRows,
      dateRange,
      (completed, total) =>
        onProgress?.({
          phase: "queries",
          completed,
          total,
          label: `Top queries ${completed} / ${total} URLs with clicks`,
          sitePageCount: sitePages.length,
          inventoryCount,
          analyzedCount: filtered.length,
        }),
      signal,
    );
    const enrichedById = new Map(enrichedWithQueries.map((row) => [row.postId, row]));
    const mergedRows = rows.map((row) => enrichedById.get(row.postId) ?? row);
    return {
      rows: mergedRows,
      missCount,
      sitePageCount: sitePages.length,
      analyzedCount: mergedRows.length,
      trafficFilter,
    };
  }

  const { rows, missCount } = await enrichTrafficRowsWithQueries(
    siteUrl,
    filtered,
    dateRange,
    (completed, total) =>
      onProgress?.({
        phase: "queries",
        completed,
        total,
        label: `Top queries ${completed} / ${total} URLs with clicks`,
        sitePageCount: sitePages.length,
        inventoryCount,
        analyzedCount: filtered.length,
      }),
    signal,
  );

  return {
    rows,
    missCount,
    sitePageCount: sitePages.length,
    analyzedCount: rows.length,
    trafficFilter,
  };
}
