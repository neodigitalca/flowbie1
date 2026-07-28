import {
  getFirstOfThisMonthDate,
  getNextFirstOfMonthDate,
  type ScheduleFrequency,
} from "@/lib/wordpress-scheduler";
import {
  computeBulkScheduleStartPreset,
  type BulkScheduleStartPreset,
} from "@/lib/bulk/bulk-schedule-summary";

const STORAGE_KEY = "flowbie_bulk_schedule_named_presets_v1";

export type BulkNamedSchedulePresetValues = {
  scheduleFrequency: ScheduleFrequency;
  customInterval: number;
  dayOfWeek: number;
  startPreset: BulkScheduleStartPreset;
  startTime: string;
};

export type BulkNamedSchedulePreset = {
  id: string;
  label: string;
  values: BulkNamedSchedulePresetValues;
  builtin?: boolean;
};

/** 3× per month starting first of next month. */
export const BUILTIN_PRESET_3X_NEXT_MONTH: BulkNamedSchedulePreset = {
  id: "builtin-3x-next-month",
  label: "3× / month · next month",
  builtin: true,
  values: {
    scheduleFrequency: "custom",
    customInterval: 3,
    dayOfWeek: 1,
    startPreset: "firstOfNextMonth",
    startTime: "09:00",
  },
};

/** 15× per month starting at the next available slot (next available month via gap/AI). */
export const BUILTIN_PRESET_15X_NEXT_AVAILABLE: BulkNamedSchedulePreset = {
  id: "builtin-15x-next-available",
  label: "15× / month · next available",
  builtin: true,
  values: {
    scheduleFrequency: "custom",
    customInterval: 15,
    dayOfWeek: 1,
    startPreset: "immediate",
    startTime: "09:00",
  },
};

const BUILTINS: BulkNamedSchedulePreset[] = [
  BUILTIN_PRESET_3X_NEXT_MONTH,
  BUILTIN_PRESET_15X_NEXT_AVAILABLE,
];

type StoredV1 = {
  v: 1;
  presets: Array<{
    id: string;
    label: string;
    values: BulkNamedSchedulePresetValues;
  }>;
};

function isValidValues(v: unknown): v is BulkNamedSchedulePresetValues {
  if (!v || typeof v !== "object") return false;
  const o = v as Partial<BulkNamedSchedulePresetValues>;
  if (
    !["immediately", "daily", "weekly", "monthly", "custom", "everyNDays"].includes(
      o.scheduleFrequency ?? "",
    )
  ) {
    return false;
  }
  if (typeof o.customInterval !== "number" || o.customInterval < 1) return false;
  if (typeof o.dayOfWeek !== "number" || o.dayOfWeek < 0 || o.dayOfWeek > 6) return false;
  if (
    !["immediate", "firstOfThisMonth", "firstOfNextMonth", "pickDate"].includes(o.startPreset ?? "")
  ) {
    return false;
  }
  if (typeof o.startTime !== "string") return false;
  const timeParts = o.startTime.split(":");
  if (
    timeParts.length !== 2 ||
    timeParts[0].length !== 2 ||
    timeParts[1].length !== 2 ||
    !Number.isInteger(Number(timeParts[0])) ||
    !Number.isInteger(Number(timeParts[1])) ||
    Number(timeParts[0]) < 0 ||
    Number(timeParts[0]) > 23 ||
    Number(timeParts[1]) < 0 ||
    Number(timeParts[1]) > 59
  ) {
    return false;
  }
  return true;
}

export function loadUserBulkSchedulePresets(): BulkNamedSchedulePreset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredV1>;
    if (parsed.v !== 1 || !Array.isArray(parsed.presets)) return [];
    return parsed.presets
      .filter((p) => p && typeof p.id === "string" && typeof p.label === "string" && isValidValues(p.values))
      .map((p) => ({
        id: p.id,
        label: p.label.trim() || "Saved preset",
        values: p.values,
      }));
  } catch {
    return [];
  }
}

export function saveUserBulkSchedulePresets(presets: BulkNamedSchedulePreset[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    const payload: StoredV1 = {
      v: 1,
      presets: presets
        .filter((p) => !p.builtin)
        .map((p) => ({ id: p.id, label: p.label, values: p.values })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function listBulkSchedulePresets(): BulkNamedSchedulePreset[] {
  return [...BUILTINS, ...loadUserBulkSchedulePresets()];
}

export function matchBulkSchedulePresetId(args: {
  scheduleFrequency: ScheduleFrequency;
  customInterval: number;
  dayOfWeek: number;
  startDateOption: "immediate" | "custom";
  customStartDate: Date;
  startTime: string;
}): string | null {
  const startPreset = computeBulkScheduleStartPreset(
    args.startDateOption,
    args.customStartDate,
    args.startTime,
  );
  for (const preset of listBulkSchedulePresets()) {
    const v = preset.values;
    if (v.scheduleFrequency !== args.scheduleFrequency) continue;
    if (v.startPreset !== startPreset) continue;
    if (v.startTime !== args.startTime) continue;
    if (v.scheduleFrequency === "weekly" && v.dayOfWeek !== args.dayOfWeek) continue;
    if (
      (v.scheduleFrequency === "custom" || v.scheduleFrequency === "everyNDays") &&
      v.customInterval !== args.customInterval
    ) {
      continue;
    }
    return preset.id;
  }
  return null;
}

export function applyBulkScheduleStartPreset(
  startPreset: BulkScheduleStartPreset,
  startTime: string,
): { startDateOption: "immediate" | "custom"; customStartDate?: Date } {
  if (startPreset === "immediate") {
    return { startDateOption: "immediate" };
  }
  if (startPreset === "firstOfThisMonth") {
    return { startDateOption: "custom", customStartDate: getFirstOfThisMonthDate(startTime) };
  }
  if (startPreset === "firstOfNextMonth") {
    return { startDateOption: "custom", customStartDate: getNextFirstOfMonthDate(startTime) };
  }
  return { startDateOption: "custom" };
}

export function formatPresetLabelFromValues(values: BulkNamedSchedulePresetValues): string {
  const freq =
    values.scheduleFrequency === "custom"
      ? `${values.customInterval}× / month`
      : values.scheduleFrequency === "everyNDays"
        ? `Every ${values.customInterval}d`
        : values.scheduleFrequency === "weekly"
          ? "Weekly"
          : values.scheduleFrequency === "immediately"
            ? "Immediately"
            : values.scheduleFrequency === "daily"
              ? "Daily"
              : "Monthly";
  const start =
    values.startPreset === "immediate"
      ? "next available"
      : values.startPreset === "firstOfThisMonth"
        ? "this month"
        : values.startPreset === "firstOfNextMonth"
          ? "next month"
          : "custom date";
  return `${freq} · ${start}`;
}
