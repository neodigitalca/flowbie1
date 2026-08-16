import type { PostCreatorExecutionPayload } from "@/lib/tasks-types";
import { postCreatorRunStartDate } from "@/lib/post-creator/post-creator-run-start-date";
import {
  clampEveryNDays,
  clampTimesPerMonth,
  type ScheduleFrequency,
} from "@/lib/wordpress-scheduler";

export type PostCreatorScheduleUiState = {
  scheduleFrequency: ScheduleFrequency;
  customInterval: number;
  dayOfWeek: number;
  startDateOption: "immediate" | "custom";
  customStartDate: Date;
  startTime: string;
  wordpressDraftOnly: boolean;
};

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDateLocal(value: string | undefined, fallback: Date): Date {
  if (!value?.trim()) return fallback;
  const [y, mo, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !mo || !d) return fallback;
  const parsed = new Date(y, mo - 1, d);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function postCreatorPayloadToScheduleState(
  payload: PostCreatorExecutionPayload,
): PostCreatorScheduleUiState {
  const postCount = Math.max(1, Math.min(31, Math.floor(Number(payload.postCount ?? 1) || 1)));
  const startTime = payload.scheduleStartTime?.trim() || "09:00";
  const startDay = Math.max(1, Math.min(28, Math.floor(Number(payload.scheduleStartDay ?? 1) || 1)));
  const anchor = postCreatorRunStartDate(startDay, startTime);

  const draftOnly =
    payload.scheduleDraftOnly === true ||
    payload.postDestination === "draft";

  if (payload.scheduleFrequency) {
    const freq = payload.scheduleFrequency;
    return {
      scheduleFrequency: freq,
      customInterval:
        freq === "custom"
          ? clampTimesPerMonth(payload.scheduleCustomInterval ?? payload.scheduleTimesPerMonth ?? postCount)
          : freq === "everyNDays"
            ? clampEveryNDays(payload.scheduleCustomInterval ?? 1)
            : payload.scheduleCustomInterval ?? 1,
      dayOfWeek: payload.scheduleDayOfWeek ?? 0,
      startDateOption: payload.scheduleStartDateOption ?? "custom",
      customStartDate: parseIsoDateLocal(payload.scheduleCustomStartDate, anchor),
      startTime,
      wordpressDraftOnly: draftOnly,
    };
  }

  const timesPerMonth = clampTimesPerMonth(payload.scheduleTimesPerMonth ?? postCount);
  return {
    scheduleFrequency: "custom",
    customInterval: timesPerMonth,
    dayOfWeek: 0,
    startDateOption: "custom",
    customStartDate: anchor,
    startTime,
    wordpressDraftOnly: draftOnly,
  };
}

export function scheduleStateToPostCreatorPayload(
  state: PostCreatorScheduleUiState,
  base: PostCreatorExecutionPayload,
): PostCreatorExecutionPayload {
  const postCount = Math.max(1, Math.min(31, Math.floor(Number(base.postCount ?? 1) || 1)));
  const startDay = Math.max(1, Math.min(28, state.customStartDate.getDate()));

  let scheduleTimesPerMonth = postCount;
  if (state.scheduleFrequency === "custom") {
    scheduleTimesPerMonth = clampTimesPerMonth(state.customInterval);
  }

  const postDestination =
    state.wordpressDraftOnly
      ? "draft"
      : base.postDestination === "bank"
        ? "bank"
        : "wordpress";

  return {
    ...base,
    postDestination,
    scheduleFrequency: state.scheduleFrequency,
    scheduleCustomInterval: state.customInterval,
    scheduleDayOfWeek: state.dayOfWeek,
    scheduleStartDateOption: state.startDateOption,
    scheduleCustomStartDate: toIsoDateLocal(state.customStartDate),
    scheduleDraftOnly: state.wordpressDraftOnly,
    scheduleTimesPerMonth,
    scheduleStartDay: startDay,
    scheduleStartTime: state.startTime,
  };
}
