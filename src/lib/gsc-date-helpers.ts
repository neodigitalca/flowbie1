/**
 * Date range calculation helpers for GSC report generation
 */

export type DateRangePreset = 'month-to-month' | 'year-over-year' | 'same-period-last-month' | 'similar-timeframe' | 'progress-report' | 'custom';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface ComparisonDateRanges {
  current: DateRange;
  comparison: DateRange;
}

/**
 * Calculate month-to-month date ranges.
 * Current = most recent **complete** calendar month (last month).
 * Comparison = the full calendar month before that.
 * e.g. In April 2026 → Current Mar 1–31, Comparison Feb 1–28.
 */
export function calculateMonthToMonth(reference: Date = new Date()): ComparisonDateRanges {
  const now = reference;
  const y = now.getFullYear();
  const m = now.getMonth(); // 0=Jan, 11=Dec

  let curM = m - 1;
  let curY = y;
  if (curM < 0) {
    curM += 12;
    curY -= 1;
  }

  let cmpM = curM - 1;
  let cmpY = curY;
  if (cmpM < 0) {
    cmpM += 12;
    cmpY -= 1;
  }

  const currentStart = new Date(curY, curM, 1);
  const currentEnd = new Date(curY, curM + 1, 0);
  const comparisonStart = new Date(cmpY, cmpM, 1);
  const comparisonEnd = new Date(cmpY, cmpM + 1, 0);

  return {
    current: { startDate: currentStart, endDate: currentEnd },
    comparison: { startDate: comparisonStart, endDate: comparisonEnd },
  };
}

/**
 * Calculate year-over-year date ranges
 * Same date range from previous year
 */
export function calculateYearOverYear(startDate: Date, endDate: Date): ComparisonDateRanges {
  const comparisonStart = new Date(startDate);
  comparisonStart.setFullYear(startDate.getFullYear() - 1);
  
  const comparisonEnd = new Date(endDate);
  comparisonEnd.setFullYear(endDate.getFullYear() - 1);
  
  return {
    current: { startDate, endDate },
    comparison: { startDate: comparisonStart, endDate: comparisonEnd }
  };
}

/**
 * Same period in previous month (e.g. Jan 1-14 → Dec 1-14)
 */
export function calculatePreviousMonthSamePeriod(startDate: Date, endDate: Date): ComparisonDateRanges {
  const comparisonStart = new Date(startDate);
  comparisonStart.setMonth(comparisonStart.getMonth() - 1);
  const comparisonEnd = new Date(endDate);
  comparisonEnd.setMonth(comparisonEnd.getMonth() - 1);
  return {
    current: { startDate, endDate },
    comparison: { startDate: comparisonStart, endDate: comparisonEnd },
  };
}

/**
 * Calculate similar timeframe (immediately preceding period of same length)
 * e.g. Jan 1-14 → Dec 18-31
 */
export function calculateSimilarTimeframe(startDate: Date, endDate: Date): ComparisonDateRanges {
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const comparisonEnd = new Date(startDate);
  comparisonEnd.setDate(comparisonEnd.getDate() - 1); // Day before current start
  
  const comparisonStart = new Date(comparisonEnd);
  comparisonStart.setDate(comparisonStart.getDate() - daysDiff);
  
  return {
    current: { startDate, endDate },
    comparison: { startDate: comparisonStart, endDate: comparisonEnd }
  };
}

/**
 * Calculate progress report date ranges.
 * Current  = FIRST month you pick (full calendar month).
 * Comparison = MOST RECENT complete month (full calendar month).
 *
 * Example: startMonth = Aug 2025, today in Mar 2026 (so last full month = Feb 2026)
 * - current    = Aug 1–31 2025
 * - comparison = Feb 1–28 2026
 */
export function calculateProgressReport(startMonth: Date): ComparisonDateRanges {
  const now = new Date();

  // Current = full startMonth
  const startY = startMonth.getFullYear();
  const startM = startMonth.getMonth();
  const currentStart = new Date(startY, startM, 1);
  const currentEnd = new Date(startY, startM + 1, 0);

  // Comparison = last fully-completed month
  let endM = now.getMonth() - 1;
  let endY = now.getFullYear();
  if (endM < 0) { endM += 12; endY -= 1; }
  const comparisonStart = new Date(endY, endM, 1);
  const comparisonEnd = new Date(endY, endM + 1, 0);

  return {
    current: { startDate: currentStart, endDate: currentEnd },
    comparison: { startDate: comparisonStart, endDate: comparisonEnd },
  };
}

/**
 * Format YYYY-MM-DD to "Month Year" (e.g. "December 2024").
 * Uses UTC to avoid timezone shift - report dates are calendar dates, not moments.
 */
export function formatMonthYearFromAPI(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Format YYYY-MM-DD to "Mon Year" (e.g. "Dec 2024"). Uses UTC.
 */
export function formatShortMonthYearFromAPI(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Format date range for display
 */
export function formatDateRange(range: DateRange): string {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  return `${formatDate(range.startDate)} - ${formatDate(range.endDate)}`;
}

/**
 * Format date for API (YYYY-MM-DD)
 */
export function formatDateForAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse date from API format (YYYY-MM-DD)
 */
export function parseDateFromAPI(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z');
}

/**
 * Validate date range
 */
export function validateDateRange(range: DateRange): { valid: boolean; error?: string } {
  if (isNaN(range.startDate.getTime()) || isNaN(range.endDate.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }
  
  if (range.startDate >= range.endDate) {
    return { valid: false, error: 'Start date must be before end date' };
  }
  
  // Allow up to today; GSC may have partial data for recent dates
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (range.endDate > today) {
    return { valid: false, error: 'End date cannot be in the future' };
  }
  
  return { valid: true };
}

/**
 * Validate comparison date ranges (both must be individually valid).
 * No length-matching requirement - month-to-month comparisons naturally
 * have different day counts (e.g. Feb 28 vs Jan 31) and that's fine.
 */
export function validateComparisonRanges(ranges: ComparisonDateRanges): { valid: boolean; error?: string } {
  const currentValidation = validateDateRange(ranges.current);
  if (!currentValidation.valid) {
    return currentValidation;
  }
  
  const comparisonValidation = validateDateRange(ranges.comparison);
  if (!comparisonValidation.valid) {
    return comparisonValidation;
  }
  
  return { valid: true };
}

