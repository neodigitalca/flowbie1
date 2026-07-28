/**
 * Previous calendar month in UTC - matches Search Console "Last month" style
 * (same semantics as getOverviewGscExportDateRange in server/gsc-performance.js).
 */
export function getPreviousCalendarMonthUtcRange(): { startStr: string; endStr: string } {
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const endPrevMonth = new Date(Date.UTC(y, m, 0));
  const startPrevMonth = new Date(Date.UTC(y, m - 1, 1));
  return {
    startStr: startPrevMonth.toISOString().slice(0, 10),
    endStr: endPrevMonth.toISOString().slice(0, 10),
  };
}
