export const EDMONTON_TZ = "America/Edmonton";

function edmontonParts(now: Date = new Date()): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: EDMONTON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

export function edmontonDateKey(now?: Date): string {
  return edmontonParts(now).date;
}

export function edmontonTimeKey(now?: Date): string {
  return normalizeTimeKey(edmontonParts(now).time);
}

/** Normalize HH:mm for Edmonton due-time comparison. */
export function normalizeTimeKey(raw: string): string {
  const trimmed = raw.trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function dueMinuteOfDay(dueTime: string): number | null {
  const time = normalizeTimeKey(dueTime);
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function edmontonMinuteOfDay(now?: Date): number {
  return dueMinuteOfDay(edmontonParts(now).time) ?? 0;
}

/** True during the due minute and for graceMinutes after (Edmonton, same calendar day). */
export function isEdmontonDueWindow(
  dueDate: string,
  dueTime: string,
  graceMinutes = 5,
  now?: Date,
): boolean {
  const date = dueDate.slice(0, 10);
  if (!date || date !== edmontonDateKey(now)) return false;
  const dueMin = dueMinuteOfDay(dueTime);
  if (dueMin == null) return false;
  const nowMin = edmontonMinuteOfDay(now);
  return nowMin >= dueMin && nowMin < dueMin + graceMinutes;
}

/** True when a calendar task is due or overdue for the current Edmonton day (or monthly anchor day). */
export { scheduleDueReadyToRun } from "@/lib/automation-schedule-match";

export function formatEdmontonClock(now: Date = new Date()): string {
  const time = new Intl.DateTimeFormat("en-CA", {
    timeZone: EDMONTON_TZ,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(now);
  return time;
}

/** WP stores agent run datetimes as UTC MySQL strings without a timezone suffix. */
export function parseAgentRunUtc(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const trimmed = iso.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed.replace(" ", "T")}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatAgentRunTimestamp(iso: string | null | undefined, now: Date = new Date()): string {
  const date = parseAgentRunUtc(iso);
  if (!date) return iso?.slice(0, 16) ?? "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EDMONTON_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function formatAgentRunTimeOnly(iso: string | null | undefined): string {
  const date = parseAgentRunUtc(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EDMONTON_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDueDateTimeShort(dueDate: string, dueTime?: string): string {
  if (!dueDate) return "";
  const d = dueDate.slice(0, 10);
  const date = new Date(`${d}T12:00:00`);
  if (Number.isNaN(date.getTime())) return d;
  const dateLabel = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = (dueTime ?? "").trim();
  if (!time) return dateLabel;
  const [hRaw, mRaw] = time.split(":");
  const hour = Number(hRaw);
  const minute = Number(mRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return dateLabel;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${dateLabel}, ${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}
