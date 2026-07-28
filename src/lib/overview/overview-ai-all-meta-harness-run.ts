import type { Dispatch, SetStateAction } from "react";
import { flushSync } from "react-dom";
import { notify } from "@/lib/app-notifications";
import { notifyAiAllMetaFailedForAllXRowS, notifyAiAllMetaFinishedForXPageS, notifyAiAllMetaFinishedXXUpdatedSkipped } from "@/lib/notify-messages";
import type { HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { type AiAllMetaCatalogRow } from "@/lib/overview/overview-ai-all-meta-batch-catalog";
import type { AiAllMetaRowPatch } from "@/lib/overview/overview-ai-all-meta-batch-parse";
import { buildWaitingMetaHarnessSections } from "@/lib/overview/overview-ai-all-meta-harness-sections";
import {
  buildAiAllMetaEligibleRows,
  runOverviewAiAllMetaBatch,
} from "@/lib/overview/overview-ai-all-meta-batch";
import type { FaqHarnessOptimizeDeps } from "@/lib/overview/overview-faq-harness-run";
import {
  type MetaHarnessSetters,
  setMetaUrlStatus,
} from "@/lib/overview/overview-ai-all-meta-harness-mutations";
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

export type { MetaHarnessSetters } from "@/lib/overview/overview-ai-all-meta-harness-mutations";

export type RunOverviewAiAllMetaHarnessParams = {
  site: WordPressSite;
  rows: OverviewRow[];
  catalog: AiAllMetaCatalogRow[];
  skippedNoBrief: number[];
  skippedNoKeyword?: number[];
  runAiAllMetaBatchForCatalog: (
    chunk: AiAllMetaCatalogRow[],
  ) => Promise<Map<string, AiAllMetaRowPatch>>;
  updateRow: (index: number, patch: Partial<OverviewRow>) => void;
  setBulkOptimizationState: SetBulkState;
  setOptimizationProgress: SetOptProgress;
  setIsOptimizingContent: SetIsOptimizing;
  skipInit?: boolean;
  bulkAiFaqSeedCount: number;
  faqDeps: FaqHarnessOptimizeDeps;
};

export type PrimeOverviewAiAllMetaHarnessParams = Pick<
  RunOverviewAiAllMetaHarnessParams,
  | "site"
  | "rows"
  | "setBulkOptimizationState"
  | "setOptimizationProgress"
  | "setIsOptimizingContent"
> & {
  prepMessage?: string;
};

export function initOverviewAiAllMetaHarnessBatchState(
  params: Pick<
    RunOverviewAiAllMetaHarnessParams,
    "site" | "rows" | "setBulkOptimizationState" | "setOptimizationProgress" | "setIsOptimizingContent"
  > & { prepMessage?: string; catalog?: AiAllMetaCatalogRow[] },
): string {
  const {
    site,
    rows,
    catalog = [],
    setBulkOptimizationState,
    setOptimizationProgress,
    setIsOptimizingContent,
    prepMessage = "Preparing meta batch…",
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
  }

  for (const entry of catalog) {
    const url = entry.url.trim();
    if (url) urlHarnessSections[url] = buildWaitingMetaHarnessSections(entry);
  }

  setOptimizingState(setIsOptimizingContent, batchKey, true);
  setOptimizationProgress((prev) =>
    mergeOptimizationProgress(prev as Record<string, unknown>, site.id, {
      step: "Generating meta...",
      progress: 5,
      message: prepMessage,
      harnessSections: [],
      harnessPlannedSectionCount: null,
    }),
  );
  setBulkOptimizationState((prev) => ({
    ...prev,
    [batchKey]: {
      urls,
      currentIndex: 0,
      urlStatuses: initialUrlStatuses,
      currentStep: "Generating meta...",
      currentUrl: urls[0],
      urlKeywords,
      runKind: "aiAllMeta",
      urlHarnessSections,
      urlGeneratedFiles: {},
      currentStepProgress: {
        step: "Generating meta...",
        progress: 5,
        message: prepMessage,
        harnessSections: [],
        harnessPlannedSectionCount: null,
      },
    },
  }));
  initOverviewBulkHarnessPagination(batchKey, urls.length, setBulkOptimizationState);

  return batchKey;
}

/** @deprecated Use initOverviewAiAllMetaHarnessBatchState for fleet-first UX. */
export function primeOverviewAiAllMetaHarnessEditor(params: PrimeOverviewAiAllMetaHarnessParams): void {
  initOverviewAiAllMetaHarnessBatchState(params);
}

export function isOverviewAiAllMetaBatchCancelled(
  batchKey: string,
  setBulkOptimizationState: SetBulkState,
): boolean {
  let cancelled = false;
  setBulkOptimizationState((prev) => {
    const batch = prev[batchKey] as (BulkOptimizationState & { cancelRequested?: boolean }) | undefined;
    if (batch?.cancelRequested) cancelled = true;
    return prev;
  });
  return cancelled;
}

function seedCatalogHarnessSections(
  batchKey: string,
  catalog: AiAllMetaCatalogRow[],
  setBulkOptimizationState: SetBulkState,
): void {
  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current) return prev;
    const urlHarnessSections = { ...(current.urlHarnessSections || {}) };
    for (const entry of catalog) {
      const url = entry.url.trim();
      if (url) urlHarnessSections[url] = buildWaitingMetaHarnessSections(entry);
    }
    return {
      ...prev,
      [batchKey]: { ...current, urlHarnessSections },
    };
  });
}

export async function runOverviewAiAllMetaHarness(
  params: RunOverviewAiAllMetaHarnessParams,
): Promise<void> {
  const {
    site,
    rows,
    catalog,
    skippedNoBrief,
    skippedNoKeyword = [],
    runAiAllMetaBatchForCatalog,
    updateRow,
    setBulkOptimizationState,
    setOptimizationProgress,
    setIsOptimizingContent,
    skipInit,
    bulkAiFaqSeedCount,
    faqDeps,
  } = params;

  const batchKey = `${site.id}-batch`;
  const totalRows = rows.length;

  if (!skipInit) {
    initOverviewAiAllMetaHarnessBatchState({
      site,
      rows,
      catalog,
      setBulkOptimizationState,
      setOptimizationProgress,
      setIsOptimizingContent,
    });
  } else {
    setOptimizingState(setIsOptimizingContent, batchKey, true);
    seedCatalogHarnessSections(batchKey, catalog, setBulkOptimizationState);
  }

  const harnessSetters: MetaHarnessSetters = {
    siteId: site.id,
    batchKey,
    setBulkOptimizationState,
    setOptimizationProgress,
  };

  let applied = 0;
  let failed = 0;

  try {
    const eligible = buildAiAllMetaEligibleRows(rows, catalog);
    const batchResult = await runOverviewAiAllMetaBatch({
      site,
      eligible,
      harnessSetters,
      batchKey,
      bulkAiFaqSeedCount,
      faqDeps,
      runAiAllMetaBatchForCatalog,
      updateRow,
      isCancelled: () => isOverviewAiAllMetaBatchCancelled(batchKey, setBulkOptimizationState),
      onRowStart: (index, row) => {
        const url = row.url?.trim();
        if (!url) return;
        flushSync(() => {
          setMetaUrlStatus(batchKey, url, "optimizing", setBulkOptimizationState);
        });
      },
    });
    applied = batchResult.applied;
    failed = batchResult.failed;

    for (const index of skippedNoBrief) {
      if (isOverviewAiAllMetaBatchCancelled(batchKey, setBulkOptimizationState)) break;
      const row = rows[index];
      if (!row?.url?.trim()) continue;
      const url = row.url.trim();
      flushSync(() => {
        updateRow(index, { status: "error" });
        setMetaUrlStatus(batchKey, url, "skipped", setBulkOptimizationState, "Skipped (no SEO brief on row)");
      });
      failed += 1;
    }

    for (const index of skippedNoKeyword) {
      if (isOverviewAiAllMetaBatchCancelled(batchKey, setBulkOptimizationState)) break;
      const row = rows[index];
      if (!row?.url?.trim()) continue;
      const url = row.url.trim();
      flushSync(() => {
        updateRow(index, { status: "error" });
        setMetaUrlStatus(batchKey, url, "skipped", setBulkOptimizationState, "Missing focus keyword");
      });
      failed += 1;
    }

    setOptimizationProgress((prev) =>
      mergeOptimizationProgress(prev as Record<string, unknown>, site.id, {
        step: "Batch complete",
        progress: 100,
        message: `AI All Meta finished: ${applied}/${totalRows} updated`,
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
            message: `AI All Meta finished: ${applied}/${totalRows} updated`,
          },
        },
      };
    });

    if (failed > 0 && applied === 0) {
      notify.error(notifyAiAllMetaFailedForAllXRowS(totalRows), { duration: 12000 });
    } else if (failed > 0 || skippedNoBrief.length > 0 || skippedNoKeyword.length > 0) {
      notify.warning(
        `AI All Meta finished: ${applied}/${totalRows} updated${skippedNoKeyword.length ? `, ${skippedNoKeyword.length} missing keyword` : ""}${skippedNoBrief.length ? `, ${skippedNoBrief.length} skipped` : ""}${failed ? `, ${failed} failed` : ""}.`,
        { duration: 10000 },
      );
    } else {
      notify.success(notifyAiAllMetaFinishedForXPageS(applied));
    }
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "AI All Meta batch failed.";
    notify.error(msg, { duration: 12000 });
  } finally {
    setOptimizingState(setIsOptimizingContent, batchKey, false);
  }
}
