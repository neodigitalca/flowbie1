export type TaskScheduleMode = "calendar" | "trigger";

export type TaskTriggerSource = "gsc" | "schedule" | "ga" | "semrush";

export type TaskTriggerSignal =
  | "position_drop"
  | "ctr_drop"
  | "impressions_up_ctr_down"
  | "clicks_drop"
  | "quick_win_slipped";

export type TaskTriggerMatchMode = "any" | "all";

export type TaskTriggerCondition = {
  signal: TaskTriggerSignal;
  operator: "gte" | "lte";
  value: number;
  minImpressions?: number;
};

export type TaskTriggerConfig = {
  sources: TaskTriggerSource[];
  match: TaskTriggerMatchMode;
  conditions: TaskTriggerCondition[];
  lookbackDays: number;
  compareDays: number;
  pollHours: number;
  cooldownHours: number;
  maxUrls: number;
};

export type TaskTriggerMeta = {
  lastEvaluatedAt?: string;
  lastScannedCount?: number;
  lastMatchedCount?: number;
  lastFiredAt?: string;
  lastSimulated?: boolean;
  urlCooldowns?: Record<string, string>;
};

export type TaskTriggerMatchMetrics = {
  impressions?: number;
  ctr?: number;
  position?: number;
  clicks?: number;
};

export type TaskTriggerMatchRow = {
  url: string;
  signal: TaskTriggerSignal;
  current: TaskTriggerMatchMetrics;
  prior: TaskTriggerMatchMetrics;
  dateRange?: {
    current?: { start?: string; end?: string };
    prior?: { start?: string; end?: string };
  };
};

export type TaskTriggerEvaluateResult = {
  ok: boolean;
  error?: string;
  simulated?: boolean;
  scannedCount?: number;
  gscDataCount?: number;
  skippedNoGscData?: number;
  matchedCount?: number;
  matchedUrls?: string[];
  matches?: TaskTriggerMatchRow[];
};

export type TaskTriggerPendingDispatch = {
  taskId: number;
  urls: string[];
  simulated: boolean;
  createdAt: string;
};

export const TASK_SCHEDULE_MODES: TaskScheduleMode[] = ["calendar", "trigger"];

export const TASK_SCHEDULE_MODE_LABELS: Record<TaskScheduleMode, string> = {
  calendar: "When due",
  trigger: "When triggered",
};

export const TASK_TRIGGER_SOURCES: TaskTriggerSource[] = ["gsc", "schedule", "ga", "semrush"];

export const TASK_TRIGGER_SOURCE_LABELS: Record<TaskTriggerSource, string> = {
  gsc: "Google Search Console",
  schedule: "Time based only",
  ga: "Google Analytics",
  semrush: "Semrush",
};

export const TASK_TRIGGER_SOURCE_SHORT_LABELS: Record<TaskTriggerSource, string> = {
  gsc: "GSC",
  schedule: "Schedule",
  ga: "GA (Soon)",
  semrush: "Semrush (Soon)",
};

export type TaskTriggerSourceOption = {
  value: TaskTriggerSource;
  label: string;
  enabled: boolean;
};

export const TASK_TRIGGER_SOURCE_OPTIONS: TaskTriggerSourceOption[] = [
  { value: "gsc", label: TASK_TRIGGER_SOURCE_LABELS.gsc, enabled: true },
  { value: "schedule", label: TASK_TRIGGER_SOURCE_LABELS.schedule, enabled: true },
  { value: "ga", label: `${TASK_TRIGGER_SOURCE_LABELS.ga} (Soon)`, enabled: false },
  { value: "semrush", label: `${TASK_TRIGGER_SOURCE_LABELS.semrush} (Soon)`, enabled: false },
];

export function primaryTriggerSource(sources: TaskTriggerSource[]): TaskTriggerSource {
  return sources[0] ?? "gsc";
}

export function isScheduleOnlyTriggerSource(sources: TaskTriggerSource[]): boolean {
  return primaryTriggerSource(sources) === "schedule";
}

export const TASK_TRIGGER_SIGNALS: TaskTriggerSignal[] = [
  "position_drop",
  "ctr_drop",
  "impressions_up_ctr_down",
  "clicks_drop",
  "quick_win_slipped",
];

export const TASK_TRIGGER_SIGNAL_LABELS: Record<TaskTriggerSignal, string> = {
  position_drop: "Position dropped",
  ctr_drop: "CTR dropped",
  impressions_up_ctr_down: "Impressions up, CTR down",
  clicks_drop: "Clicks dropped",
  quick_win_slipped: "Quick win slipped",
};

export const TASK_TRIGGER_SIGNAL_DEFAULTS: Record<
  TaskTriggerSignal,
  { operator: "gte" | "lte"; value: number; minImpressions?: number }
> = {
  position_drop: { operator: "gte", value: 3, minImpressions: 100 },
  ctr_drop: { operator: "gte", value: 15, minImpressions: 100 },
  impressions_up_ctr_down: { operator: "gte", value: 0, minImpressions: 100 },
  clicks_drop: { operator: "gte", value: 15, minImpressions: 100 },
  quick_win_slipped: { operator: "gte", value: 0, minImpressions: 50 },
};

export type PollIntervalUnit = "hours" | "days" | "weeks";

const POLL_UNIT_HOURS: Record<PollIntervalUnit, number> = {
  hours: 1,
  days: 24,
  weeks: 168,
};

export function pollHoursToParts(hours: number): { value: number; unit: PollIntervalUnit } {
  const safeHours = Math.max(1, Math.round(hours));
  if (safeHours % POLL_UNIT_HOURS.weeks === 0) {
    return { value: safeHours / POLL_UNIT_HOURS.weeks, unit: "weeks" };
  }
  if (safeHours % POLL_UNIT_HOURS.days === 0) {
    return { value: safeHours / POLL_UNIT_HOURS.days, unit: "days" };
  }
  return { value: safeHours, unit: "hours" };
}

export function partsToPollHours(value: number, unit: PollIntervalUnit): number {
  const safeValue = Math.max(1, Math.round(value));
  return safeValue * POLL_UNIT_HOURS[unit];
}

export const POLL_INTERVAL_UNIT_LABELS: Record<PollIntervalUnit, string> = {
  hours: "Hours",
  days: "Days",
  weeks: "Weeks",
};

export function defaultTaskTriggerConfig(): TaskTriggerConfig {
  return {
    sources: ["gsc"],
    match: "any",
    conditions: [],
    lookbackDays: 28,
    compareDays: 28,
    pollHours: 24,
    cooldownHours: 72,
    maxUrls: 5,
  };
}
