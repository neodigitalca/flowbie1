/**
 * Build Google Search Console Performance (Search analytics) URLs for validating
 * API/CSV rows in the UI. Uses fixed start_date/end_date only - do not send num_of_days,
 * which the UI treats as a rolling “last N days” window and conflicts with comparison ranges.
 */

import { gscIsFullCalendarMonthRange } from "@/lib/gsc-reporting/gsc-reporting-fetch";

export type GscFetchDateRange = { startDate: string; endDate: string };

/** Inclusive day count for YYYY-MM-DD strings (UTC). */
export function inclusiveDayCountUtc(startIso: string, endIso: string): number {
  const s = new Date(`${startIso}T12:00:00.000Z`);
  const e = new Date(`${endIso}T12:00:00.000Z`);
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return 90;
  const diff = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 90;
}

/**
 * Value for `resource_id` query param: URL-prefix with trailing slash, or sc-domain:…
 */
export function normalizeGscResourceIdForUi(siteUrl: string): string {
  const s = siteUrl.trim();
  if (!s) return s;
  if (/^sc-domain:/i.test(s)) return s;
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    let path = u.pathname || "/";
    if (!path.endsWith("/")) path = `${path}/`;
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return s;
  }
}

export type GscPerformanceLinkOptions = {
  siteUrl: string;
  /** When set (Fetch GSC), matches API range; uploaded CSVs omit date params. */
  range?: GscFetchDateRange | null;
  /** Pre-filter table by query (Queries dimension). */
  query?: string | null;
  /** Pre-filter by page URL (Pages dimension). */
  pageUrl?: string | null;
};

const GSC_SEARCH_ANALYTICS =
  "https://search.google.com/search-console/performance/search-analytics";

/**
 * GSC Search Analytics deep links use a leading `!` on the query filter value so the UI
 * applies the same row-level filter as the Performance table (matches the `query` URL param
 * when copying a filtered view from Search Console).
 */
export function gscSearchAnalyticsQueryParamValue(rawQuery: string): string {
  const t = rawQuery.trim();
  if (!t) return t;
  return t.startsWith("!") ? t : `!${t}`;
}

/**
 * Opens Search Analytics for the property with a **fixed** custom date range (start_date/end_date).
 * Full calendar months use MONTH granularity; other spans use DAY so GSC shows the exact comparison window.
 */
export function buildGscSearchAnalyticsUrl(opts: GscPerformanceLinkOptions): string {
  const resourceId = normalizeGscResourceIdForUi(opts.siteUrl);
  const params = new URLSearchParams();
  params.set("resource_id", resourceId);

  const range = opts.range;
  if (range?.startDate && range?.endDate) {
    params.set("start_date", range.startDate);
    params.set("end_date", range.endDate);
    params.set(
      "time_granularity",
      gscIsFullCalendarMonthRange(range.startDate, range.endDate) ? "MONTH" : "DAY",
    );
  }

  const q = opts.query?.trim();
  const p = opts.pageUrl?.trim();
  if (q) {
    params.set("breakdown", "query");
    params.set("query", gscSearchAnalyticsQueryParamValue(q));
  } else if (p) {
    params.set("breakdown", "page");
    params.set("page", p);
  }

  return `${GSC_SEARCH_ANALYTICS}?${params.toString()}`;
}

export function gscValidateLinkTooltip(opts: {
  range: GscFetchDateRange | null;
  dimension: "query" | "page";
  value: string;
}): string {
  const v = opts.value.trim();
  const dim = opts.dimension === "query" ? "query" : "page URL";
  if (opts.range) {
    return `Open Google Search Console Performance (same property). API range ${opts.range.startDate} → ${opts.range.endDate}. After load, confirm ${dim}: ${v.slice(0, 120)}${v.length > 120 ? "…" : ""}`;
  }
  return `Open Google Search Console Performance (same property). Set a custom date range to match your CSV, then find this ${dim}: ${v.slice(0, 120)}${v.length > 120 ? "…" : ""}`;
}

/** Which dimension column gets a GSC validation link for this CSV. */
export function detectGscTableRowLinkKind(fileName: string, headers: string[]): "query" | "page" | "none" {
  const fn = fileName.toLowerCase();
  if (fn.includes("sitemap")) return "none";
  if (fn.includes("site-totals")) return "none";
  if (fn.includes("queries")) return "query";
  if (fn.includes("pages") && !fn.includes("indexed")) return "page";
  if (fn.includes("indexed")) return "page";
  const h = headers.map((x) => x.trim().toLowerCase());
  if (h.some((x) => x === "query" || x === "top queries" || x === "search query")) return "query";
  if (h.some((x) => x === "page" || x === "url")) return "page";
  return "none";
}

export function findGscDimensionColumnIndex(headers: string[], kind: "query" | "page"): number {
  const h = headers.map((x) => x.trim().toLowerCase());
  if (kind === "query") {
    const i = h.findIndex((x) =>
      x === "query" ||
      x === "queries" ||
      x === "top queries" ||
      x === "search query",
    );
    return i >= 0 ? i : 0;
  }
  const i = h.findIndex((x) => x === "page" || x === "url");
  return i >= 0 ? i : 0;
}
