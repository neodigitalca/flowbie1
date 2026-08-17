import type { PostCreatorScheduleUiState } from "@/lib/post-creator/post-creator-schedule-payload";
import type { TaskExecutionKind, TaskExecutionPayload } from "@/lib/tasks-types";

export type ScheduleDestinationMode = "scheduled" | "draft" | "local" | "email";

const POST_CREATOR_MODES: ScheduleDestinationMode[] = ["scheduled", "draft", "local", "email"];

export function scheduleDestinationModesForKind(
  kind: TaskExecutionKind | undefined,
): ScheduleDestinationMode[] {
  if (kind === "gsc_reporting") {
    return ["local", "scheduled", "email"];
  }
  if (kind === "local_dominator_export") {
    return ["local"];
  }
  return POST_CREATOR_MODES;
}

export function scheduledDestinationLabelForKind(kind: TaskExecutionKind | undefined): string {
  if (kind === "gsc_reporting") return "WordPress";
  return "Scheduled publish";
}

export function scheduleDestinationShowsEmailPlaceholder(
  kind: TaskExecutionKind | undefined,
): boolean {
  return scheduleDestinationModesForKind(kind).includes("email");
}

export function needsPlatformScheduleFrequency(state: PostCreatorScheduleUiState): boolean {
  return !state.automationEmailDelivery && !state.localArchive && !state.wordpressDraftOnly;
}

export function defaultSchedulePayloadForKind(
  kind: TaskExecutionKind | undefined,
  base?: TaskExecutionPayload | null,
): TaskExecutionPayload {
  const payload = { ...(base ?? {}) };

  if (kind === "gsc_reporting") {
    return {
      ...payload,
      saveLocalArchive: payload.saveLocalArchive ?? true,
      saveToDisk: payload.saveToDisk !== false,
    };
  }

  if (kind === "local_dominator_export") {
    return {
      ...payload,
      saveLocalArchive: payload.saveLocalArchive ?? true,
      saveToDisk: payload.saveToDisk !== false,
    };
  }
  if (
    (kind === "content_optimizer" || kind === "content_optimizer_meta") &&
    payload.updateMode === "draft"
  ) {
    return {
      ...payload,
      saveLocalArchive: payload.saveLocalArchive ?? true,
    };
  }

  return payload;
}

export function effectiveSaveLocalArchive(
  kind: TaskExecutionKind | undefined,
  payload?: TaskExecutionPayload | null,
): boolean {
  if (payload?.sendAutomationEmail === true) return true;
  return defaultSchedulePayloadForKind(kind, payload).saveLocalArchive === true;
}

export function effectiveSaveToDisk(
  kind: TaskExecutionKind | undefined,
  payload?: TaskExecutionPayload | null,
): boolean {
  const resolved = defaultSchedulePayloadForKind(kind, payload);
  return resolved.saveToDisk !== false;
}
