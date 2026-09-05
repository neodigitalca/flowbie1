import type { EntityPageCreatorExecutionPayload, PostCreatorExecutionPayload, TaskExecutionPayload, TaskExecutionTargetBucket } from "@/lib/tasks-types";
import {
  isGscTrailingMonthsPreset,
  parseTrailingMonthCount,
  validateGscCompareFetchRanges,
} from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import { resolveGscComparePresetId } from "@/lib/gsc-reporting/resolve-gsc-reporting-run-config";
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
  payload?: Pick<
    TaskExecutionPayload,
    "comparePreset" | "gscComparePresetId" | "gscCompareRanges" | "gscTrailingMonthCount"
  > | null,
): boolean {
  if (parseTrailingMonthCount(String(payload?.gscTrailingMonthCount ?? "")) != null) return true;
  const presetId = resolveGscComparePresetId(payload);
  if (presetId === "custom_compare") {
    const ranges = payload?.gscCompareRanges;
    if (!ranges) return false;
    return validateGscCompareFetchRanges(ranges.primary, ranges.compare).ok;
  }
  return presetId === "mom" || presetId === "yoy" || isGscTrailingMonthsPreset(presetId);
}

export function taskExecutionPostCreatorIsConfigured(
  payload?: PostCreatorExecutionPayload | null,
): boolean {
  const count = Number(payload?.postCount ?? 0);
  return Number.isFinite(count) && count >= 1 && count <= 31;
}

export function taskExecutionLocalDominatorIsConfigured(
  _payload?: Pick<TaskExecutionPayload, "businessName" | "keyword"> | null,
): boolean {
  return true;
}

export function taskExecutionEntityPageCreatorIsConfigured(
  payload?: EntityPageCreatorExecutionPayload | null,
): boolean {
  const count = Number(payload?.entityPageCount ?? payload?.postCount ?? 0);
  if (!Number.isFinite(count) || count < 1 || count > 31) return false;
  if (payload?.gridInputSource === "workflow") return true;
  const focusKeyword = payload?.focusKeyword?.trim() ?? payload?.keyword?.trim() ?? "";
  if (!focusKeyword) return false;
  return payload?.locationSource === "grid";
}

export function taskExecutionEntityGeneratorIsConfigured(
  payload?: EntityPageCreatorExecutionPayload | null,
): boolean {
  return taskExecutionEntityPageCreatorIsConfigured(payload);
}

export function taskExecutionSapGeneratorIsConfigured(
  payload?: EntityPageCreatorExecutionPayload | null,
): boolean {
  const count = Number(payload?.entityPageCount ?? payload?.postCount ?? 0);
  if (!Number.isFinite(count) || count < 1 || count > 31) return false;
  if (payload?.entityCsvInputSource === "workflow") return true;
  return Boolean(payload?.entityCsvBase64?.trim() || payload?.entityCsvUrl?.trim());
}

export function resolveTaskExecutionBucket(
  payload?: TaskExecutionPayload | null,
): TaskExecutionTargetBucket | null {
  const bucket = payload?.targetBucket?.trim();
  if (isTaskExecutionTargetBucket(bucket)) return bucket;
  if (isTaskExecutionTargetAll(payload?.targetUrl)) return "all";
  return null;
}
