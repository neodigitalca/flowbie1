import type { PostCreatorExecutionPayload, TaskExecutionPayload, TaskExecutionTargetBucket } from "@/lib/tasks-types";
import { isTaskExecutionTargetAll } from "@/lib/task-execution-target";

export type { TaskExecutionTargetBucket };

export const TASK_EXECUTION_TARGET_BUCKETS: TaskExecutionTargetBucket[] = [
  "pages",
  "posts",
  "sap",
  "all",
];

export const TASK_EXECUTION_TARGET_BUCKET_LABELS: Record<TaskExecutionTargetBucket, string> = {
  pages: "Pages",
  posts: "Posts",
  sap: "SAP",
  all: "All",
};

export function isTaskExecutionTargetBucket(value: string | undefined | null): value is TaskExecutionTargetBucket {
  return TASK_EXECUTION_TARGET_BUCKETS.includes(String(value ?? "").trim() as TaskExecutionTargetBucket);
}

/** @deprecated Legacy single-URL tasks; new tasks are bucket-only. */
export function taskExecutionHasSingleTargetUrl(payload?: TaskExecutionPayload | null): boolean {
  const url = payload?.targetUrl?.trim() ?? "";
  return url.length > 0 && !isTaskExecutionTargetAll(url);
}

export function taskExecutionTargetIsConfigured(payload?: TaskExecutionPayload | null): boolean {
  if (payload?.targetUrls?.length) return true;
  return isTaskExecutionTargetBucket(payload?.targetBucket);
}

export function taskExecutionReportingIsConfigured(
  payload?: Pick<TaskExecutionPayload, "comparePreset"> | null,
): boolean {
  const preset = payload?.comparePreset?.trim();
  return preset === "mom" || preset === "yoy";
}

export function taskExecutionPostCreatorIsConfigured(
  payload?: PostCreatorExecutionPayload | null,
): boolean {
  const count = Number(payload?.postCount ?? 0);
  return Number.isFinite(count) && count >= 1 && count <= 31;
}

export function resolveTaskExecutionBucket(
  payload?: TaskExecutionPayload | null,
): TaskExecutionTargetBucket | null {
  const bucket = payload?.targetBucket?.trim();
  if (isTaskExecutionTargetBucket(bucket)) return bucket;
  if (isTaskExecutionTargetAll(payload?.targetUrl)) return "all";
  return null;
}
