/**
 * GMB pull-stats date ranges. Uses rolling 28-day windows so both periods have
 * enough days for meaningful stats (avoids "current = 2 days" at start of month).
 * End date is (today - DATA_LAG_DAYS) to account for API data lag.
 */

const DATA_LAG_DAYS = 3;
const CURRENT_PERIOD_DAYS = 28;
const COMPARISON_PERIOD_DAYS = 28;

function formatYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Returns startDate, endDate (current period) and compareStartDate, compareEndDate
 * (previous period). Both are 28-day windows ending at (today - DATA_LAG_DAYS).
 */
export function getGMBPullDateRanges(): {
  startDate: string;
  endDate: string;
  compareStartDate: string;
  compareEndDate: string;
} {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() - DATA_LAG_DAYS);

  const currentEnd = new Date(periodEnd);
  const currentStart = new Date(periodEnd);
  currentStart.setDate(currentStart.getDate() - CURRENT_PERIOD_DAYS + 1);

  const compareEnd = new Date(currentStart);
  compareEnd.setDate(compareEnd.getDate() - 1);
  const compareStart = new Date(compareEnd);
  compareStart.setDate(compareStart.getDate() - COMPARISON_PERIOD_DAYS + 1);

  return {
    startDate: formatYMD(currentStart),
    endDate: formatYMD(currentEnd),
    compareStartDate: formatYMD(compareStart),
    compareEndDate: formatYMD(compareEnd),
  };
}
