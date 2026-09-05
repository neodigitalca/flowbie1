/**
 * Two-period presets for GSC reporting fetch (month-over-month by default).
 * Period A = last full calendar month; period B = the full month before that (standard MoM).
 */

import { calculateMonthToMonth, calculateYearOverYear, formatDateForAPI } from "@/lib/gsc-date-helpers";

export const GSC_TRAILING_MONTH_PRESETS = ["m3", "m6", "m12"] as const;
export type GscTrailingMonthsPresetId = (typeof GSC_TRAILING_MONTH_PRESETS)[number];

export type GscReportingComparePresetId =
  | "mom"
  | "yoy"
  | GscTrailingMonthsPresetId
  | "custom_compare";

const TRAILING_MONTH_COUNTS: Record<GscTrailingMonthsPresetId, number> = {
  m3: 3,
  m6: 6,
  m12: 12,
};

export const GSC_REPORTING_COMPARE_PRESET_OPTIONS: { id: GscReportingComparePresetId; label: string }[] = [
  { id: "mom", label: "Month vs month (last full month vs previous)" },
  { id: "m3", label: "3 months vs last 3 months (last 3 full months vs previous 3)" },
  { id: "m6", label: "6 months vs last 6 months (last 6 full months vs previous 6)" },
  { id: "m12", label: "12 months vs last 12 months (last 12 full months vs previous 12)" },
  { id: "yoy", label: "Year over year (last full month vs same month last year)" },
  { id: "custom_compare", label: "Custom period ranges…" },
];

export function isGscTrailingMonthsPreset(preset: string): preset is GscTrailingMonthsPresetId {
  return (GSC_TRAILING_MONTH_PRESETS as readonly string[]).includes(preset);
}

/** True when the UI/run must send computed ranges (not mom/yoy built-in fetch). */
export function gscComparePresetPassesRanges(preset: GscReportingComparePresetId): boolean {
  return preset !== "mom" && preset !== "yoy";
}

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

/**
 * Last `monthCount` complete calendar months vs the `monthCount` full months before that.
 * Example with 3 months on 13 Apr 2026: Jan–Mar 2026 vs Oct–Dec 2025.
 */
export function computeTrailingFullMonthsCompareRanges(
  monthCount: number,
  reference: Date = new Date(),
): GscCompareRanges {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  const primaryEnd = new Date(y, m, 0);
  const primaryStart = new Date(primaryEnd.getFullYear(), primaryEnd.getMonth() - (monthCount - 1), 1);
  const compareEnd = new Date(primaryStart.getFullYear(), primaryStart.getMonth(), 0);
  const compareStart = new Date(compareEnd.getFullYear(), compareEnd.getMonth() - (monthCount - 1), 1);
  return {
    primary: {
      startDate: formatDateForAPI(primaryStart),
      endDate: formatDateForAPI(primaryEnd),
    },
    compare: {
      startDate: formatDateForAPI(compareStart),
      endDate: formatDateForAPI(compareEnd),
    },
  };
}

export function computeCompareRangesForPreset(
  preset: GscReportingComparePresetId,
  reference: Date = new Date(),
): GscCompareRanges {
  if (preset === "yoy") return computeYoyCompareRanges(reference);
  if (isGscTrailingMonthsPreset(preset)) {
    return computeTrailingFullMonthsCompareRanges(TRAILING_MONTH_COUNTS[preset], reference);
  }
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
  const start = parseGscYmd(startDate);
  const end = parseGscYmd(endDate);
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

/** Full picker range for the report H1 and first paragraph, e.g. "April 1, 2026 to April 30, 2026". */
export function formatGscReportFullDateRange(startDate: string, endDate: string): string {
  const start = parseGscYmd(startDate);
  const end = parseGscYmd(endDate);
  if (!start || !end) return `${startDate} to ${endDate}`;
  const startPart = start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const endPart = end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `${startPart} to ${endPart}`;
}

export function parseGscYmd(ymd: string): Date | null {
  const trimmed = ymd.trim();
  if (!YMD_RE.test(trimmed)) return null;
  const [y, m, d] = trimmed.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export const TRAILING_MONTH_COUNT_MIN = 1;
export const TRAILING_MONTH_COUNT_MAX = 36;

/** Parse a trailing-month count for last N full months vs the N before. */
export function parseTrailingMonthCount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < TRAILING_MONTH_COUNT_MIN || n > TRAILING_MONTH_COUNT_MAX) {
    return null;
  }
  return n;
}

export function formatTrailingMonthsTriggerLabel(monthCount: number): string {
  return `${monthCount} months vs ${monthCount}`;
}

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
