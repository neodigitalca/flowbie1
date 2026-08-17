import { normalizeTimeKey } from "@/lib/edmonton-time";
import { TASK_RECURRENCE_LABELS, type TaskRecurrenceRule, type TeamTask } from "@/lib/tasks-types";

export const FORGE_AUTOMATION_TABLE_MIN_WIDTH_CLASS = "min-w-[70rem]";

export const FORGE_AUTOMATION_TH_CLASS =
  "whitespace-nowrap px-3 py-2 text-left text-base font-medium uppercase tracking-wide text-muted-foreground";

export const FORGE_AUTOMATION_TD_CLASS = "whitespace-nowrap px-3 py-2.5 text-left text-base";

function formatTime12h(raw: string): string {
  const normalized = normalizeTimeKey(raw);
  if (!normalized) return "—";
  const [hourPart, minutePart] = normalized.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "—";
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function recurrenceLabel(rule: string | undefined): string | null {
  const key = rule?.trim() as TaskRecurrenceRule | undefined;
  if (!key || key === "none") return null;
  return TASK_RECURRENCE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function formatAutomationScheduleLabel(task?: TeamTask | null): string {
  const fromRecurrence = recurrenceLabel(task?.recurrenceRule);
  if (fromRecurrence) return fromRecurrence;
  const frequency = task?.executionPayload?.scheduleFrequency?.trim();
  if (frequency) return frequency.charAt(0).toUpperCase() + frequency.slice(1);
  return "—";
}

export function formatAutomationCompareLabel(task?: TeamTask | null): string {
  const preset = task?.executionPayload?.comparePreset?.trim();
  if (preset === "mom") return "MoM";
  if (preset === "yoy") return "YoY";
  return "—";
}

function resolveAutomationTimeKey(task?: TeamTask | null): string {
  const dueTime = normalizeTimeKey(task?.dueTime ?? "");
  if (dueTime) return dueTime;
  return normalizeTimeKey(task?.executionPayload?.scheduleStartTime ?? "");
}

export function formatAutomationExecutionTime(task?: TeamTask | null): string {
  return formatTime12h(resolveAutomationTimeKey(task));
}

export function formatAutomationTde(task?: TeamTask | null): string {
  return formatTime12h(resolveAutomationTimeKey(task));
}

export function formatAutomationDisplayTitle(title: string, siteName?: string): string {
  const trimmedTitle = title.trim();
  const trimmedSite = siteName?.trim();
  if (!trimmedTitle || !trimmedSite || trimmedSite === "—") return trimmedTitle || title;

  const suffix = ` - ${trimmedSite}`;
  if (trimmedTitle.endsWith(suffix)) {
    return trimmedTitle.slice(0, trimmedTitle.length - suffix.length).trimEnd();
  }

  const suffixLower = ` - ${trimmedSite.toLowerCase()}`;
  if (trimmedTitle.toLowerCase().endsWith(suffixLower)) {
    return trimmedTitle.slice(0, trimmedTitle.length - suffix.length).trimEnd();
  }

  return trimmedTitle;
}
