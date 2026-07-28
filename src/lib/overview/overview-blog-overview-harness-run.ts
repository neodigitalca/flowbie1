import type { Dispatch, SetStateAction } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  mergeHarnessProgressSiteAndBatch,
  setOptimizingState,
} from "@/hooks/content-optimization/optimization-helpers-a";
import { mergeOptimizationProgress } from "@/hooks/content-optimization/optimization-helpers";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import { ensureMasterInstructionsInMemory } from "@/lib/master-instructions-storage";
import {
  initOverviewBulkHarnessPagination,
  setOverviewBulkHarnessPageState,
} from "@/lib/overview/overview-bulk-page-state";
import { overviewBulkPageRanges } from "@/lib/overview/overview-bulk-page-size";
import {
  markOverviewRowDone,
  markOverviewRowError,
  markOverviewRowOptimizing,
  emitOverviewHarnessPayload,
  setOverviewHarnessMessage,
  type OverviewHarnessSetters,
} from "@/lib/overview/overview-blog-overview-harness-mutations";
import {
  buildWaitingOverviewHarnessSections,
  formatOverviewAnalyzeMarkdown,
  formatOverviewSectionMarkdown,
  makeOverviewHarnessDonePayload,
  makeOverviewHarnessStartPayload,
  OVERVIEW_STEP_ANALYZE,
  OVERVIEW_STEP_OVERVIEW,
} from "@/lib/overview/overview-blog-overview-harness-sections";
import {
  extractOverviewSectionHtml,
  generateAndPrependOverviewHtml,
  resolveOverviewSourceHtml,
} from "@/lib/overview/overview-blog-overview-prepend";
import { extractH2TextsFromHtml } from "@/lib/overview/overview-blog-headers-extract";

type SetBulkState = Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
type SetOptProgress = Dispatch<SetStateAction<Record<string, unknown>>>;
type SetIsOptimizing = Dispatch<SetStateAction<Record<string, boolean>>>;

export type BlogOverviewCatalogRow = {
  index: number;
  url: string;
  title: string;
  focusKeyword: string;
  html: string;
};

export function initOverviewBlogOverviewHarnessBatchState(params: {
  site: WordPressSite;
  catalog: BlogOverviewCatalogRow[];
  setBulkOptimizationState: SetBulkState;
  setOptimizationProgress: SetOptProgress;
  setIsOptimizingContent: SetIsOptimizing;
  prepMessage?: string;
}): string {
  const {
    site,
    catalog,
    setBulkOptimizationState,
    setOptimizationProgress,
    setIsOptimizingContent,
    prepMessage = "Preparing Overview batch…",
  } = params;

  const batchKey = `${site.id}-batch`;
  const urls = catalog.map((c) => c.url.trim()).filter(Boolean);
  const urlKeywords: Record<string, string> = {};
  const initialUrlStatuses: BulkOptimizationState["urlStatuses"] = {};
  const urlHarnessSections: NonNullable<BulkOptimizationState["urlHarnessSections"]> = {};

  for (const entry of catalog) {
    const url = entry.url.trim();
    if (!url) continue;
    if (entry.focusKeyword) urlKeywords[url] = entry.focusKeyword;
    initialUrlStatuses[url] = "pending";
    urlHarnessSections[url] = buildWaitingOverviewHarnessSections();
  }

  setOptimizingState(setIsOptimizingContent, batchKey, true);
  setOptimizationProgress((prev) =>
    mergeOptimizationProgress(prev as Record<string, unknown>, site.id, {
      step: "Overview",
      progress: 2,
      message: prepMessage,
      harnessSections: [],
      harnessPlannedSectionCount: 2,
    }),
  );
  setBulkOptimizationState((prev) => ({
    ...prev,
    [batchKey]: {
      urls,
      currentIndex: 0,
      urlStatuses: initialUrlStatuses,
      currentStep: "Overview",
      currentUrl: urls[0],
      urlKeywords,
      runKind: "aiOverview",
      harnessStartedAt: Date.now(),
      urlHarnessSections,
      urlGeneratedFiles: {},
      currentStepProgress: {
        step: "Overview",
        progress: 2,
        message: prepMessage,
        harnessSections: [],
        harnessPlannedSectionCount: 2,
      },
    },
  }));
  initOverviewBulkHarnessPagination(batchKey, urls.length, setBulkOptimizationState);

  return batchKey;
}

export function finalizeOverviewBlogOverviewHarnessBatch(
  batchKey: string,
  siteId: string,
  setIsOptimizingContent: SetIsOptimizing,
  setOptimizationProgress: SetOptProgress,
): void {
  setOptimizingState(setIsOptimizingContent, batchKey, false);
  setOptimizationProgress((prev) => {
    const next = { ...(prev as Record<string, unknown>) };
    delete next[batchKey];
    mergeHarnessProgressSiteAndBatch(next, siteId, {
      step: "Complete",
      progress: 100,
      message: "Overview batch finished",
    });
    return next;
  });
}

export type RunOverviewBlogOverviewHarnessBatchParams = {
  catalog: BlogOverviewCatalogRow[];
  site: WordPressSite;
  apiKey: string;
  model?: string;
  harnessSetters: OverviewHarnessSetters;
  updateRow: (index: number, patch: Partial<OverviewRow>) => void;
  onRowOk?: (url: string, html: string) => void;
};

export async function runOverviewBlogOverviewHarnessBatch(
  params: RunOverviewBlogOverviewHarnessBatchParams,
): Promise<{ ok: number; failed: number }> {
  const { catalog, site, apiKey, model, harnessSetters, updateRow, onRowOk } = params;
  if (!catalog.length) return { ok: 0, failed: 0 };

  await ensureMasterInstructionsInMemory(site.id ?? null);

  const pageRanges = overviewBulkPageRanges(catalog.length);
  let ok = 0;
  let failed = 0;
  let globalRowNum = 0;

  for (const { start, end, page, pageCount } of pageRanges) {
    const pageCatalog = catalog.slice(start, end);
    setOverviewBulkHarnessPageState({
      batchKey: harnessSetters.batchKey,
      siteId: harnessSetters.siteId,
      page,
      pageCount,
      start,
      end,
      total: catalog.length,
      setBulkOptimizationState: harnessSetters.setBulkOptimizationState,
      setOptimizationProgress: harnessSetters.setOptimizationProgress,
      step: "Overview",
    });

    for (const row of pageCatalog) {
      globalRowNum += 1;
      const url = row.url.trim();
      try {
        markOverviewRowOptimizing(
          url,
          row.index,
          harnessSetters,
          updateRow,
          globalRowNum,
          catalog.length,
          row.title || url,
        );

        const sourceHtml = resolveOverviewSourceHtml({ postContentOptimized: row.html }, row.html);
        if (!sourceHtml.trim()) {
          failed += 1;
          markOverviewRowError(
            url,
            row.index,
            harnessSetters,
            updateRow,
            "No HTML body for Overview prepend",
          );
          continue;
        }

        const bodyH2Titles = extractH2TextsFromHtml(sourceHtml).filter(
          (t) => t.trim().toLowerCase() !== "overview",
        );
        emitOverviewHarnessPayload(
          url,
          harnessSetters,
          makeOverviewHarnessStartPayload(row.index, OVERVIEW_STEP_ANALYZE),
        );
        emitOverviewHarnessPayload(
          url,
          harnessSetters,
          makeOverviewHarnessDonePayload(
            row.index,
            OVERVIEW_STEP_ANALYZE,
            formatOverviewAnalyzeMarkdown(bodyH2Titles),
          ),
        );

        emitOverviewHarnessPayload(
          url,
          harnessSetters,
          makeOverviewHarnessStartPayload(row.index, OVERVIEW_STEP_OVERVIEW),
        );

        const result = await generateAndPrependOverviewHtml({
          sourceHtml,
          articleTitle: row.title,
          focusKeyword: row.focusKeyword,
          pageUrl: url,
          connectedSite: { name: site.name, siteUrl: site.siteUrl },
          apiKey,
          model,
        });

        const overviewHtml =
          extractOverviewSectionHtml(result.html) ||
          extractOverviewSectionHtml(result.html.slice(0, 8000));
        emitOverviewHarnessPayload(
          url,
          harnessSetters,
          makeOverviewHarnessDonePayload(
            row.index,
            OVERVIEW_STEP_OVERVIEW,
            formatOverviewSectionMarkdown(overviewHtml),
          ),
        );
        markOverviewRowDone(url, row.index, harnessSetters, updateRow, result.html, overviewHtml);
        onRowOk?.(url, result.html);
        ok += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        markOverviewRowError(url, row.index, harnessSetters, updateRow, message);
      }
    }
  }

  setOverviewHarnessMessage(
    harnessSetters,
    `Overview finished: ${ok} ok, ${failed} failed`,
    100,
  );

  return { ok, failed };
}
