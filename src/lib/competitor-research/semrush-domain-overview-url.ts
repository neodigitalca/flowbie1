/**
 * Opens Semrush Domain Overview for a root domain in a regional database (matches API `database`).
 */
export function semrushDomainOverviewUrl(domain: string, database: string): string {
  const q = encodeURIComponent(domain.trim().replace(/^www\./i, ""));
  const db = encodeURIComponent((database || "us").trim());
  return `https://www.semrush.com/analytics/overview/?searchType=domain&q=${q}&db=${db}`;
}
