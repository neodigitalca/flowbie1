import {
  EDMONTON_TZ,
  dueMinuteOfDay,
  edmontonDateKey,
  edmontonMinuteOfDay,
  normalizeTimeKey,
} from "@/lib/edmonton-time";

export type ScheduleMatchTask = {
  dueDate?: string;
  dueTime?: string;
  recurrenceRule?: string;
  scheduleMode?: string;
};

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function edmontonIsoWeekday(dateKey: string): number | null {
  const date = dateKey.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: EDMONTON_TZ,
    weekday: "short",
  });
  const label = fmt.format(new Date(`${date}T12:00:00`));
  return WEEKDAY_TO_ISO[label] ?? null;
}

function edmontonIsoWeekKey(dateKey: string): string {
  const date = dateKey.slice(0, 10);
  const anchor = new Date(`${date}T12:00:00`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: EDMONTON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(anchor);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** True when calendar schedule anchor matches today (Edmonton) and due time has passed. */
export function scheduleRecurrenceMatchesToday(
  task: ScheduleMatchTask,
  dateKey: string,
): boolean {
  const dueDate = (task.dueDate ?? "").slice(0, 10);
  if (!dueDate) return false;

  const recurrence = task.recurrenceRule ?? "none";
  switch (recurrence) {
    case "daily":
      return dateKey >= dueDate;
    case "weekly": {
      const anchorDow = edmontonIsoWeekday(dueDate);
      const todayDow = edmontonIsoWeekday(dateKey);
      return anchorDow != null && todayDow === anchorDow && dateKey >= dueDate;
    }
    case "monthly":
      return dueDate.slice(8, 10) === dateKey.slice(8, 10);
    case "yearly":
      return dueDate.slice(5, 10) === dateKey.slice(5, 10);
    case "none":
    default:
      return dueDate === dateKey;
  }
}

/** True when a calendar task is due or overdue for the current Edmonton day. */
export function scheduleDueReadyToRun(task: ScheduleMatchTask, now?: Date): boolean {
  if ((task.scheduleMode ?? "calendar") !== "calendar") return false;

  const dateKey = edmontonDateKey(now);
  const dueDate = (task.dueDate ?? "").slice(0, 10);
  const dueTime = normalizeTimeKey(task.dueTime ?? "");
  if (!dueDate || !dueTime) return false;

  const dueMin = dueMinuteOfDay(dueTime);
  if (dueMin == null) return false;
  if (edmontonMinuteOfDay(now) < dueMin) return false;

  return scheduleRecurrenceMatchesToday(task, dateKey);
}

/** Dedupe key written to scheduleMeta.lastRunKey (server + client). */
export function scheduleRunDedupeKey(
  task: ScheduleMatchTask,
  dateKey: string,
  time: string,
): string {
  const recurrence = task.recurrenceRule ?? "none";
  const dueDate = (task.dueDate ?? "").slice(0, 10);

  switch (recurrence) {
    case "daily":
      return `${dateKey}:${time}`;
    case "weekly":
      return `${edmontonIsoWeekKey(dateKey)}:${time}`;
    case "monthly":
      return `${dateKey.slice(0, 7)}:${time}`;
    case "yearly":
      return `${dateKey.slice(0, 4)}:${dueDate.slice(5, 10)}:${time}`;
    case "none":
    default:
      return `${dateKey}:${time}`;
  }
}
