import type { Dispatch, SetStateAction } from "react";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { mergeHarnessProgressSiteAndBatch } from "@/hooks/content-optimization/optimization-helpers-a";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { reduceHarnessSectionList } from "@/lib/bulk/harness-sections-reducer";
import { extractH2TextsFromHtml } from "@/lib/overview/overview-blog-headers-extract";
import { OVERVIEW_HARNESS_SECTION_TITLES } from "@/lib/overview/overview-blog-overview-harness-sections";

type SetBulkState = Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
type SetOptProgress = Dispatch<SetStateAction<Record<string, unknown>>>;

export type OverviewHarnessSetters = {
  siteId: string;
  batchKey: string;
  setBulkOptimizationState: SetBulkState;
  setOptimizationProgress: SetOptProgress;
};

export function setOverviewHarnessMessage(
  setters: OverviewHarnessSetters,
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
          step: "Overview",
          progress: pct,
          message,
        },
      },
    };
  });
  setters.setOptimizationProgress((prev) => {
    const next = { ...(prev as Record<string, unknown>) };
    mergeHarnessProgressSiteAndBatch(next, setters.siteId, {
      step: "Overview",
      progress: pct,
      message,
    });
    const batch = next[setters.batchKey] as Record<string, unknown> | undefined;
    if (batch && typeof batch === "object") {
      next[setters.batchKey] = {
        ...batch,
        currentStepProgress: {
          ...(batch.currentStepProgress as object),
          step: "Overview",
          progress: pct,
          message,
        },
      };
    }
    return next;
  });
}

export function emitOverviewHarnessPayload(
  url: string,
  setters: OverviewHarnessSetters,
  payload: BulkHarnessSectionPayload,
): void {
  const { siteId, batchKey, setBulkOptimizationState, setOptimizationProgress } = setters;
  const message = `Overview ${payload.sectionIndex + 1}/${payload.totalSections}: ${payload.title}${payload.phase === "start" ? "…" : ""}`;
  const progress =
    10 +
    Math.round(
      ((payload.sectionIndex + (payload.phase === "done" ? 1 : 0.5)) /
        Math.max(payload.totalSections, 1)) *
        80,
    );

  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    const prevSections = current.urlHarnessSections?.[url] ?? [];
    const nextUrlSections = reduceHarnessSectionList(prevSections, payload);
    return {
      ...prev,
      [batchKey]: {
        ...current,
        currentUrl: url,
        urlHarnessSections: {
          ...(current.urlHarnessSections || {}),
          [url]: nextUrlSections,
        },
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: "Overview",
          progress,
          message,
          harnessPlannedSectionCount: OVERVIEW_HARNESS_SECTION_TITLES.length,
        },
      },
    };
  });

  setOptimizationProgress((prev) =>
    mergeHarnessProgressSiteAndBatch(prev as Record<string, unknown>, siteId, {
      step: "Overview",
      progress,
      message,
      harnessPlannedSectionCount: OVERVIEW_HARNESS_SECTION_TITLES.length,
    }),
  );
}

export function markOverviewRowOptimizing(
  url: string,
  index: number,
  setters: OverviewHarnessSetters,
  updateRow: (index: number, patch: Partial<OverviewRow>) => void,
  rowNum: number,
  total: number,
  label: string,
): void {
  updateRow(index, { status: "ai-overview" });
  setters.setBulkOptimizationState((prev) => {
    const current = prev[setters.batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [setters.batchKey]: {
        ...current,
        currentUrl: url,
        currentIndex: rowNum - 1,
        urlStatuses: { ...(current.urlStatuses || {}), [url]: "optimizing" },
      },
    };
  });
  setOverviewHarnessMessage(
    setters,
    `Overview ${rowNum}/${total}: ${label}`,
    10 + Math.round(((rowNum - 1) / Math.max(total, 1)) * 85),
  );
}

export function markOverviewRowDone(
  url: string,
  index: number,
  setters: OverviewHarnessSetters,
  updateRow: (index: number, patch: Partial<OverviewRow>) => void,
  html: string,
  overviewSectionHtml?: string,
): void {
  const blogH2List = extractH2TextsFromHtml(html);
  updateRow(index, {
    status: "idle",
    postContent: html,
    postContentOptimized: html,
    blogH2List,
  });
  setters.setBulkOptimizationState((prev) => {
    const current = prev[setters.batchKey];
    if (!current) return prev;
    const overviewFile =
      overviewSectionHtml?.trim()
        ? [
            {
              name: "overview.html",
              content: overviewSectionHtml.trim(),
              mimeType: "text/html;charset=utf-8",
            },
          ]
        : [];
    return {
      ...prev,
      [setters.batchKey]: {
        ...current,
        urlStatuses: { ...(current.urlStatuses || {}), [url]: "completed" },
        urlGeneratedFiles: {
          ...(current.urlGeneratedFiles || {}),
          ...(overviewFile.length ? { [url]: overviewFile } : {}),
        },
      },
    };
  });
}

export function markOverviewRowError(
  url: string,
  index: number,
  setters: OverviewHarnessSetters,
  updateRow: (index: number, patch: Partial<OverviewRow>) => void,
  message: string,
): void {
  updateRow(index, { status: "error" });
  setters.setBulkOptimizationState((prev) => {
    const current = prev[setters.batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [setters.batchKey]: {
        ...current,
        urlStatuses: { ...(current.urlStatuses || {}), [url]: "error" },
      },
    };
  });
  setOverviewHarnessMessage(setters, message);
}
