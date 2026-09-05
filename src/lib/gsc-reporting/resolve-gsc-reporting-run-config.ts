import {
  computeCompareRangesForPreset,
  computeTrailingFullMonthsCompareRanges,
  isGscTrailingMonthsPreset,
  parseTrailingMonthCount,
  type GscCompareRanges,
  type GscReportingComparePresetId,
} from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import type { GscReportingAutomationComparePreset } from "@/lib/gsc-reporting/gsc-reporting-agent-harness";
import type { TaskExecutionPayload } from "@/lib/tasks-types";

export function defaultGscReportingExecutionPayload(): TaskExecutionPayload {
  return {
    comparePreset: "mom",
    gscComparePresetId: "mom",
    gscTrailingMonthCount: 1,
    saveToDisk: true,
  };
}

export function resolveGscComparePresetId(
  payload?: Pick<TaskExecutionPayload, "gscComparePresetId" | "comparePreset"> | null,
): GscReportingComparePresetId {
  const presetId = payload?.gscComparePresetId?.trim();
  if (presetId === "yoy" || presetId === "custom_compare") return presetId;
  if (presetId && isGscTrailingMonthsPreset(presetId)) return presetId;
  if (payload?.comparePreset === "yoy") return "yoy";
  return "mom";
}

export function gscComparePresetIdForTrailingCount(monthCount: number): GscReportingComparePresetId {
  if (monthCount === 1) return "mom";
  if (monthCount === 3) return "m3";
  if (monthCount === 6) return "m6";
  if (monthCount === 12) return "m12";
  return "custom_compare";
}

export function resolveGscTrailingMonthCount(
  payload?: Pick<TaskExecutionPayload, "gscTrailingMonthCount" | "gscComparePresetId" | "comparePreset"> | null,
): number {
  const fromField = parseTrailingMonthCount(String(payload?.gscTrailingMonthCount ?? ""));
  if (fromField != null) return fromField;
  const presetId = resolveGscComparePresetId(payload);
  if (presetId === "m3") return 3;
  if (presetId === "m6") return 6;
  if (presetId === "m12") return 12;
  return 1;
}

export function payloadForGscTrailingMonthCount(monthCount: number): TaskExecutionPayload {
  return {
    gscTrailingMonthCount: monthCount,
    gscComparePresetId: gscComparePresetIdForTrailingCount(monthCount),
    comparePreset: "mom",
    gscCompareRanges: undefined,
  };
}

export function resolveGscReportingRunConfig(
  payload?: TaskExecutionPayload | Record<string, unknown> | null,
): {
  comparePreset: GscReportingAutomationComparePreset;
  compareRanges?: GscCompareRanges;
  presetId: GscReportingComparePresetId;
} {
  const typed = (payload ?? {}) as TaskExecutionPayload;
  const trailingCount = parseTrailingMonthCount(String(typed.gscTrailingMonthCount ?? ""));
  if (trailingCount != null) {
    const presetId = gscComparePresetIdForTrailingCount(trailingCount);
    if (trailingCount === 1) {
      return { comparePreset: "mom", presetId };
    }
    return {
      comparePreset: "mom",
      compareRanges: computeTrailingFullMonthsCompareRanges(trailingCount),
      presetId,
    };
  }
  const presetId = resolveGscComparePresetId(typed);
  const comparePreset: GscReportingAutomationComparePreset = presetId === "yoy" ? "yoy" : "mom";
  if (presetId === "custom_compare" && typed.gscCompareRanges) {
    return { comparePreset, compareRanges: typed.gscCompareRanges, presetId };
  }
  if (isGscTrailingMonthsPreset(presetId)) {
    return { comparePreset, compareRanges: computeCompareRangesForPreset(presetId), presetId };
  }
  return { comparePreset, presetId };
}

export function defaultGscCompareRangesForPreset(
  presetId: GscReportingComparePresetId,
): GscCompareRanges {
  return computeCompareRangesForPreset(presetId === "custom_compare" ? "mom" : presetId);
}
