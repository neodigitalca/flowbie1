import { resolveGscReportingRunConfig } from "@/lib/gsc-reporting/resolve-gsc-reporting-run-config";
import type { TaskExecutionPayload } from "@/lib/tasks-types";

export function defaultAdsReportingExecutionPayload(): TaskExecutionPayload {
  return {
    comparePreset: "mom",
    gscComparePresetId: "mom",
    gscTrailingMonthCount: 1,
    saveToDisk: true,
  };
}

export function resolveAdsReportingRunConfig(
  payload?: TaskExecutionPayload | Record<string, unknown> | null,
) {
  return resolveGscReportingRunConfig(payload);
}
