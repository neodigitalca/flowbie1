import {
  getFirstOfThisMonthDate,
  getNextFirstOfMonthDate,
  isSameLocalCalendarDay,
  type ScheduleFrequency,
} from "@/lib/wordpress-scheduler";

export type BulkScheduleStartPreset = "immediate" | "firstOfThisMonth" | "firstOfNextMonth" | "pickDate";

const FREQ_SHORT: Record<ScheduleFrequency, string> = {
  immediately: "Immediately",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  everyNDays: "Every N days",
  custom: "Per month",
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function computeBulkScheduleStartPreset(
  startDateOption: "immediate" | "custom",
  customStartDate: Date,
  startTime: string,
): BulkScheduleStartPreset {
  if (startDateOption === "immediate") return "immediate";
  const thisMonth = getFirstOfThisMonthDate(startTime);
  const nextFirst = getNextFirstOfMonthDate(startTime);
  if (isSameLocalCalendarDay(customStartDate, thisMonth)) return "firstOfThisMonth";
  if (isSameLocalCalendarDay(customStartDate, nextFirst)) return "firstOfNextMonth";
  return "pickDate";
}

export function formatBulkScheduleSummary(params: {
  scheduleFrequency: ScheduleFrequency;
  customInterval: number;
  dayOfWeek: number;
  startDateOption: "immediate" | "custom";
  customStartDate: Date;
  startTime: string;
  draftOnly?: boolean;
}): string {
  const { scheduleFrequency, customInterval, dayOfWeek, startDateOption, customStartDate, startTime, draftOnly } =
    params;

  if (draftOnly) {
    return "Draft only";
  }

  if (scheduleFrequency === "immediately") {
    return "Immediately";
  }

  let freq = FREQ_SHORT[scheduleFrequency];
  if (scheduleFrequency === "everyNDays") {
    freq = `Every ${customInterval}d`;
  } else if (scheduleFrequency === "custom") {
    freq = `${customInterval}×/mo`;
  } else if (scheduleFrequency === "weekly") {
    freq = `Weekly · ${DAY_SHORT[dayOfWeek] ?? "Mon"}`;
  }

  const preset = computeBulkScheduleStartPreset(startDateOption, customStartDate, startTime);
  const start =
    scheduleFrequency === "custom" && preset === "immediate"
      ? "from 1st"
      : preset === "immediate"
        ? "Next slot"
        : preset === "firstOfThisMonth"
          ? "1st this mo"
          : preset === "firstOfNextMonth"
            ? "1st next mo"
            : "Custom date";

  return `${freq} · ${start} · ${startTime}`;
}
