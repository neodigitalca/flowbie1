import { LEGACY_REDIRECT_GRID_PAGE_SIZE } from "@/lib/sitemap-optimizer/constants";
import { DEFAULT_BLOG_PERMALINK_PREFIX } from "@/lib/sitemap-optimizer/blog-destination-url";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import {
  normalizeRankMathRelativePath,
  rankMathSourceFromPageUrl,
} from "@/lib/rank-math-redirect-csv";
import type {
  LegacyRedirectGridRow,
  LegacyRedirectMatchRow,
} from "@/lib/sitemap-optimizer/types";

export { LEGACY_REDIRECT_GRID_PAGE_SIZE };

/** Grid display: path only, no host. Full URL kept on row for matching and links. */
export function legacyRedirectGridDisplayPath(fullUrl: string): string {
  const trimmed = fullUrl.trim();
  if (!trimmed) return "";
  return (
    rankMathSourceFromPageUrl(trimmed) ??
    normalizeRankMathRelativePath(trimmed) ??
    trimmed
  );
}

/** Match grid upload lines to Gemini legacy URLs (path-only or full URL). */
export function legacyRedirectLegacyMatchKey(urlOrPath: string): string {
  const path = legacyRedirectGridDisplayPath(urlOrPath);
  if (path) return path.toLowerCase();
  return normalizePageUrlKey(urlOrPath);
}

function splitRawSheetLines(text: string): string[] {
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    const ch = text[i];
    if (i === text.length || ch === "\n" || ch === "\r") {
      const line = text.slice(start, i).trim();
      if (line && line.toLowerCase() !== "url") lines.push(line);
      if (ch === "\r" && text[i + 1] === "\n") i++;
      start = i + 1;
    }
  }
  return lines;
}

/** Display rows from raw upload text (no API). Gemini reads the sheet on Generate. */
export function buildLegacyRedirectGridRowsFromSheetLines(text: string): LegacyRedirectGridRow[] {
  return buildLegacyRedirectGridRowsFromUrls(splitRawSheetLines(text));
}

export function buildLegacyRedirectGridRowsFromUrls(
  urls: readonly string[],
): LegacyRedirectGridRow[] {
  const rows: LegacyRedirectGridRow[] = [];
  for (let i = 0; i < urls.length; i++) {
    const legacyUrl = urls[i]!.trim();
    if (!legacyUrl) continue;
    rows.push({
      uploadRow: rows.length + 1,
      legacyUrl,
      destinationUrl: "",
    });
  }
  return rows;
}

export function mergeLegacyRedirectMatchesIntoGrid(
  rows: readonly LegacyRedirectGridRow[],
  matches: readonly LegacyRedirectMatchRow[],
): LegacyRedirectGridRow[] {
  const destinationByLegacyKey = new Map<string, string>();
  for (const match of matches) {
    const destinationUrl = match.destinationUrl.trim();
    if (!destinationUrl) continue;
    const key = legacyRedirectLegacyMatchKey(match.legacyUrl);
    if (!destinationByLegacyKey.has(key)) {
      destinationByLegacyKey.set(key, destinationUrl);
    }
  }

  return rows.map((row) => {
    const destinationUrl = destinationByLegacyKey.get(legacyRedirectLegacyMatchKey(row.legacyUrl));
    if (!destinationUrl) return row;
    return { ...row, destinationUrl };
  });
}

/** Connected site origin with trailing slash (homepage redirect target). */
export function resolveLegacyRedirectSiteDomainUrl(siteUrl: string): string {
  const trimmed = siteUrl.trim();
  if (!trimmed) return "";
  try {
    return `${new URL(trimmed).origin}/`;
  } catch {
    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  }
}

/** Site /blog/ index used when Gemini finds no specific destination. */
export function resolveLegacyRedirectDefaultBlogUrl(
  siteUrl: string,
  allowedDestinationUrls: readonly string[],
): string {
  for (const url of allowedDestinationUrls) {
    const path = legacyRedirectGridDisplayPath(url).replace(/\/+$/, "").toLowerCase();
    if (path === DEFAULT_BLOG_PERMALINK_PREFIX.replace(/\/+$/, "")) {
      const trimmed = url.trim();
      return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
    }
  }

  try {
    const origin = new URL(siteUrl.trim()).origin;
    return `${origin}/${DEFAULT_BLOG_PERMALINK_PREFIX}`;
  } catch {
    return "";
  }
}

/** After matching, fill any upload row still blank with the default /blog/ redirect. */
export function applyLegacyRedirectBlogDefaultsToMatches(args: {
  legacySheetText: string;
  matchedRows: readonly LegacyRedirectMatchRow[];
  defaultBlogUrl: string;
}): LegacyRedirectMatchRow[] {
  const { legacySheetText, matchedRows, defaultBlogUrl } = args;
  const defaultDest = defaultBlogUrl.trim();
  if (!defaultDest) return [...matchedRows];

  const legacyUrls = splitRawSheetLines(legacySheetText);
  const matchByKey = new Map<string, LegacyRedirectMatchRow>();
  for (const row of matchedRows) {
    const dest = row.destinationUrl.trim();
    if (!dest) continue;
    const key = legacyRedirectLegacyMatchKey(row.legacyUrl);
    if (!matchByKey.has(key)) matchByKey.set(key, row);
  }

  return legacyUrls.map((legacyUrl, index) => {
    const key = legacyRedirectLegacyMatchKey(legacyUrl);
    const existing = matchByKey.get(key);
    if (existing?.destinationUrl.trim()) {
      return { ...existing, uploadRow: index + 1, legacyUrl };
    }
    return {
      legacyUrl,
      destinationUrl: defaultDest,
      uploadRow: index + 1,
    };
  });
}

export function legacyRedirectMatchesToGridRows(
  matches: readonly LegacyRedirectMatchRow[],
): LegacyRedirectGridRow[] {
  return matches.map((match) => ({
    uploadRow: match.uploadRow,
    legacyUrl: match.legacyUrl,
    destinationUrl: match.destinationUrl,
  }));
}

export function legacyRedirectGridPageCount(
  rowCount: number,
  pageSize = LEGACY_REDIRECT_GRID_PAGE_SIZE,
): number {
  if (rowCount <= 0) return 0;
  return Math.ceil(rowCount / pageSize);
}

export function sliceLegacyRedirectGridPage(
  rows: readonly LegacyRedirectGridRow[],
  pageIndex: number,
  pageSize = LEGACY_REDIRECT_GRID_PAGE_SIZE,
): LegacyRedirectGridRow[] {
  if (pageIndex < 1 || !rows.length) return [];
  const start = (pageIndex - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
