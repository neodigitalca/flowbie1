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
  markScenarioRowDone,
  markScenarioRowError,
  markScenarioRowOptimizing,
  markScenarioRowSkipped,
  setScenarioHarnessMessage,
  type ScenarioHarnessSetters,
} from "@/lib/overview/overview-blog-scenario-harness-mutations";
import {
  generateAndReplaceScenarioSectionHtml,
  extractIllustrativeSectionHtml,
} from "@/lib/overview/overview-blog-scenario-section";
import { resolveOverviewSourceHtml, type OverviewHarnessPageKind } from "@/lib/overview/overview-blog-overview-prepend";

type SetBulkState = Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
type SetOptProgress = Dispatch<SetStateAction<Record<string, unknown>>>;
type SetIsOptimizing = Dispatch<SetStateAction<Record<string, boolean>>>;

function isMissingBodyHtmlMessage(message: string): boolean {
  return /no html body/i.test(message);
}

export type BlogScenarioCatalogRow = {
  index: number;
  url: string;
  title: string;
  focusKeyword: string;
  html: string;
  entity?: string;
  pageKind?: OverviewHarnessPageKind;
  seoResearchBrief?: string;
};

export function initOverviewBlogScenarioHarnessBatchState(params: {
  site: WordPressSite;
  catalog: BlogScenarioCatalogRow[];
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
    prepMessage = "Preparing Scenario batch…",
  } = params;

  const batchKey = `${site.id}-batch`;
  const urls = catalog.map((c) => c.url.trim()).filter(Boolean);
  const urlKeywords: Record<string, string> = {};
  const initialUrlStatuses: BulkOptimizationState["urlStatuses"] = {};

  for (const entry of catalog) {
    const url = entry.url.trim();
    if (!url) continue;
    if (entry.focusKeyword) urlKeywords[url] = entry.focusKeyword;
    initialUrlStatuses[url] = "pending";
  }

  setOptimizingState(setIsOptimizingContent, batchKey, true);
  setOptimizationProgress((prev) =>
    mergeOptimizationProgress(prev as Record<string, unknown>, site.id, {
      step: "Scenario",
      progress: 2,
      message: prepMessage,
      harnessSections: [],
      harnessPlannedSectionCount: 1,
    }),
  );
  setBulkOptimizationState((prev) => ({
    ...prev,
    [batchKey]: {
      urls,
      currentIndex: 0,
      urlStatuses: initialUrlStatuses,
      currentStep: "Scenario",
      currentUrl: urls[0],
      urlKeywords,
      runKind: "aiScenario",
      harnessStartedAt: Date.now(),
      urlGeneratedFiles: {},
      currentStepProgress: {
        step: "Scenario",
        progress: 2,
        message: prepMessage,
        harnessSections: [],
        harnessPlannedSectionCount: 1,
      },
    },
  }));
  initOverviewBulkHarnessPagination(batchKey, urls.length, setBulkOptimizationState);

  return batchKey;
}

export function finalizeOverviewBlogScenarioHarnessBatch(
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
      message: "Scenario batch finished",
    });
    return next;
  });
}

export type RunOverviewBlogScenarioHarnessBatchParams = {
  catalog: BlogScenarioCatalogRow[];
  site: WordPressSite;
  apiKey: string;
  model?: string;
  harnessSetters: ScenarioHarnessSetters;
  updateRow: (index: number, patch: Partial<OverviewRow>) => void;
  onRowOk?: (url: string, html: string) => void;
};

export async function runOverviewBlogScenarioHarnessBatch(
  params: RunOverviewBlogScenarioHarnessBatchParams,
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
      step: "Scenario",
    });

    for (const row of pageCatalog) {
      globalRowNum += 1;
      const url = row.url.trim();
      try {
        markScenarioRowOptimizing(
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
          markScenarioRowSkipped(url, row.index, harnessSetters, updateRow);
          continue;
        }

        if (!extractIllustrativeSectionHtml(sourceHtml).trim()) {
          markScenarioRowSkipped(url, row.index, harnessSetters, updateRow);
          continue;
        }

        if (row.pageKind === "entity" && !row.entity?.trim()) {
          failed += 1;
          markScenarioRowError(
            url,
            row.index,
            harnessSetters,
            updateRow,
            "Could not resolve place entity for this SAP page",
          );
          continue;
        }

        const result = await generateAndReplaceScenarioSectionHtml({
          sourceHtml,
          articleTitle: row.title,
          focusKeyword: row.focusKeyword,
          pageUrl: url,
          site,
          entity: row.entity,
          pageKind: row.pageKind,
          seoResearchBrief: row.seoResearchBrief,
          apiKey,
          model,
        });

        if (!result) {
          markScenarioRowSkipped(url, row.index, harnessSetters, updateRow);
          continue;
        }

        const scenarioHtml =
          extractIllustrativeSectionHtml(result.html) || result.scenarioHtml;
        markScenarioRowDone(url, row.index, harnessSetters, updateRow, result.html, scenarioHtml);
        onRowOk?.(url, result.html);
        ok += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isMissingBodyHtmlMessage(message)) {
          markScenarioRowSkipped(url, row.index, harnessSetters, updateRow);
          continue;
        }
        failed += 1;
        markScenarioRowError(url, row.index, harnessSetters, updateRow, message);
      }
    }
  }

  setScenarioHarnessMessage(
    harnessSetters,
    `Scenario finished: ${ok} ok, ${failed} failed`,
    100,
  );

  return { ok, failed };
}
