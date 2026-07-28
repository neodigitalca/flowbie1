import type { Dispatch, SetStateAction } from "react";
import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import type { HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import { reduceHarnessSectionList } from "@/lib/bulk/harness-sections-reducer";
import { mergeHarnessProgressSiteAndBatch } from "@/hooks/content-optimization/optimization-helpers-a";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { blogHeadersPatchToOverviewRow, type BlogHeadersRowPatch } from "@/lib/overview/overview-blog-headers-run";

type SetBulkState = Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
type SetOptProgress = Dispatch<SetStateAction<Record<string, unknown>>>;

export type HeadersHarnessSetters = {
  siteId: string;
  batchKey: string;
  setBulkOptimizationState: SetBulkState;
  setOptimizationProgress: SetOptProgress;
};

function countDoneSections(sections: HarnessSectionListItem[] | undefined): number {
  return (sections ?? []).filter((s) => s.status === "done").length;
}

export function setHeadersHarnessMessage(
  setters: HeadersHarnessSetters,
  message: string,
  progress?: number,
): void {
  const pct = progress ?? 5;
  setters.setBulkOptimizationState((prev) => {
    const current = prev[setters.batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [setters.batchKey]: {
        ...current,
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: "Headers",
          progress: pct,
          message,
        },
      },
    };
  });
  setters.setOptimizationProgress((prev) => {
    const next = { ...(prev as Record<string, unknown>) };
    mergeHarnessProgressSiteAndBatch(next, setters.siteId, {
      step: "Headers",
      progress: pct,
      message,
    });
    const batch = next[setters.batchKey] as Record<string, unknown> | undefined;
    if (batch && typeof batch === "object") {
      next[setters.batchKey] = {
        ...batch,
        currentStepProgress: {
          ...(batch.currentStepProgress as object),
          step: "Headers",
          progress: pct,
          message,
        },
      };
    }
    return next;
  });
}

export function computeHeadersBatchProgress(batch: BulkOptimizationState): number {
  const urls = batch.urls ?? [];
  if (!urls.length) return 0;
  let slotTotal = 0;
  let doneSlots = 0;
  for (const url of urls) {
    const status = batch.urlStatuses?.[url];
    const sectionCount = batch.urlHarnessSections?.[url]?.length ?? 0;
    const rowSlots = sectionCount > 0 ? sectionCount : 1;
    slotTotal += rowSlots;
    if (status === "completed" || status === "skipped" || status === "error") {
      doneSlots += rowSlots;
      continue;
    }
    doneSlots += countDoneSections(batch.urlHarnessSections?.[url]);
  }
  return Math.min(99, Math.round((doneSlots / Math.max(slotTotal, 1)) * 100));
}

export function setHeadersUrlStatus(
  batchKey: string,
  url: string,
  status: BulkOptimizationState["urlStatuses"][string],
  setBulkOptimizationState: SetBulkState,
  skipReason?: string,
): void {
  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [batchKey]: {
        ...current,
        urlStatuses: { ...(current.urlStatuses || {}), [url]: status },
        ...(skipReason
          ? {
              urlSkipReasons: {
                ...((current as BulkOptimizationState & { urlSkipReasons?: Record<string, string> })
                  .urlSkipReasons || {}),
                [url]: skipReason,
              },
            }
          : {}),
      },
    };
  });
}

export function emitHeadersHarnessStreamMarkdown(
  url: string,
  setters: HeadersHarnessSetters,
  sectionIndex: number,
  title: string,
  markdown: string,
): void {
  const { batchKey, setBulkOptimizationState } = setters;
  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    const prevSections = current.urlHarnessSections?.[url] ?? [];
    const next = [...prevSections];
    while (next.length <= sectionIndex) {
      next.push({ sectionIndex: next.length, title: "", status: "waiting" });
    }
    next[sectionIndex] = {
      sectionIndex,
      title,
      status: "generating",
      markdown,
    };
    return {
      ...prev,
      [batchKey]: {
        ...current,
        urlHarnessSections: {
          ...(current.urlHarnessSections || {}),
          [url]: next,
        },
        currentUrl: url,
      },
    };
  });
}

export function emitHeadersHarnessPayload(
  url: string,
  setters: HeadersHarnessSetters,
  payload: BulkHarnessSectionPayload,
): void {
  const { siteId, batchKey, setBulkOptimizationState, setOptimizationProgress } = setters;
  const message = `Headers ${payload.sectionIndex + 1}/${payload.totalSections}: ${payload.title}${payload.phase === "start" ? "…" : ""}`;
  let latestProgress = 5;

  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    const prevSections = current.urlHarnessSections?.[url] ?? [];
    const nextUrlSections = reduceHarnessSectionList(prevSections, payload);
    const nextBatch: BulkOptimizationState = {
      ...current,
      urlHarnessSections: {
        ...(current.urlHarnessSections || {}),
        [url]: nextUrlSections,
      },
    };
    latestProgress = computeHeadersBatchProgress(nextBatch);
    return {
      ...prev,
      [batchKey]: {
        ...nextBatch,
        currentProgress: latestProgress,
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: "Headers",
          progress: latestProgress,
          message,
          harnessPlannedSectionCount: payload.totalSections,
        },
      },
    };
  });

  setOptimizationProgress((prev) =>
    mergeHarnessProgressSiteAndBatch(prev as Record<string, unknown>, siteId, {
      step: "Headers",
      progress: latestProgress,
      message,
      harnessPlannedSectionCount: payload.totalSections,
    }),
  );
}

export function finishHeadersRowHarness(
  url: string,
  rowIndex: number,
  patch: BlogHeadersRowPatch,
  setters: HeadersHarnessSetters,
  updateRow: (index: number, patch: Partial<OverviewRow>) => void,
): void {
  const { batchKey, setBulkOptimizationState } = setters;

  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    const nextBatch: BulkOptimizationState = {
      ...current,
      urlStatuses: {
        ...(current.urlStatuses || {}),
        [url]: "completed",
      },
    };
    const progress = computeHeadersBatchProgress(nextBatch);
    return {
      ...prev,
      [batchKey]: {
        ...nextBatch,
        currentProgress: progress,
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: "Headers",
          progress,
          message: "Headers complete",
        },
      },
    };
  });

  updateRow(rowIndex, blogHeadersPatchToOverviewRow(patch));
}

export function markHeadersRowError(
  url: string,
  rowIndex: number,
  setters: HeadersHarnessSetters,
  updateRow: (index: number, patch: Partial<OverviewRow>) => void,
  error?: string,
): void {
  setHeadersUrlStatus(setters.batchKey, url, "error", setters.setBulkOptimizationState, error);
  updateRow(rowIndex, { status: "error" });
}
