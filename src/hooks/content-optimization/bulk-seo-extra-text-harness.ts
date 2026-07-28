import type { Dispatch, SetStateAction } from "react";
import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { reduceHarnessSectionList, type HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import { EXTRA_TEXT_HARNESS_TOTAL_SECTIONS } from "@/lib/content-generation/page-extra-content-generator-prompts";
import {
  mergeHarnessProgressSiteAndBatch,
  mergeOptimizationProgress,
  setOptimizingState,
} from "@/hooks/content-optimization/optimization-helpers-a";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import type { WordPressSite } from "@/components/integrations/types";

type SetBulkState = Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
type SetOptProgress = Dispatch<SetStateAction<Record<string, unknown>>>;
type SetIsOptimizing = Dispatch<SetStateAction<Record<string, boolean>>>;

export type ExtraTextHarnessSetters = {
  siteId: string;
  batchKey: string;
  setBulkOptimizationState: SetBulkState;
  setOptimizationProgress: SetOptProgress;
};

function countDoneSections(sections: HarnessSectionListItem[] | undefined): number {
  return (sections ?? []).filter((s) => s.status === "done").length;
}

export function buildWaitingExtraTextHarnessSections(): HarnessSectionListItem[] {
  return [
    { title: "H2 section", status: "waiting" },
    { title: "H3 section", status: "waiting" },
  ];
}

export function computeExtraTextBatchProgress(batch: BulkOptimizationState): number {
  const urls = batch.urls ?? [];
  if (!urls.length) return 0;
  let slotTotal = 0;
  let doneSlots = 0;
  for (const url of urls) {
    const status = batch.urlStatuses?.[url];
    const sectionCount = batch.urlHarnessSections?.[url]?.length ?? EXTRA_TEXT_HARNESS_TOTAL_SECTIONS;
    slotTotal += sectionCount;
    if (status === "completed" || status === "skipped" || status === "error") {
      doneSlots += sectionCount;
      continue;
    }
    doneSlots += countDoneSections(batch.urlHarnessSections?.[url]);
  }
  return Math.min(99, Math.round((doneSlots / Math.max(slotTotal, 1)) * 100));
}

export function initBulkExtraTextHarnessBatchState(params: {
  site: WordPressSite;
  urls: string[];
  urlKeywords?: Record<string, string>;
  setBulkOptimizationState: SetBulkState;
  setOptimizationProgress: SetOptProgress;
  setIsOptimizingContent: SetIsOptimizing;
  prepMessage?: string;
}): string {
  const {
    site,
    urls,
    urlKeywords = {},
    setBulkOptimizationState,
    setOptimizationProgress,
    setIsOptimizingContent,
    prepMessage = "Preparing extra text batch…",
  } = params;

  const batchKey = `${site.id}-batch`;
  const urlHarnessSections: Record<string, HarnessSectionListItem[]> = {};
  const urlStatuses: BulkOptimizationState["urlStatuses"] = {};

  for (const url of urls) {
    const trimmed = url?.trim();
    if (!trimmed) continue;
    urlHarnessSections[trimmed] = buildWaitingExtraTextHarnessSections();
    urlStatuses[trimmed] = "pending";
  }

  setOptimizingState(setIsOptimizingContent, batchKey, true);
  setOptimizationProgress((prev) =>
    mergeOptimizationProgress(prev as Record<string, unknown>, batchKey, {
      step: "Generating extra text...",
      progress: 5,
      message: prepMessage,
      harnessSections: [],
      harnessPlannedSectionCount: EXTRA_TEXT_HARNESS_TOTAL_SECTIONS,
    }),
  );
  setBulkOptimizationState((prev) => {
    const existing = prev[batchKey];
    const mergedKeywords = { ...(existing?.urlKeywords || {}), ...urlKeywords };
    return {
      ...prev,
      [batchKey]: {
        ...(existing || {}),
        urls,
        currentIndex: 0,
        urlStatuses,
        urlKeywords: mergedKeywords,
        urlHarnessSections,
        runKind: "extraText",
        currentStep: "Generating extra text",
        currentUrl: urls[0] ?? "",
        currentProgress: 5,
        currentStepProgress: {
          step: "Generating extra text...",
          progress: 5,
          message: prepMessage,
          harnessPlannedSectionCount: EXTRA_TEXT_HARNESS_TOTAL_SECTIONS,
        },
        warmingUpIndex: null,
        warmingUpIndex2: null,
        researchedUrls: existing?.researchedUrls ?? [],
        keywordApprovalStatus: existing?.keywordApprovalStatus ?? "approved",
      },
    };
  });

  return batchKey;
}

export function setExtraTextUrlStatus(
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
                ...(current.urlSkipReasons || {}),
                [url]: skipReason,
              },
            }
          : {}),
      },
    };
  });
}

export function emitExtraTextHarnessPayload(
  url: string,
  payload: BulkHarnessSectionPayload,
  setters: ExtraTextHarnessSetters,
): void {
  const { siteId, batchKey, setBulkOptimizationState, setOptimizationProgress } = setters;
  const message = `Extra text ${payload.sectionIndex + 1}/${payload.totalSections}: ${payload.title}${payload.phase === "start" ? "…" : ""}`;
  let latestProgress = 5;

  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    const prevSections = current.urlHarnessSections?.[url] ?? buildWaitingExtraTextHarnessSections();
    const nextUrlSections = reduceHarnessSectionList(prevSections, payload);
    const nextBatch: BulkOptimizationState = {
      ...current,
      urlHarnessSections: {
        ...(current.urlHarnessSections || {}),
        [url]: nextUrlSections,
      },
    };
    latestProgress = computeExtraTextBatchProgress(nextBatch);
    return {
      ...prev,
      [batchKey]: {
        ...nextBatch,
        currentProgress: latestProgress,
        currentStep: "Generating extra text",
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: "Generating extra text...",
          progress: latestProgress,
          message,
          harnessPlannedSectionCount: payload.totalSections,
        },
      },
    };
  });

  setOptimizationProgress((prev) =>
    mergeHarnessProgressSiteAndBatch(prev as Record<string, unknown>, siteId, {
      step: "Generating extra text...",
      progress: latestProgress,
      message,
      harnessPlannedSectionCount: payload.totalSections,
    }),
  );
}

export function refreshExtraTextBatchProgress(
  batchKey: string,
  step: string,
  message: string,
  setters: ExtraTextHarnessSetters,
): void {
  const { siteId, setBulkOptimizationState, setOptimizationProgress } = setters;
  let latestProgress = 5;

  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    latestProgress = computeExtraTextBatchProgress(current);
    return {
      ...prev,
      [batchKey]: {
        ...current,
        currentStep: step,
        currentProgress: latestProgress,
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step,
          progress: latestProgress,
          message,
        },
      },
    };
  });

  setOptimizationProgress((prev) =>
    mergeOptimizationProgress(prev, batchKey, {
      step,
      progress: latestProgress,
      message,
    }),
  );

  setOptimizationProgress((prev) =>
    mergeHarnessProgressSiteAndBatch(prev as Record<string, unknown>, siteId, {
      step,
      progress: latestProgress,
      message,
    }),
  );
}
