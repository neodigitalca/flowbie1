/**
 * Display Semrush-style metrics in reports and tables: whole numbers + en-US grouping
 * (avoids float artifacts like 16.529999999999998 in pasted Markdown).
 */
export function formatCompetitorMetricCell(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString("en-US");
}
