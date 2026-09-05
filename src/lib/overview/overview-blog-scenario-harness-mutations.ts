import type { Dispatch, SetStateAction } from "react";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { mergeHarnessProgressSiteAndBatch } from "@/hooks/content-optimization/optimization-helpers-a";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import { extractH2TextsFromHtml } from "@/lib/overview/overview-blog-headers-extract";

type SetBulkState = Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
type SetOptProgress = Dispatch<SetStateAction<Record<string, unknown>>>;

export type ScenarioHarnessSetters = {
  siteId: string;
  batchKey: string;
  setBulkOptimizationState: SetBulkState;
  setOptimizationProgress: SetOptProgress;
};

const STEP_LABEL = "Scenario";

export function setScenarioHarnessMessage(
  setters: ScenarioHarnessSetters,
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
          step: STEP_LABEL,
          progress: pct,
          message,
        },
      },
    };
  });
  setters.setOptimizationProgress((prev) => {
    const next = { ...(prev as Record<string, unknown>) };
    mergeHarnessProgressSiteAndBatch(next, setters.siteId, {
      step: STEP_LABEL,
      progress: pct,
      message,
    });
    const batch = next[setters.batchKey] as Record<string, unknown> | undefined;
    if (batch && typeof batch === "object") {
      next[setters.batchKey] = {
        ...batch,
        currentStepProgress: {
          ...(batch.currentStepProgress as object),
          step: STEP_LABEL,
          progress: pct,
          message,
        },
      };
    }
    return next;
  });
}

export function markScenarioRowOptimizing(
  url: string,
  index: number,
  setters: ScenarioHarnessSetters,
  updateRow: (index: number, patch: Partial<OverviewRow>) => void,
  rowNum: number,
  total: number,
  label: string,
): void {
  updateRow(index, { status: "ai-scenario" });
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
  setScenarioHarnessMessage(
    setters,
    `${STEP_LABEL} ${rowNum}/${total}: ${label}`,
    10 + Math.round(((rowNum - 1) / Math.max(total, 1)) * 85),
  );
}

export function markScenarioRowDone(
  url: string,
  index: number,
  setters: ScenarioHarnessSetters,
  updateRow: (index: number, patch: Partial<OverviewRow>) => void,
  html: string,
  scenarioSectionHtml?: string,
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
    const scenarioFile =
      scenarioSectionHtml?.trim()
        ? [
            {
              name: "scenario.html",
              content: scenarioSectionHtml.trim(),
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
          ...(scenarioFile.length ? { [url]: scenarioFile } : {}),
        },
      },
    };
  });
}

export function markScenarioRowSkipped(
  url: string,
  index: number,
  setters: ScenarioHarnessSetters,
  updateRow: (index: number, patch: Partial<OverviewRow>) => void,
): void {
  updateRow(index, { status: "idle" });
  setters.setBulkOptimizationState((prev) => {
    const current = prev[setters.batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [setters.batchKey]: {
        ...current,
        urlStatuses: { ...(current.urlStatuses || {}), [url]: "skipped" },
      },
    };
  });
}

export function markScenarioRowError(
  url: string,
  index: number,
  setters: ScenarioHarnessSetters,
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
  setScenarioHarnessMessage(setters, message);
}
