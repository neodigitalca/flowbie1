export type CalendarStartMonthChoice = "this" | "next" | "custom";

export function clampCalendarDayOfMonth(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(31, Math.max(1, Math.floor(value)));
}

export function calendarYearMonthNow(): string {
  return new Date().toISOString().slice(0, 7);
}

export function calendarYearMonthNext(fromYm = calendarYearMonthNow()): string {
  const match = /^(\d{4})-(\d{2})$/.exec(fromYm.trim());
  const year = match
    ? Number.parseInt(match[1]!, 10)
    : Number.parseInt(calendarYearMonthNow().slice(0, 4), 10);
  const month = match
    ? Number.parseInt(match[2]!, 10)
    : Number.parseInt(calendarYearMonthNow().slice(5, 7), 10);
  if (month >= 12) return `${year + 1}-01`;
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function calendarYearMonthFromConfig(config: { startDate?: string }): string {
  const startDate = String(config.startDate ?? "").trim();
  if (/^\d{4}-\d{2}/.test(startDate)) return startDate.slice(0, 7);
  return calendarYearMonthNow();
}

export function calendarStartMonthChoiceFromConfig(config: {
  startDate?: string;
  startMonthChoice?: string;
}): CalendarStartMonthChoice {
  const stored = String(config.startMonthChoice ?? "").trim();
  if (stored === "custom" || stored === "next" || stored === "this") return stored;
  const ym = calendarYearMonthFromConfig(config);
  if (ym === calendarYearMonthNext()) return "next";
  if (ym === calendarYearMonthNow()) return "this";
  return "custom";
}

export function parseWorkflowStartDate(startDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate.trim().slice(0, 10));
  if (!match) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return new Date(
    Number.parseInt(match[1]!, 10),
    Number.parseInt(match[2]!, 10) - 1,
    Number.parseInt(match[3]!, 10),
  );
}

export function formatWorkflowStartDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calendarDayOfMonthFromConfig(config: {
  dayOfMonth?: number;
  startDate?: string;
}): number {
  if (typeof config.dayOfMonth === "number" && Number.isFinite(config.dayOfMonth)) {
    return clampCalendarDayOfMonth(config.dayOfMonth);
  }
  const startDate = String(config.startDate ?? "").trim();
  const dayPart = startDate.slice(8, 10);
  const parsed = Number.parseInt(dayPart, 10);
  return clampCalendarDayOfMonth(Number.isFinite(parsed) ? parsed : 1);
}

export function startDateWithDayOfMonth(startDate: string, dayOfMonth: number): string {
  const day = clampCalendarDayOfMonth(dayOfMonth);
  const base = startDate.trim().slice(0, 10);
  const yearMonth = /^\d{4}-\d{2}/.test(base)
    ? base.slice(0, 7)
    : calendarYearMonthNow();
  return `${yearMonth}-${String(day).padStart(2, "0")}`;
}

export function startDateWithMonthChoice(
  _startDate: string,
  dayOfMonth: number,
  monthChoice: Exclude<CalendarStartMonthChoice, "custom">,
): string {
  const day = clampCalendarDayOfMonth(dayOfMonth);
  const yearMonth =
    monthChoice === "next" ? calendarYearMonthNext() : calendarYearMonthNow();
  return `${yearMonth}-${String(day).padStart(2, "0")}`;
}
