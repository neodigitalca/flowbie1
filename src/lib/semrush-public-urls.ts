/**
 * Public Semrush web URLs (no API) for opening keyword research in the browser.
 */

const KEYWORD_OVERVIEW_BASE = "https://www.semrush.com/analytics/keywordoverview/";

/**
 * @param database - Semrush regional DB code (default `us`), e.g. `ca`, `uk`.
 */
export function getSemrushKeywordOverviewUrl(
  keyword: string,
  database: string = "us"
): string | null {
  const q = keyword.trim();
  if (!q) return null;
  const db = (database || "us").trim().toLowerCase() || "us";
  const params = new URLSearchParams({
    q,
    db,
  });
  return `${KEYWORD_OVERVIEW_BASE}?${params.toString()}`;
}
