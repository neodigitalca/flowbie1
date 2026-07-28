import type { Dispatch, SetStateAction } from "react";
import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { reduceHarnessSectionList, type HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import {
  faqHarnessGeneratedFiles,
  formatFaqPairMarkdown,
} from "@/lib/overview/overview-faq-harness-sections";
import { extractH2TextsFromHtml } from "@/lib/overview/overview-blog-headers-extract";
import {
  mergeHarnessProgressSiteAndBatch,
} from "@/hooks/content-optimization/optimization-helpers-a";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import type { FaqEntry } from "@/lib/faq-entries";
import { serializeFaqEntriesPlain } from "@/lib/faq-entries";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";

type SetBulkState = Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
type SetOptProgress = Dispatch<SetStateAction<Record<string, unknown>>>;

export type FaqHarnessSetters = {
  siteId: string;
  batchKey: string;
  setBulkOptimizationState: SetBulkState;
  setOptimizationProgress: SetOptProgress;
};

function countDoneSections(sections: HarnessSectionListItem[] | undefined): number {
  return (sections ?? []).filter((s) => s.status === "done").length;
}

export function computeFaqBatchProgress(batch: BulkOptimizationState): number {
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

export function setFaqUrlStatus(
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

export function applyFaqHarnessPayload(
  url: string,
  setters: FaqHarnessSetters,
  payload: BulkHarnessSectionPayload,
): void {
  const { siteId, batchKey, setBulkOptimizationState, setOptimizationProgress } = setters;
  const message = `FAQ ${payload.sectionIndex + 1}/${payload.totalSections}: ${payload.title}${payload.phase === "start" ? "…" : ""}`;
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
    latestProgress = computeFaqBatchProgress(nextBatch);
    return {
      ...prev,
      [batchKey]: {
        ...nextBatch,
        currentProgress: latestProgress,
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: "AI FAQs",
          progress: latestProgress,
          message,
          harnessPlannedSectionCount: payload.totalSections,
        },
      },
    };
  });

  setOptimizationProgress((prev) =>
    mergeHarnessProgressSiteAndBatch(prev as Record<string, unknown>, siteId, {
      step: "AI FAQs",
      progress: latestProgress,
      message,
      harnessPlannedSectionCount: payload.totalSections,
    }),
  );
}

export function emitFaqHarnessPayload(
  url: string,
  payload: BulkHarnessSectionPayload,
  setters: FaqHarnessSetters,
): void {
  applyFaqHarnessPayload(url, setters, payload);
}

export function finishFaqRowHarness(
  url: string,
  rowIndex: number,
  entries: FaqEntry[],
  setters: FaqHarnessSetters,
  updateRow: (index: number, patch: Partial<OverviewRow>) => void,
  options?: {
    postHtml?: string;
    faqSectionHtml?: string;
  },
): void {
  const { batchKey, setBulkOptimizationState } = setters;
  const faq = serializeFaqEntriesPlain(entries);
  const postHtml = options?.postHtml?.trim() || "";
  const faqSectionHtml = options?.faqSectionHtml?.trim() || "";

  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    const urlSections = current.urlHarnessSections?.[url] ?? [];
    const faqFiles = faqHarnessGeneratedFiles(urlSections, url);
    const existingFiles = current.urlGeneratedFiles?.[url] ?? [];
    const bodyFaqFile =
      faqSectionHtml
        ? [
            {
              name: "faq.html",
              content: faqSectionHtml,
              mimeType: "text/html;charset=utf-8",
            },
          ]
        : [];
    const files = [...existingFiles, ...faqFiles, ...bodyFaqFile];
    const nextBatch: BulkOptimizationState = {
      ...current,
      urlStatuses: {
        ...(current.urlStatuses || {}),
        [url]: "completed",
      },
      urlGeneratedFiles: {
        ...(current.urlGeneratedFiles || {}),
        [url]: files,
      },
    };
    const progress = computeFaqBatchProgress(nextBatch);
    return {
      ...prev,
      [batchKey]: {
        ...nextBatch,
        currentProgress: progress,
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: "AI FAQs",
          progress,
          message: `FAQ complete`,
        },
      },
    };
  });

  const rowPatch: Partial<OverviewRow> = { faq, status: "idle" };
  if (postHtml) {
    rowPatch.postContent = postHtml;
    rowPatch.postContentOptimized = postHtml;
    rowPatch.blogH2List = extractH2TextsFromHtml(postHtml);
  }
  updateRow(rowIndex, rowPatch);
}

export function markFaqRowError(
  url: string,
  rowIndex: number,
  setters: FaqHarnessSetters,
  updateRow: (index: number, patch: { status?: string }) => void,
  error?: string,
): void {
  setFaqUrlStatus(setters.batchKey, url, "error", setters.setBulkOptimizationState, error);
  updateRow(rowIndex, { status: "error" });
}

export function faqPairDoneMarkdown(entry: FaqEntry): string {
  return formatFaqPairMarkdown(entry.question, entry.answer);
}
