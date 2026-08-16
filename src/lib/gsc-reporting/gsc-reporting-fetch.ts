/**
 * Fetch GSC reporting seed data from backend and return raw CSV text (no KB enrichment).
 * Uses POST /api/gsc/fetch-reporting-bundle: queries, page performance, sitemap list, indexed URL list.
 */
import type { GscCompareRanges } from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import {
  deriveGscCompareSignals,
  gscCompareSignalsFileContent,
  GSC_COMPARE_SIGNALS_FILENAME,
  type GscCompareKind,
} from "@/lib/gsc-reporting/gsc-reporting-compare-signals";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
/** Site-wide Search Analytics aggregate for one date range (no dimensions). */
export type GscSiteTotalsPreviousMonth = {
  label: string;
  startDate: string;
  endDate: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscReportingFetchResult = {
  files: { name: string; content: string }[];
  startDate: string;
  endDate: string;
  compareStartDate: string;
  compareEndDate: string;
  /** Legacy: only when fetch was single-period (no longer used from Reporting). */
  siteTotalsPreviousMonth: GscSiteTotalsPreviousMonth | null;
};

export type GscPagePerfRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date?: string;
};

/** Sitemap resource from webmasters v3 sitemaps.list (partial). */
export type GscSitemapApiRow = {
  path?: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  type?: string;
  errors?: number;
  warnings?: number;
  contents?: Array<{ type?: string; submitted?: string; indexed?: string }>;
};

function getApiBase(): string {
  return BACKEND_API_BASE;
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatCtr(ctr: number): string {
  const c = ctr <= 1 ? ctr * 100 : ctr;
  return `${c.toFixed(2)}%`;
}

function formatPosition(position: number): string {
  return typeof position === "number" ? position.toFixed(2) : String(position);
}

/** True when start/end are the first and last day of the same UTC calendar month. */
export function gscIsFullCalendarMonthRange(startIso: string, endIso: string): boolean {
  const a = startIso.trim();
  const b = endIso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return false;
  const s = new Date(`${a}T12:00:00.000Z`);
  const e = new Date(`${b}T12:00:00.000Z`);
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return false;
  const sy = s.getUTCFullYear();
  const sm = s.getUTCMonth();
  const sd = s.getUTCDate();
  const ey = e.getUTCFullYear();
  const em = e.getUTCMonth();
  const ed = e.getUTCDate();
  const lastDayOfMonth = new Date(Date.UTC(ey, em + 1, 0)).getUTCDate();
  return sy === ey && sm === em && sd === 1 && ed === lastDayOfMonth;
}

/**
 * Compact label for a YYYY-MM-DD range: full calendar month → "Mar 2026", else "start–end" ISO.
 * Used in MoM CSV headers so columns reflect actual fetch ranges.
 */
export function gscCompactPeriodLabelFromIsoRange(startIso: string, endIso: string): string {
  const a = startIso.trim();
  const b = endIso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) {
    return `${a}–${b}`;
  }
  const s = new Date(`${a}T12:00:00.000Z`);
  const e = new Date(`${b}T12:00:00.000Z`);
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) {
    return `${a}–${b}`;
  }
  if (gscIsFullCalendarMonthRange(a, b)) {
    return s.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return `${a}–${b}`;
}

function momQueriesPagesCsvHeaderRow(
  primaryRange: { start: string; end: string },
  compareRange: { start: string; end: string },
  firstCol: "Query" | "Page",
): string {
  const la = gscCompactPeriodLabelFromIsoRange(primaryRange.start, primaryRange.end);
  const lb = gscCompactPeriodLabelFromIsoRange(compareRange.start, compareRange.end);
  // Per metric: First (current) | Last (prior) | Change - same order the report must mirror.
  return [
    firstCol,
    `Clicks (${la})`,
    `Clicks (${lb})`,
    "Clicks Δ%",
    `Impressions (${la})`,
    `Impressions (${lb})`,
    "Impr Δ%",
    `CTR (${la})`,
    `CTR (${lb})`,
    "CTR Δ%",
    `Position (${la})`,
    `Position (${lb})`,
    "Pos Δ%",
  ].join(",");
}

/** Build a Queries.csv-style export from API rows (no Date column - period is the fetch range). */
export function gscQueriesToCsv(
  queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    date?: string;
  }>,
): string {
  const header = "Query,Clicks,Impressions,CTR,Position";
  const rows = queries.map((q) => {
    return [
      escapeCsvCell(q.query),
      String(q.clicks),
      String(q.impressions),
      formatCtr(q.ctr),
      formatPosition(q.position as number),
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

export type GscQueryPerfRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/**
 * SEO-style query report: one row per query with period A vs period B metrics and % change (same formula as site totals MoM).
 */
export function gscQueriesMomComparisonCsv(
  primary: GscQueryPerfRow[],
  compare: GscQueryPerfRow[],
  primaryRange: { start: string; end: string },
  compareRange: { start: string; end: string },
): string {
  const byQuery = new Map<string, { p?: GscQueryPerfRow; c?: GscQueryPerfRow }>();
  for (const r of primary) {
    const k = r.query.trim();
    if (!k) continue;
    byQuery.set(k, { ...(byQuery.get(k) ?? {}), p: r });
  }
  for (const r of compare) {
    const k = r.query.trim();
    if (!k) continue;
    byQuery.set(k, { ...(byQuery.get(k) ?? {}), c: r });
  }
  const keys = [...byQuery.keys()].sort((a, b) => {
    const ia = byQuery.get(a)?.p?.impressions ?? byQuery.get(a)?.c?.impressions ?? 0;
    const ib = byQuery.get(b)?.p?.impressions ?? byQuery.get(b)?.c?.impressions ?? 0;
    if (ib !== ia) return ib - ia;
    return a.localeCompare(b);
  });

  const lines: string[] = [
    "# Queries: MoM (one row per query; Search Analytics totals per period). Period names in column headers match the fetch ranges.",
    "#",
    momQueriesPagesCsvHeaderRow(primaryRange, compareRange, "Query"),
  ];

  const dashNum = (n: number | undefined): string => (n === undefined ? " - " : String(n));
  const pct = (a: number | undefined, b: number | undefined): string => {
    if (a === undefined || b === undefined) return " - ";
    return gscSiteTotalsPctChangeVsPrior(a, b);
  };

  for (const k of keys) {
    const { p, c } = byQuery.get(k)!;
    lines.push(
      [
        escapeCsvCell(k),
        dashNum(p?.clicks),
        dashNum(c?.clicks),
        pct(p?.clicks, c?.clicks),
        dashNum(p?.impressions),
        dashNum(c?.impressions),
        pct(p?.impressions, c?.impressions),
        p ? formatCtr(p.ctr) : " - ",
        c ? formatCtr(c.ctr) : " - ",
        pct(p?.ctr, c?.ctr),
        p ? formatPosition(p.position) : " - ",
        c ? formatPosition(c.position) : " - ",
        pct(p?.position, c?.position),
      ].join(","),
    );
  }
  return lines.join("\n");
}

/** Page-level Search Analytics (dimension: page). */
export function gscPagesToCsv(pages: GscPagePerfRow[]): string {
  const header = "Page,Clicks,Impressions,CTR,Position";
  const rows = pages.map((p) => {
    return [
      escapeCsvCell(p.page),
      String(p.clicks),
      String(p.impressions),
      formatCtr(p.ctr),
      formatPosition(p.position as number),
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

/**
 * SEO-style page report: one row per URL with period A vs period B metrics and % change.
 */
export function gscPagesMomComparisonCsv(
  primary: GscPagePerfRow[],
  compare: GscPagePerfRow[],
  primaryRange: { start: string; end: string },
  compareRange: { start: string; end: string },
): string {
  const byPage = new Map<string, { p?: GscPagePerfRow; c?: GscPagePerfRow }>();
  for (const r of primary) {
    const k = r.page.trim();
    if (!k) continue;
    byPage.set(k, { ...(byPage.get(k) ?? {}), p: r });
  }
  for (const r of compare) {
    const k = r.page.trim();
    if (!k) continue;
    byPage.set(k, { ...(byPage.get(k) ?? {}), c: r });
  }
  const keys = [...byPage.keys()].sort((a, b) => {
    const ia = byPage.get(a)?.p?.impressions ?? byPage.get(a)?.c?.impressions ?? 0;
    const ib = byPage.get(b)?.p?.impressions ?? byPage.get(b)?.c?.impressions ?? 0;
    if (ib !== ia) return ib - ia;
    return a.localeCompare(b);
  });

  const lines: string[] = [
    "# Pages: MoM (one row per URL; Search Analytics totals per period). Period names in column headers match the fetch ranges.",
    "#",
    momQueriesPagesCsvHeaderRow(primaryRange, compareRange, "Page"),
  ];

  const dashNum = (n: number | undefined): string => (n === undefined ? " - " : String(n));
  const pct = (a: number | undefined, b: number | undefined): string => {
    if (a === undefined || b === undefined) return " - ";
    return gscSiteTotalsPctChangeVsPrior(a, b);
  };

  for (const k of keys) {
    const { p, c } = byPage.get(k)!;
    lines.push(
      [
        escapeCsvCell(k),
        dashNum(p?.clicks),
        dashNum(c?.clicks),
        pct(p?.clicks, c?.clicks),
        dashNum(p?.impressions),
        dashNum(c?.impressions),
        pct(p?.impressions, c?.impressions),
        p ? formatCtr(p.ctr) : " - ",
        c ? formatCtr(c.ctr) : " - ",
        pct(p?.ctr, c?.ctr),
        p ? formatPosition(p.position) : " - ",
        c ? formatPosition(c.position) : " - ",
        pct(p?.position, c?.position),
      ].join(","),
    );
  }
  return lines.join("\n");
}

/** One-row scorecard CSV for previous calendar month (matches GSC Performance monthly totals). */
export function gscSiteTotalsPreviousMonthToCsv(t: GscSiteTotalsPreviousMonth): string {
  const lines = [
    "# Site-wide Search performance (all queries and pages aggregated)",
    `# Previous calendar month: ${t.label}`,
    `# Range: ${t.startDate} → ${t.endDate}. In GSC: Performance → set date to this range → Monthly.`,
    "#",
    "Metric,Value",
    `Total clicks,${t.clicks}`,
    `Total impressions,${t.impressions}`,
    `Average CTR,${formatCtr(t.ctr)}`,
    `Average position,${formatPosition(t.position)}`,
  ];
  return lines.join("\n");
}

/** Site-wide aggregate for one reporting period (same shape as {@link GscSiteTotalsPreviousMonth}). */
export function gscSitePeriodTotalsToCsv(t: GscSiteTotalsPreviousMonth, periodTitle: string): string {
  const lines = [
    "# Site-wide Search performance (all queries and pages aggregated)",
    `# ${periodTitle}: ${t.label}`,
    `# Range: ${t.startDate} → ${t.endDate}. In GSC: Performance → set date to this range → Monthly.`,
    "#",
    "Metric,Value",
    `Total clicks,${t.clicks}`,
    `Total impressions,${t.impressions}`,
    `Average CTR,${formatCtr(t.ctr)}`,
    `Average position,${formatPosition(t.position)}`,
  ];
  return lines.join("\n");
}

/** Percent change vs prior period: `((current − prior) / prior) × 100`, or em dash when invalid. */
export function gscSiteTotalsPctChangeVsPrior(primary: number, compare: number): string {
  if (compare === 0) return " - ";
  const v = ((primary - compare) / compare) * 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

/**
 * Single scorecard CSV: period A vs period B site-wide aggregates with % change per metric.
 * Value columns use the same formatting as single-period exports; % uses raw API numbers.
 */
export function gscSiteTotalsMomComparisonCsv(
  aggregatePrimary: GscSiteTotalsPreviousMonth | null,
  aggregateCompare: GscSiteTotalsPreviousMonth | null,
  queryCountPrimary: number,
  queryCountCompare: number,
): string {
  const colA =
    aggregatePrimary != null
      ? gscCompactPeriodLabelFromIsoRange(aggregatePrimary.startDate, aggregatePrimary.endDate)
      : "Period A";
  const colB =
    aggregateCompare != null
      ? gscCompactPeriodLabelFromIsoRange(aggregateCompare.startDate, aggregateCompare.endDate)
      : "Period B";
  const lines: string[] = [
    "# Site-wide Search performance (MoM). Value columns use the same period labels as the header row; in GSC use Monthly and match dates.",
    "#",
    `Metric,${escapeCsvCell(colA)},${escapeCsvCell(colB)},% change vs prior`,
  ];

  const dash = (n: number | null | undefined): string =>
    n === null || n === undefined ? " - " : String(n);
  const pctCell = (p: number | null | undefined, c: number | null | undefined): string => {
    if (p === null || p === undefined || c === null || c === undefined) return " - ";
    return gscSiteTotalsPctChangeVsPrior(p, c);
  };

  const p = aggregatePrimary;
  const c = aggregateCompare;

  lines.push(
    `Total clicks,${dash(p?.clicks)},${dash(c?.clicks)},${pctCell(p?.clicks, c?.clicks)}`,
  );
  lines.push(
    `Total impressions,${dash(p?.impressions)},${dash(c?.impressions)},${pctCell(p?.impressions, c?.impressions)}`,
  );
  lines.push(
    `Search queries,${queryCountPrimary},${queryCountCompare},${gscSiteTotalsPctChangeVsPrior(queryCountPrimary, queryCountCompare)}`,
  );
  lines.push(
    `Average CTR,${p ? formatCtr(p.ctr) : " - "},${c ? formatCtr(c.ctr) : " - "},${pctCell(p?.ctr, c?.ctr)}`,
  );
  lines.push(
    `Average position,${p ? formatPosition(p.position) : " - "},${c ? formatPosition(c.position) : " - "},${pctCell(
      p?.position,
      c?.position,
    )}`,
  );

  return lines.join("\n");
}

/**
 * Unique URLs that had Search traffic in the range (page dimension). Same semantics as POST /api/gsc/url-inventory.
 */
export function gscIndexedUrlsCsvFromPages(
  pages: GscPagePerfRow[],
  startDate: string,
  endDate: string,
): string {
  const lines: string[] = [
    `# Indexed pages proxy (${startDate} → ${endDate})`,
    "# Each URL had at least one impression in Google Search in this date range (Search Analytics API, page dimension).",
    "# The Indexing → Indexed pages report in the GSC UI is not available via API; this list is the standard bulk substitute.",
    "#",
    "URL",
  ];
  const uniq = [...new Set(pages.map((p) => p.page.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  for (const u of uniq) lines.push(escapeCsvCell(u));
  return lines.join("\n");
}

export function gscSitemapsToCsv(sitemaps: GscSitemapApiRow[]): string {
  const header =
    "Path,LastSubmitted,LastDownloaded,Errors,Warnings,IsPending,IsSitemapsIndex,Type,SubmittedWeb,IndexedWeb";
  const rows = sitemaps.map((s) => {
    const contents = Array.isArray(s.contents) ? s.contents : [];
    const web = contents.find((c) => c?.type === "web") ?? contents[0];
    const submitted = web?.submitted != null ? String(web.submitted) : "";
    const indexed = web?.indexed != null ? String(web.indexed) : "";
    return [
      escapeCsvCell(String(s.path ?? "")),
      escapeCsvCell(String(s.lastSubmitted ?? "")),
      escapeCsvCell(String(s.lastDownloaded ?? "")),
      String(s.errors ?? ""),
      String(s.warnings ?? ""),
      String(Boolean(s.isPending)),
      String(Boolean(s.isSitemapsIndex)),
      escapeCsvCell(String(s.type ?? "")),
      escapeCsvCell(submitted),
      escapeCsvCell(indexed),
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

export type GscReportingFetchOptions = {
  compareKind?: GscCompareKind;
  compareLabel?: string;
};

export async function fetchGscQueriesRawForReporting(
  siteUrl: string,
  ranges: GscCompareRanges,
  options?: GscReportingFetchOptions,
): Promise<GscReportingFetchResult> {
  const API_BASE = getApiBase();

  const startDateStr = ranges.primary.startDate.trim();
  const endDateStr = ranges.primary.endDate.trim();
  const compareStartDateStr = ranges.compare.startDate.trim();
  const compareEndDateStr = ranges.compare.endDate.trim();

  const response = await fetch(`${API_BASE}/api/gsc/fetch-reporting-bundle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      siteUrl,
      startDate: startDateStr,
      endDate: endDateStr,
      compareStartDate: compareStartDateStr,
      compareEndDate: compareEndDateStr,
    }),
  });

  const data = (await response.json()) as {
    success?: boolean;
    error?: string;
    queries?: Array<{
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
      date?: string;
    }>;
    pages?: GscPagePerfRow[];
    pagesError?: string;
    compareQueries?: Array<{
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
      date?: string;
    }>;
    comparePages?: GscPagePerfRow[];
    comparePagesError?: string;
    siteTotalsPreviousMonth?: GscSiteTotalsPreviousMonth | null;
    aggregatePrimary?: GscSiteTotalsPreviousMonth | null;
    aggregateCompare?: GscSiteTotalsPreviousMonth | null;
    sitemaps?: GscSitemapApiRow[];
    sitemapsError?: string;
  };

  if (!response.ok || !data.success) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  const queries = data.queries ?? [];
  const pages = data.pages ?? [];
  const compareQueries = data.compareQueries ?? [];
  const comparePages = data.comparePages ?? [];

  const hasAnyData =
    queries.length > 0 ||
    pages.length > 0 ||
    compareQueries.length > 0 ||
    comparePages.length > 0;
  if (!hasAnyData) {
    throw new Error("No GSC queries or page rows returned for either period in this comparison.");
  }

  const files: { name: string; content: string }[] = [];

  const toQueryPerf = (rows: typeof queries): GscQueryPerfRow[] =>
    rows.map((r) => ({
      query: r.query,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));

  if (queries.length || compareQueries.length) {
    files.push({
      name: "Queries-MoM.csv",
      content: gscQueriesMomComparisonCsv(
        toQueryPerf(queries),
        toQueryPerf(compareQueries),
        { start: startDateStr, end: endDateStr },
        { start: compareStartDateStr, end: compareEndDateStr },
      ),
    });
  } else {
    files.push({
      name: "Queries-MoM.csv",
      content: `# No query rows in either period (period A ${startDateStr} → ${endDateStr}, period B ${compareStartDateStr} → ${compareEndDateStr}).\n`,
    });
  }

  if (pages.length || comparePages.length) {
    files.push({
      name: "Pages-MoM.csv",
      content: gscPagesMomComparisonCsv(pages, comparePages, { start: startDateStr, end: endDateStr }, {
        start: compareStartDateStr,
        end: compareEndDateStr,
      }),
    });
  } else {
    const err = data.pagesError?.trim() || data.comparePagesError?.trim() || "No page rows returned.";
    files.push({
      name: "Pages-MoM.csv",
      content: `# No page rows in either period.\n# ${String(err).replace(/\n/g, "\n# ")}\n`,
    });
  }

  if (pages.length) {
    files.push({
      name: "Indexed-pages-urls-current.csv",
      content: gscIndexedUrlsCsvFromPages(pages, startDateStr, endDateStr),
    });
  } else {
    const err = data.pagesError?.trim() || "No page rows returned.";
    files.push({
      name: "Indexed-pages-urls-current.csv",
      content: `# ${err}\n# URL\n`,
    });
  }

  if (comparePages.length) {
    files.push({
      name: "Indexed-pages-urls-period-b.csv",
      content: gscIndexedUrlsCsvFromPages(comparePages, compareStartDateStr, compareEndDateStr),
    });
  } else {
    const err = data.comparePagesError?.trim() || "No page rows returned.";
    files.push({
      name: "Indexed-pages-urls-period-b.csv",
      content: `# ${err}\n# URL\n`,
    });
  }

  const aggP = data.aggregatePrimary ?? null;
  const aggC = data.aggregateCompare ?? null;
  files.push({
    name: "Site-totals-MoM.csv",
    content: gscSiteTotalsMomComparisonCsv(aggP, aggC, queries.length, compareQueries.length),
  });

  const compareKind = options?.compareKind ?? "mom";
  const compareLabel =
    options?.compareLabel ??
    `${gscCompactPeriodLabelFromIsoRange(startDateStr, endDateStr)} vs ${gscCompactPeriodLabelFromIsoRange(compareStartDateStr, compareEndDateStr)}`;
  const compareSignals = deriveGscCompareSignals({
    compareKind,
    compareLabel,
    aggregatePrimary: aggP,
    aggregateCompare: aggC,
    queryCountPrimary: queries.length,
    queryCountCompare: compareQueries.length,
    primaryQueries: toQueryPerf(queries),
    compareQueries: toQueryPerf(compareQueries),
  });
  if (compareSignals) {
    files.push({
      name: GSC_COMPARE_SIGNALS_FILENAME,
      content: gscCompareSignalsFileContent(compareSignals),
    });
  }

  const sm = data.sitemaps;
  if (Array.isArray(sm) && sm.length > 0) {
    files.push({ name: "GSC-sitemaps.csv", content: gscSitemapsToCsv(sm) });
  } else {
    const err = data.sitemapsError?.trim() || "No sitemap entries returned.";
    files.push({
      name: "GSC-sitemaps.csv",
      content: `# Sitemap list could not be loaded or is empty.\n# ${err.replace(/\n/g, "\n# ")}\n`,
    });
  }

  return {
    files,
    startDate: startDateStr,
    endDate: endDateStr,
    compareStartDate: compareStartDateStr,
    compareEndDate: compareEndDateStr,
    siteTotalsPreviousMonth: data.siteTotalsPreviousMonth ?? null,
  };
}
