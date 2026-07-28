import type { Dispatch, SetStateAction } from "react";
import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import type { HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import {
  mergeHarnessProgressSiteAndBatch,
  mergeOptimizationProgress,
} from "@/hooks/content-optimization/optimization-helpers-a";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import {
  applyBatchPrepHarnessPayload,
  applyPostPrepHarnessPayload,
  buildBatchPrepHarnessPayload,
  buildPostPrepHarnessPayload,
  buildWaitingBatchPrepHarnessSections,
  buildWaitingPostHarnessSections,
  CONTENT_PREP_BATCH_HARNESS_TOTAL_SECTIONS,
  CONTENT_PREP_HARNESS_TOTAL_SECTIONS,
  CONTENT_PREP_POST_HARNESS_TOTAL_SECTIONS,
} from "./overview-content-prep-harness-sections";

type SetBulkState = Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
type SetOptProgress = Dispatch<SetStateAction<Record<string, unknown>>>;

export type ContentPrepHarnessSetters = {
  siteId: string;
  batchKey: string;
  setBulkOptimizationState: SetBulkState;
  setOptimizationProgress: SetOptProgress;
};

export { buildWaitingEntitySapBatchPrepHarnessSections } from "./overview-content-prep-harness-sections";

export function buildContentPrepUrlHarnessMap(urls: string[]): Record<string, HarnessSectionListItem[]> {
  const map: Record<string, HarnessSectionListItem[]> = {};
  for (const raw of urls) {
    const url = raw?.trim();
    if (!url) continue;
    map[url] = buildWaitingPostHarnessSections();
  }
  return map;
}

function countDoneSections(sections: HarnessSectionListItem[] | undefined): number {
  return (sections ?? []).filter((s) => s.status === "done").length;
}

export function computeContentPrepBatchProgress(batch: BulkOptimizationState): number {
  const urls = batch.urls ?? [];
  if (!urls.length) return 0;

  const batchPrepDone = countDoneSections(batch.batchPrepHarnessSections);
  let postDone = 0;
  for (const url of urls) {
    const status = batch.urlStatuses?.[url];
    if (status === "completed") {
      postDone += CONTENT_PREP_POST_HARNESS_TOTAL_SECTIONS;
      continue;
    }
    postDone += countDoneSections(batch.urlHarnessSections?.[url]);
  }

  const slotTotal =
    CONTENT_PREP_BATCH_HARNESS_TOTAL_SECTIONS + urls.length * CONTENT_PREP_POST_HARNESS_TOTAL_SECTIONS;
  const doneSlots = batchPrepDone + postDone;
  return Math.min(99, Math.round((doneSlots / Math.max(slotTotal, 1)) * 100));
}

export function setContentPrepBatchMessage(
  message: string,
  step: string,
  setters: ContentPrepHarnessSetters,
): void {
  const { siteId, batchKey, setBulkOptimizationState, setOptimizationProgress } = setters;
  setOptimizationProgress((prev) =>
    mergeOptimizationProgress(prev as Record<string, unknown>, siteId, { step, progress: 2, message }),
  );
  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [batchKey]: {
        ...current,
        currentStep: step,
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step,
          progress: 2,
          message,
          harnessSections: current.batchPrepHarnessSections ?? current.currentStepProgress?.harnessSections,
          harnessPlannedSectionCount: CONTENT_PREP_BATCH_HARNESS_TOTAL_SECTIONS,
        },
      },
    };
  });
}

export function markContentPrepBatchHarnessSection(
  sectionIndex: number,
  phase: BulkHarnessSectionPayload["phase"],
  setters: ContentPrepHarnessSetters,
  message?: string,
): void {
  const { siteId, batchKey, setBulkOptimizationState, setOptimizationProgress } = setters;
  const payload = buildBatchPrepHarnessPayload(sectionIndex, phase);
  const displayMessage =
    message ??
    `${payload.title}${phase === "start" ? "…" : phase === "done" ? " complete" : ""}`;
  let latestProgress = 2;

  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    const prevBatchSections =
      current.batchPrepHarnessSections ?? buildWaitingBatchPrepHarnessSections();
    const nextBatchSections = applyBatchPrepHarnessPayload(prevBatchSections, payload);
    const nextBatch: BulkOptimizationState = {
      ...current,
      batchPrepHarnessSections: nextBatchSections,
    };
    latestProgress = computeContentPrepBatchProgress(nextBatch);
    return {
      ...prev,
      [batchKey]: {
        ...nextBatch,
        currentProgress: latestProgress,
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: current.currentStep || "Preparing…",
          progress: latestProgress,
          message: displayMessage,
          harnessSections: nextBatchSections,
          harnessPlannedSectionCount: CONTENT_PREP_BATCH_HARNESS_TOTAL_SECTIONS,
        },
      },
    };
  });

  setOptimizationProgress((prev) =>
    mergeHarnessProgressSiteAndBatch(prev as Record<string, unknown>, siteId, {
      step: "Preparing…",
      progress: latestProgress,
      message: displayMessage,
      harnessPlannedSectionCount: CONTENT_PREP_BATCH_HARNESS_TOTAL_SECTIONS,
    }),
  );
}

export function applyContentPrepHarnessToUrl(
  url: string,
  payload: BulkHarnessSectionPayload,
  setters: ContentPrepHarnessSetters,
): void {
  const { siteId, batchKey, setBulkOptimizationState, setOptimizationProgress } = setters;
  const message = `${payload.title}${payload.phase === "start" ? "…" : payload.phase === "done" ? " complete" : ""}`;
  let latestProgress = 2;

  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    const prevSections = current.urlHarnessSections?.[url] ?? buildWaitingPostHarnessSections();
    const nextUrlSections = applyPostPrepHarnessPayload(prevSections, payload);
    const nextBatch: BulkOptimizationState = {
      ...current,
      urlHarnessSections: {
        ...(current.urlHarnessSections || {}),
        [url]: nextUrlSections,
      },
    };
    latestProgress = computeContentPrepBatchProgress(nextBatch);
    return {
      ...prev,
      [batchKey]: {
        ...nextBatch,
        currentUrl: url,
        currentProgress: latestProgress,
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: current.currentStep || "Preparing…",
          progress: latestProgress,
          message,
          harnessSections: nextUrlSections,
          harnessPlannedSectionCount: CONTENT_PREP_POST_HARNESS_TOTAL_SECTIONS,
        },
      },
    };
  });

  setOptimizationProgress((prev) =>
    mergeHarnessProgressSiteAndBatch(prev as Record<string, unknown>, siteId, {
      step: "Preparing…",
      progress: latestProgress,
      message,
      harnessPlannedSectionCount: CONTENT_PREP_POST_HARNESS_TOTAL_SECTIONS,
    }),
  );
}

export function markContentPrepHarnessSection(
  url: string,
  sectionIndex: number,
  phase: BulkHarnessSectionPayload["phase"],
  setters: ContentPrepHarnessSetters,
  rowIndex = 0,
  markdownSlice?: string,
): void {
  applyContentPrepHarnessToUrl(
    url,
    buildPostPrepHarnessPayload(rowIndex, sectionIndex, phase, markdownSlice),
    setters,
  );
}

export function markContentPrepHarnessForUrls(
  urls: string[],
  sectionIndex: number,
  phase: BulkHarnessSectionPayload["phase"],
  setters: ContentPrepHarnessSetters,
): void {
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]?.trim();
    if (!url) continue;
    markContentPrepHarnessSection(url, sectionIndex, phase, setters, i);
  }
}
