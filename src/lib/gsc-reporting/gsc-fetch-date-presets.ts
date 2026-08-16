/**
 * Two-period presets for GSC reporting fetch (month-over-month by default).
 * Period A = last full calendar month; period B = the full month before that (standard MoM).
 */

import { calculateMonthToMonth, calculateYearOverYear, formatDateForAPI } from "@/lib/gsc-date-helpers";

export type GscReportingComparePresetId = "mom" | "yoy" | "custom_compare";

export const GSC_REPORTING_COMPARE_PRESET_OPTIONS: { id: GscReportingComparePresetId; label: string }[] = [
  { id: "mom", label: "Month vs month (last full month vs previous)" },
  { id: "yoy", label: "Year over year (last full month vs same month last year)" },
  { id: "custom_compare", label: "Custom period ranges…" },
];

export type GscCompareRanges = {
  primary: { startDate: string; endDate: string };
  compare: { startDate: string; endDate: string };
};

/**
 * Last complete calendar month vs the full month before it (same logic as month-to-month reports elsewhere).
 */
export function computeMomCompareRanges(reference: Date = new Date()): GscCompareRanges {
  const r = calculateMonthToMonth(reference);
  return {
    primary: {
      startDate: formatDateForAPI(r.current.startDate),
      endDate: formatDateForAPI(r.current.endDate),
    },
    compare: {
      startDate: formatDateForAPI(r.comparison.startDate),
      endDate: formatDateForAPI(r.comparison.endDate),
    },
  };
}

/** Last complete calendar month vs the same calendar month one year earlier. */
export function computeYoyCompareRanges(reference: Date = new Date()): GscCompareRanges {
  const mom = calculateMonthToMonth(reference);
  const r = calculateYearOverYear(mom.current.startDate, mom.current.endDate);
  return {
    primary: {
      startDate: formatDateForAPI(r.current.startDate),
      endDate: formatDateForAPI(r.current.endDate),
    },
    compare: {
      startDate: formatDateForAPI(r.comparison.startDate),
      endDate: formatDateForAPI(r.comparison.endDate),
    },
  };
}

export function computeCompareRangesForPreset(
  preset: GscReportingComparePresetId,
  reference: Date = new Date(),
): GscCompareRanges {
  if (preset === "yoy") return computeYoyCompareRanges(reference);
  if (preset === "mom") return computeMomCompareRanges(reference);
  return computeMomCompareRanges(reference);
}

export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Human-readable range from YYYY-MM-DD pair, e.g. "May 1–31, 2026". */
export function formatGscComparePeriodLabel(startDate: string, endDate: string): string {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (!start || !end) return `${startDate} → ${endDate}`;

  const startMonth = start.toLocaleDateString("en-US", { month: "long" });
  const endMonth = end.toLocaleDateString("en-US", { month: "long" });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = end.getFullYear();

  if (startMonth === endMonth && start.getFullYear() === year) {
    return `${startMonth} ${startDay}–${endDay}, ${year}`;
  }

  const startPart = start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const endPart = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startPart} – ${endPart}`;
}

function parseYmd(ymd: string): Date | null {
  const trimmed = ymd.trim();
  if (!YMD_RE.test(trimmed)) return null;
  const [y, m, d] = trimmed.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateOneRange(startDate: string, endDate: string): { ok: true } | { ok: false; error: string } {
  const a = startDate.trim();
  const b = endDate.trim();
  if (!YMD_RE.test(a) || !YMD_RE.test(b)) {
    return { ok: false, error: "Use YYYY-MM-DD for all dates." };
  }
  if (a >= b) {
    return { ok: false, error: "Each period: start date must be before end date." };
  }
  const todayYmd = formatLocalYmd(new Date());
  if (b > todayYmd) {
    return { ok: false, error: "End date cannot be in the future." };
  }
  return { ok: true };
}

/** Validate both date ranges before calling the API. */
export function validateGscCompareFetchRanges(
  primary: { startDate: string; endDate: string },
  compare: { startDate: string; endDate: string },
): { ok: true } | { ok: false; error: string } {
  const p = validateOneRange(primary.startDate, primary.endDate);
  if (!p.ok) return p;
  const c = validateOneRange(compare.startDate, compare.endDate);
  if (!c.ok) return c;
  return { ok: true };
}
