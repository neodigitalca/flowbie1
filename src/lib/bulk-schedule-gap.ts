/**
 * Gap scheduling for bulk WordPress posts: skip occupied UTC day/week/month periods
 * using a single post-inventory fetch (publish + future date_gmt).
 */

export interface GapScheduleOptions {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom' | 'everyNDays' | 'immediately';
  customInterval?: number;
  customStaggerOptimized?: boolean;
  dayOfWeek?: number;
  startTime: string;
}

export interface ScheduleOccupancy {
  occupiedUtcDays: Set<string>;
  occupiedUtcWeeks: Set<string>;
  occupiedUtcMonths: Set<string>;
}

const MAX_SCAN_DAYS = 3660;
const MAX_SCAN_WEEKS = 520;
const MAX_SCAN_MONTHS = 120;
const TIMES_PER_MONTH_MAX = 31;
const EVERY_N_DAYS_MAX = 365;
const MONTH_END_SCHEDULING_BUFFER_DAYS = 5;
const OPTIMIZED_STAGGER_WINDOW_MINUTES = 480;

function clampTimesPerMonth(n: number): number {
  return Math.max(1, Math.min(TIMES_PER_MONTH_MAX, Math.floor(Number.isFinite(n) ? n : 1) || 1));
}

function clampEveryNDays(n: number): number {
  return Math.max(1, Math.min(EVERY_N_DAYS_MAX, Math.floor(Number.isFinite(n) ? n : 1) || 1));
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function clampUtcDateAgainstMonthEndBuffer(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const dim = daysInUtcMonth(y, m);
  const lastAllowed = Math.max(1, dim - MONTH_END_SCHEDULING_BUFFER_DAYS);
  if (d.getUTCDate() <= lastAllowed) {
    return d;
  }
  const out = new Date(d);
  out.setUTCDate(lastAllowed);
  return out;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function utcDayKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

export function utcDayKey(d: Date): string {
  return utcDayKeyFromParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/** UTC week bucket: Sunday 00:00 UTC of the week containing `d`. */
export function utcWeekStart(d: Date): Date {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start;
}

export function utcWeekKey(d: Date): string {
  return utcDayKey(utcWeekStart(d));
}

function parseStartTime(startTime: string): { h: number; mi: number } {
  const [hours, minutes] = startTime.split(':').map(Number);
  return { h: Number.isFinite(hours) ? hours : 0, mi: Number.isFinite(minutes) ? minutes : 0 };
}

function atUtcTime(year: number, month: number, day: number, startTime: string): Date {
  const { h, mi } = parseStartTime(startTime);
  return new Date(Date.UTC(year, month, day, h, mi, 0, 0));
}

function addUtcDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** Baseline for gap scan: today or tomorrow at startTime (UTC calendar day). */
export function getGapBaselineStartUtc(startTime: string): Date {
  const now = new Date();
  const { h, mi } = parseStartTime(startTime);
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, mi, 0, 0));
  if (todayUtc.getTime() <= now.getTime()) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, h, mi, 0, 0));
  }
  return todayUtc;
}

export function markScheduleOccupancyFromDate(occ: ScheduleOccupancy, date: Date): void {
  occ.occupiedUtcDays.add(utcDayKey(date));
  occ.occupiedUtcWeeks.add(utcWeekKey(date));
  occ.occupiedUtcMonths.add(utcMonthKey(date));
}

export function cloneScheduleOccupancy(occ: ScheduleOccupancy): ScheduleOccupancy {
  return {
    occupiedUtcDays: new Set(occ.occupiedUtcDays),
    occupiedUtcWeeks: new Set(occ.occupiedUtcWeeks),
    occupiedUtcMonths: new Set(occ.occupiedUtcMonths),
  };
}

export function buildScheduleOccupancy(dateGmtStrings: string[]): ScheduleOccupancy {
  const occ: ScheduleOccupancy = {
    occupiedUtcDays: new Set(),
    occupiedUtcWeeks: new Set(),
    occupiedUtcMonths: new Set(),
  };
  for (const raw of dateGmtStrings) {
    if (!raw || !raw.trim()) continue;
    const ms = Date.parse(raw.trim());
    if (!Number.isFinite(ms)) continue;
    markScheduleOccupancyFromDate(occ, new Date(ms));
  }
  return occ;
}

export function buildScheduleOccupancyFromInventoryRows(
  rows: Array<{ date_gmt?: string }>,
): ScheduleOccupancy {
  return buildScheduleOccupancy(rows.map((r) => r.date_gmt ?? ''));
}

function isUtcDayFree(occ: ScheduleOccupancy, d: Date): boolean {
  return !occ.occupiedUtcDays.has(utcDayKey(d));
}

function isUtcWeekFree(occ: ScheduleOccupancy, d: Date): boolean {
  return !occ.occupiedUtcWeeks.has(utcWeekKey(d));
}

function isUtcMonthFree(occ: ScheduleOccupancy, d: Date): boolean {
  return !occ.occupiedUtcMonths.has(utcMonthKey(d));
}

function findFirstEmptyUtcDay(startTime: string, occ: ScheduleOccupancy, notBefore?: Date): Date {
  const baseline = getGapBaselineStartUtc(startTime);
  let cursor = notBefore && notBefore.getTime() > baseline.getTime() ? notBefore : baseline;
  const { h, mi } = parseStartTime(startTime);
  for (let guard = 0; guard < MAX_SCAN_DAYS; guard++) {
    if (isUtcDayFree(occ, cursor)) {
      return new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), h, mi, 0, 0));
    }
    cursor = addUtcDays(cursor, 1);
  }
  throw new Error('No empty UTC day found within scan limit');
}

function findNthEmptyUtcDay(rowIndex: number, startTime: string, occ: ScheduleOccupancy): Date {
  let cursor = getGapBaselineStartUtc(startTime);
  let found = 0;
  for (let guard = 0; guard < MAX_SCAN_DAYS; guard++) {
    if (isUtcDayFree(occ, cursor)) {
      if (found === rowIndex) {
        const { h, mi } = parseStartTime(startTime);
        return new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), h, mi, 0, 0));
      }
      found++;
    }
    cursor = addUtcDays(cursor, 1);
  }
  throw new Error('No empty UTC day found within scan limit');
}

function findNthEmptyUtcWeek(
  rowIndex: number,
  dayOfWeek: number,
  startTime: string,
  occ: ScheduleOccupancy,
): Date {
  let weekStart = utcWeekStart(getGapBaselineStartUtc(startTime));
  let found = 0;
  for (let guard = 0; guard < MAX_SCAN_WEEKS; guard++) {
    if (isUtcWeekFree(occ, weekStart)) {
      if (found === rowIndex) {
        const target = addUtcDays(weekStart, dayOfWeek);
        const { h, mi } = parseStartTime(startTime);
        return new Date(
          Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), h, mi, 0, 0),
        );
      }
      found++;
    }
    weekStart = addUtcDays(weekStart, 7);
  }
  throw new Error('No empty UTC week found within scan limit');
}

function findNthEmptyUtcMonthIndex(
  monthIndex: number,
  baseline: Date,
  occ: ScheduleOccupancy,
): { year: number; month: number } {
  let y = baseline.getUTCFullYear();
  let m = baseline.getUTCMonth();
  let found = 0;
  for (let guard = 0; guard < MAX_SCAN_MONTHS; guard++) {
    const probe = new Date(Date.UTC(y, m, 1));
    if (isUtcMonthFree(occ, probe)) {
      if (found === monthIndex) return { year: y, month: m };
      found++;
    }
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  throw new Error('No empty UTC month found within scan limit');
}

function customSlotInMonth(
  slotIndex: number,
  year: number,
  month: number,
  startDayInFirstMonth: number,
  isFirstGapMonth: boolean,
  options: GapScheduleOptions,
): Date {
  const timesPerMonth = clampTimesPerMonth(options.customInterval ?? 1);
  const customStaggerOptimized = options.customStaggerOptimized ?? false;
  const { startTime } = options;
  const { h, mi } = parseStartTime(startTime);

  const dim = daysInUtcMonth(year, month);
  const lastDay = Math.max(1, dim - MONTH_END_SCHEDULING_BUFFER_DAYS);
  const rawStart = isFirstGapMonth ? startDayInFirstMonth : 1;
  const startDay = Math.min(rawStart, lastDay);
  const span = Math.max(1, lastDay - startDay + 1);

  let dayOfMonth: number;
  if (timesPerMonth <= 1) {
    dayOfMonth = Math.min(lastDay, startDay);
  } else if (span <= 1) {
    dayOfMonth = startDay;
  } else {
    dayOfMonth = startDay + Math.floor((slotIndex / (timesPerMonth - 1)) * (span - 1));
    dayOfMonth = Math.min(lastDay, Math.max(startDay, dayOfMonth));
  }

  const stagger =
    customStaggerOptimized && timesPerMonth > 1
      ? Math.floor((slotIndex / (timesPerMonth - 1)) * OPTIMIZED_STAGGER_WINDOW_MINUTES)
      : 0;

  const scheduled = new Date(Date.UTC(year, month, dayOfMonth, h, mi, 0, 0));
  scheduled.setUTCMinutes(scheduled.getUTCMinutes() + stagger);
  return clampUtcDateAgainstMonthEndBuffer(scheduled);
}

function gapMonthlyDate(rowIndex: number, startTime: string, occ: ScheduleOccupancy): Date {
  const baseline = getGapBaselineStartUtc(startTime);
  const { year, month } = findNthEmptyUtcMonthIndex(rowIndex, baseline, occ);
  const startDay = baseline.getUTCDate();
  const dim = daysInUtcMonth(year, month);
  const day = Math.min(startDay, dim);
  return atUtcTime(year, month, day, startTime);
}

function gapCustomDate(
  rowIndex: number,
  options: GapScheduleOptions,
  inventoryOcc: ScheduleOccupancy,
  priorInBatchDates: Date[],
): Date {
  const timesPerMonth = clampTimesPerMonth(options.customInterval ?? 1);
  const monthIndex = Math.floor(rowIndex / timesPerMonth);
  const slotIndex = rowIndex % timesPerMonth;
  const baseline = getGapBaselineStartUtc(options.startTime);

  // Resolve target month from inventory + fully completed prior month-groups only.
  // In-batch slots in the *current* group must not mark the month occupied (N posts share one month).
  const monthOcc = cloneScheduleOccupancy(inventoryOcc);
  for (let group = 0; group < monthIndex; group++) {
    const anchorDate = priorInBatchDates[group * timesPerMonth];
    if (anchorDate) {
      markScheduleOccupancyFromDate(monthOcc, anchorDate);
    }
  }

  const { year, month } = findNthEmptyUtcMonthIndex(0, baseline, monthOcc);
  return customSlotInMonth(slotIndex, year, month, baseline.getUTCDate(), monthIndex === 0, options);
}

function gapEveryNDaysDate(
  rowIndex: number,
  options: GapScheduleOptions,
  occ: ScheduleOccupancy,
  priorInBatchDates: Date[],
): Date {
  const n = clampEveryNDays(options.customInterval ?? 1);
  const { startTime } = options;

  if (rowIndex === 0) {
    return findFirstEmptyUtcDay(startTime, occ);
  }

  const prev = priorInBatchDates[rowIndex - 1];
  if (!prev) {
    return findFirstEmptyUtcDay(startTime, occ);
  }

  let cursor = addUtcDays(prev, n);
  for (let guard = 0; guard < MAX_SCAN_DAYS; guard++) {
    if (isUtcDayFree(occ, cursor)) {
      const { h, mi } = parseStartTime(startTime);
      return new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), h, mi, 0, 0),
      );
    }
    cursor = addUtcDays(cursor, 1);
  }
  throw new Error('No empty UTC day found for everyNDays gap');
}

/**
 * Effective publish instant for one bulk row when Next available slot + inventory occupancy is active.
 */
export function calculateGapScheduledDate(
  rowIndex: number,
  options: GapScheduleOptions,
  occupancy: ScheduleOccupancy,
  priorInBatchDates: Date[] = [],
): Date {
  const { frequency, dayOfWeek, startTime } = options;
  const working = cloneScheduleOccupancy(occupancy);
  for (const d of priorInBatchDates) {
    markScheduleOccupancyFromDate(working, d);
  }

  switch (frequency) {
    case 'daily': {
      const notBefore =
        priorInBatchDates.length > 0
          ? addUtcDays(priorInBatchDates[priorInBatchDates.length - 1]!, 1)
          : undefined;
      return findFirstEmptyUtcDay(startTime, working, notBefore);
    }

    case 'weekly': {
      const dow = dayOfWeek ?? 1;
      return findNthEmptyUtcWeek(rowIndex, dow, startTime, working);
    }

    case 'monthly':
      return gapMonthlyDate(rowIndex, startTime, working);

    case 'custom':
      return gapCustomDate(rowIndex, options, occupancy, priorInBatchDates);

    case 'everyNDays':
      return gapEveryNDaysDate(rowIndex, options, working, priorInBatchDates);

    default:
      return findFirstEmptyUtcDay(startTime, working);
  }
}

/** Resolve sequential preview/run dates with in-batch occupancy marks. */
export function resolveGapScheduledDates(
  totalRows: number,
  options: GapScheduleOptions,
  occupancy: ScheduleOccupancy,
): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < totalRows; i++) {
    const d = calculateGapScheduledDate(i, options, occupancy, dates);
    dates.push(d);
  }
  return dates;
}

/** Start date placeholder for schedule options when immediate gap mode is active. */
export function gapScheduleStartDate(startTime: string): Date {
  return getGapBaselineStartUtc(startTime);
}
