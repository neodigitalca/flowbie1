import type { Dispatch, SetStateAction } from "react";
import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { reduceHarnessSectionList, type HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  buildDoneResearchHarnessSections,
  buildWaitingResearchHarnessSections,
  RESEARCH_HARNESS_TOTAL_SECTIONS,
  type ResearchHarnessDoneSummary,
  researchHarnessGeneratedFiles,
} from "@/lib/overview/overview-research-harness-sections";
import {
  mergeHarnessProgressSiteAndBatch,
  setOptimizingState,
} from "@/hooks/content-optimization/optimization-helpers-a";
import { mergeOptimizationProgress } from "@/hooks/content-optimization/optimization-helpers";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import { initOverviewBulkHarnessPagination } from "@/lib/overview/overview-bulk-page-state";

type SetBulkState = Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
type SetOptProgress = Dispatch<SetStateAction<Record<string, unknown>>>;
type SetIsOptimizing = Dispatch<SetStateAction<Record<string, boolean>>>;

export type InitOverviewResearchHarnessParams = {
  site: WordPressSite;
  rows: OverviewRow[];
  setBulkOptimizationState: SetBulkState;
  setOptimizationProgress: SetOptProgress;
  setIsOptimizingContent: SetIsOptimizing;
  prepMessage?: string;
};

export type ResearchHarnessSetters = {
  siteId: string;
  batchKey: string;
  setBulkOptimizationState: SetBulkState;
  setOptimizationProgress: SetOptProgress;
};

function countDoneSections(sections: HarnessSectionListItem[] | undefined): number {
  return (sections ?? []).filter((s) => s.status === "done").length;
}

function computeResearchBatchProgress(batch: BulkOptimizationState): number {
  const urls = batch.urls ?? [];
  if (!urls.length) return 0;
  const slotTotal = urls.length * RESEARCH_HARNESS_TOTAL_SECTIONS;
  let doneSlots = 0;
  for (const url of urls) {
    const status = batch.urlStatuses?.[url];
    if (status === "completed" || status === "skipped" || status === "error") {
      doneSlots += RESEARCH_HARNESS_TOTAL_SECTIONS;
      continue;
    }
    doneSlots += countDoneSections(batch.urlHarnessSections?.[url]);
  }
  return Math.min(99, Math.round((doneSlots / Math.max(slotTotal, 1)) * 100));
}

export function initOverviewResearchHarnessBatchState(
  params: InitOverviewResearchHarnessParams,
): string {
  const {
    site,
    rows,
    setBulkOptimizationState,
    setOptimizationProgress,
    setIsOptimizingContent,
    prepMessage = "Preparing research batch…",
  } = params;

  const batchKey = `${site.id}-batch`;
  const urls = rows.map((r) => r.url.trim()).filter(Boolean);
  const urlKeywords: Record<string, string> = {};
  const urlHarnessSections: Record<string, HarnessSectionListItem[]> = {};
  const initialUrlStatuses: Record<string, BulkOptimizationState["urlStatuses"][string]> = {};

  for (const row of rows) {
    const url = row.url?.trim();
    if (!url) continue;
    const kw = row.focusKeyword?.trim();
    if (kw) urlKeywords[url] = kw;
    initialUrlStatuses[url] = "pending";
    urlHarnessSections[url] = buildWaitingResearchHarnessSections();
  }

  setOptimizingState(setIsOptimizingContent, batchKey, true);
  setOptimizationProgress((prev) =>
    mergeOptimizationProgress(prev as Record<string, unknown>, site.id, {
      step: "Researching…",
      progress: 2,
      message: prepMessage,
      harnessSections: [],
      harnessPlannedSectionCount: RESEARCH_HARNESS_TOTAL_SECTIONS,
    }),
  );
  setBulkOptimizationState((prev) => ({
    ...prev,
    [batchKey]: {
      urls,
      currentIndex: 0,
      urlStatuses: initialUrlStatuses,
      currentStep: "Researching…",
      currentUrl: urls[0],
      urlKeywords,
      runKind: "research",
      urlHarnessSections,
      urlGeneratedFiles: {},
      currentStepProgress: {
        step: "Researching…",
        progress: 2,
        message: prepMessage,
        harnessSections: [],
        harnessPlannedSectionCount: RESEARCH_HARNESS_TOTAL_SECTIONS,
      },
    },
  }));
  initOverviewBulkHarnessPagination(batchKey, urls.length, setBulkOptimizationState);

  return batchKey;
}

export function setResearchBatchPrepMessage(
  batchKey: string,
  siteId: string,
  message: string,
  setters: ResearchHarnessSetters,
): void {
  const { setBulkOptimizationState, setOptimizationProgress } = setters;
  setOptimizationProgress((prev) =>
    mergeOptimizationProgress(prev as Record<string, unknown>, siteId, {
      step: "Researching…",
      progress: 2,
      message,
    }),
  );
  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [batchKey]: {
        ...current,
        currentStep: "Researching…",
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: "Researching…",
          progress: 2,
          message,
        },
      },
    };
  });
}

export function setResearchUrlStatus(
  batchKey: string,
  url: string,
  status: BulkOptimizationState["urlStatuses"][string],
  setBulkOptimizationState: SetBulkState,
): void {
  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [batchKey]: {
        ...current,
        urlStatuses: { ...(current.urlStatuses || {}), [url]: status },
      },
    };
  });
}

export function applyResearchHarnessPayload(
  url: string,
  setters: ResearchHarnessSetters,
  payload: BulkHarnessSectionPayload,
): void {
  const { siteId, batchKey, setBulkOptimizationState, setOptimizationProgress } = setters;
  const message = `Research ${payload.sectionIndex + 1}/${payload.totalSections}: ${payload.title}${payload.phase === "start" ? "…" : ""}`;
  let latestProgress = 2;

  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    const prevSections = current.urlHarnessSections?.[url] ?? buildWaitingResearchHarnessSections();
    const nextUrlSections = reduceHarnessSectionList(prevSections, payload);
    const nextBatch: BulkOptimizationState = {
      ...current,
      urlHarnessSections: {
        ...(current.urlHarnessSections || {}),
        [url]: nextUrlSections,
      },
    };
    latestProgress = computeResearchBatchProgress(nextBatch);
    return {
      ...prev,
      [batchKey]: {
        ...nextBatch,
        currentProgress: latestProgress,
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: "Researching…",
          progress: latestProgress,
          message,
          harnessPlannedSectionCount: RESEARCH_HARNESS_TOTAL_SECTIONS,
        },
      },
    };
  });

  setOptimizationProgress((prev) =>
    mergeHarnessProgressSiteAndBatch(prev as Record<string, unknown>, siteId, {
      step: "Researching…",
      progress: latestProgress,
      message,
      harnessPlannedSectionCount: RESEARCH_HARNESS_TOTAL_SECTIONS,
    }),
  );
}

export function finishResearchRowHarness(
  url: string,
  rowIndex: number,
  summaries: ResearchHarnessDoneSummary | undefined,
  setters: ResearchHarnessSetters,
  success: boolean,
): void {
  const { batchKey, setBulkOptimizationState } = setters;
  const sections = summaries ? buildDoneResearchHarnessSections(rowIndex, summaries) : undefined;
  const files = sections ? researchHarnessGeneratedFiles(sections, url) : [];

  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    const nextBatch: BulkOptimizationState = {
      ...current,
      urlStatuses: {
        ...(current.urlStatuses || {}),
        [url]: success ? "completed" : "error",
      },
      ...(sections
        ? {
            urlHarnessSections: {
              ...(current.urlHarnessSections || {}),
              [url]: sections,
            },
            urlGeneratedFiles: {
              ...(current.urlGeneratedFiles || {}),
              [url]: files,
            },
          }
        : {}),
    };
    const progress = computeResearchBatchProgress(nextBatch);
    return {
      ...prev,
      [batchKey]: {
        ...nextBatch,
        currentProgress: progress,
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: success ? "Researching…" : "Research failed",
          progress,
          message: success ? `Research complete for ${url}` : `Research failed for ${url}`,
        },
      },
    };
  });
}

export function makeResearchHarnessCallback(
  indexToUrl: Map<number, string>,
  setters: ResearchHarnessSetters,
): (index: number, payload: BulkHarnessSectionPayload) => void {
  return (index, payload) => {
    const url = indexToUrl.get(index)?.trim();
    if (!url) return;
    applyResearchHarnessPayload(url, setters, payload);
  };
}

export function finalizeOverviewResearchHarnessBatch(
  batchKey: string,
  siteId: string,
  applied: number,
  total: number,
  setBulkOptimizationState: SetBulkState,
  setOptimizationProgress: SetOptProgress,
  setIsOptimizingContent: SetIsOptimizing,
): void {
  const message = `Research finished: ${applied}/${total} updated`;
  setOptimizationProgress((prev) =>
    mergeOptimizationProgress(prev as Record<string, unknown>, siteId, {
      step: "Batch complete",
      progress: 100,
      message,
    }),
  );
  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [batchKey]: {
        ...current,
        currentStep: "Batch complete",
        currentProgress: 100,
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: "Batch complete",
          progress: 100,
          message,
        },
      },
    };
  });
  setOptimizingState(setIsOptimizingContent, batchKey, false);
}
