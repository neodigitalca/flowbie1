import type { Dispatch, SetStateAction } from "react";
import pLimit from "p-limit";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_FAQS_NOT_GENERATED, NOTIFY_FAQ_OPTIMIZATION_FAILED_FOR_ALL_SELECTED, notifyAiFaqOptimizationFinishedForXPage } from "@/lib/notify-messages";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { FaqEntry } from "@/lib/faq-entries";
import { parseFaqEntries, serializeFaqEntriesPlain } from "@/lib/faq-entries";
import { clampBulkAiFaqSeed } from "@/lib/overview/overview-row-helpers";
import {
  buildWaitingFaqHarnessSections,
  makeFaqPairHarnessDonePayload,
  makeFaqPairHarnessStartPayload,
} from "@/lib/overview/overview-faq-harness-sections";
import {
  emitFaqHarnessPayload,
  finishFaqRowHarness,
  markFaqRowError,
  type FaqHarnessSetters,
} from "@/lib/overview/overview-faq-harness-mutations";
import {
  appendFaqSectionToPostHtml,
  resolveFaqSourceHtml,
} from "@/lib/overview/overview-blog-faq-append";
import { generateFaqIntroParagraph } from "@/lib/overview/overview-blog-faq-intro-agent";
import { loadApiKey } from "@/lib/api";
import { getProductionModel } from "@/lib/optimization-settings-storage";
import { overviewBulkPageRanges } from "@/lib/overview/overview-bulk-page-size";
import { initOverviewBulkHarnessPagination, setOverviewBulkHarnessPageState } from "@/lib/overview/overview-bulk-page-state";
import {
  mergeHarnessProgressSiteAndBatch,
  setOptimizingState,
} from "@/hooks/content-optimization/optimization-helpers-a";
import { mergeOptimizationProgress } from "@/hooks/content-optimization/optimization-helpers";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import type { HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";

type SetBulkState = Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
type SetOptProgress = Dispatch<SetStateAction<Record<string, unknown>>>;
type SetIsOptimizing = Dispatch<SetStateAction<Record<string, boolean>>>;

export type FaqHarnessOptimizeDeps = {
  optimizeFaq: (
    url: string,
    focusKeyword: string | undefined,
    currentFaq: string,
    dfsContext: string | undefined,
    pageTitle?: string,
    metaDescription?: string,
    seoResearchBrief?: string,
    options?: { exactQuestionCount?: number; skipLoadingState?: boolean; includeAnswers?: boolean },
  ) => Promise<string | null>;
  optimizeFaqQuestion: (
    url: string,
    focusKeyword: string | undefined,
    question: string,
    currentFaq: string,
    dfsContext: string | undefined,
    pageTitle?: string,
    metaDescription?: string,
    seoResearchBrief?: string,
    options?: { skipLoadingState?: boolean },
  ) => Promise<string | null>;
  optimizeFaqAnswer: (
    url: string,
    focusKeyword: string | undefined,
    question: string,
    answer: string,
    currentFaq: string,
    dfsContext: string | undefined,
    pageTitle?: string,
    metaDescription?: string,
    seoResearchBrief?: string,
    options?: { skipLoadingState?: boolean },
  ) => Promise<string | null>;
  getDfsSerpContext: (row: OverviewRow) => Promise<string | undefined>;
};

export function resolveFaqPairCountForRow(row: OverviewRow, bulkAiFaqSeedCount: number): number {
  const entries = parseFaqEntries(row.faq);
  if (entries.length > 0) return entries.length;
  return clampBulkAiFaqSeed(bulkAiFaqSeedCount);
}

export type InitOverviewFaqHarnessParams = {
  site: WordPressSite;
  rows: OverviewRow[];
  bulkAiFaqSeedCount: number;
  setBulkOptimizationState: SetBulkState;
  setOptimizationProgress: SetOptProgress;
  setIsOptimizingContent: SetIsOptimizing;
  prepMessage?: string;
  pairCountByUrl?: Record<string, number>;
};

export function initOverviewFaqHarnessBatchState(params: InitOverviewFaqHarnessParams): string {
  const {
    site,
    rows,
    bulkAiFaqSeedCount,
    setBulkOptimizationState,
    setOptimizationProgress,
    setIsOptimizingContent,
    prepMessage = "Preparing FAQ batch…",
    pairCountByUrl = {},
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
    const pairCount = pairCountByUrl[url] ?? resolveFaqPairCountForRow(row, bulkAiFaqSeedCount);
    urlHarnessSections[url] = buildWaitingFaqHarnessSections(pairCount);
  }

  setOptimizingState(setIsOptimizingContent, batchKey, true);
  setOptimizationProgress((prev) =>
    mergeOptimizationProgress(prev as Record<string, unknown>, site.id, {
      step: "AI FAQs",
      progress: 2,
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
      currentStep: "AI FAQs",
      currentUrl: urls[0],
      urlKeywords,
      runKind: "aiFaq",
      urlHarnessSections,
      urlGeneratedFiles: {},
      currentStepProgress: {
        step: "AI FAQs",
        progress: 2,
        message: prepMessage,
        harnessSections: [],
        harnessPlannedSectionCount: null,
      },
    },
  }));
  initOverviewBulkHarnessPagination(batchKey, urls.length, setBulkOptimizationState);

  return batchKey;
}

export function finalizeOverviewFaqHarnessBatch(
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
      message: "FAQ batch finished",
    });
    return next;
  });
}

export type RunFaqPairsForRowParams = {
  row: OverviewRow;
  rowIndex: number;
  bulkAiFaqSeedCount: number;
  deps: FaqHarnessOptimizeDeps;
  harnessSetters: FaqHarnessSetters;
  updateRow: (index: number, patch: Partial<OverviewRow>) => void;
  sectionIndexOffset?: number;
  totalHarnessSections?: number;
  skipLoadingState?: boolean;
};

export async function runFaqPairsForRow(params: RunFaqPairsForRowParams): Promise<boolean> {
  const {
    row,
    rowIndex,
    bulkAiFaqSeedCount,
    deps,
    harnessSetters,
    updateRow,
    sectionIndexOffset = 0,
    totalHarnessSections: totalHarnessSectionsIn,
    skipLoadingState = true,
  } = params;

  const url = row.url.trim();
  if (!url) return false;

  let workingEntries = parseFaqEntries(row.faq);
  const pairCount =
    workingEntries.length > 0
      ? workingEntries.length
      : clampBulkAiFaqSeed(bulkAiFaqSeedCount);
  const totalSections = totalHarnessSectionsIn ?? pairCount;

  if (!workingEntries.length) {
    updateRow(rowIndex, { status: "ai-faq" });
    const briefSeed = row.seoResearch?.trim();
    const dfsContextSeed = briefSeed ? undefined : await deps.getDfsSerpContext(row);
    const generated = await deps.optimizeFaq(
      row.url,
      row.focusKeyword,
      "(none)",
      dfsContextSeed,
      row.title,
      row.metaDescription,
      briefSeed || undefined,
      {
        exactQuestionCount: pairCount,
        includeAnswers: true,
        skipLoadingState,
      },
    );
    if (!generated?.trim()) {
      markFaqRowError(url, rowIndex, harnessSetters, updateRow, NOTIFY_FAQS_NOT_GENERATED);
      return false;
    }
    workingEntries = parseFaqEntries(generated);
    if (!workingEntries.length) {
      markFaqRowError(url, rowIndex, harnessSetters, updateRow, "Could not parse generated FAQs");
      return false;
    }
    updateRow(rowIndex, { faq: serializeFaqEntriesPlain(workingEntries), status: "ai-faq" });
  }

  const brief = row.seoResearch?.trim();
  const dfsContext = brief ? undefined : await deps.getDfsSerpContext(row);
  const faqOpts = skipLoadingState ? { skipLoadingState: true as const } : undefined;
  const snapshotEntries = [...workingEntries];

  const pairResults = await Promise.all(
    snapshotEntries.map(async (entry, pairIndex) => {
      const sectionIndex = sectionIndexOffset + pairIndex;
      emitFaqHarnessPayload(
        url,
        makeFaqPairHarnessStartPayload(rowIndex, pairIndex, totalSections, sectionIndex),
        harnessSetters,
      );

      const improvedQ = await deps.optimizeFaqQuestion(
        row.url,
        row.focusKeyword,
        entry.question,
        serializeFaqEntriesPlain(snapshotEntries),
        dfsContext,
        row.title,
        row.metaDescription,
        brief || undefined,
        faqOpts,
      );
      if (!improvedQ) {
        return null;
      }

      const improvedA = await deps.optimizeFaqAnswer(
        row.url,
        row.focusKeyword,
        improvedQ,
        entry.answer,
        serializeFaqEntriesPlain(snapshotEntries),
        dfsContext,
        row.title,
        row.metaDescription,
        brief || undefined,
        faqOpts,
      );
      if (!improvedA) {
        return null;
      }

      const result: FaqEntry = { question: improvedQ, answer: improvedA };
      emitFaqHarnessPayload(
        url,
        makeFaqPairHarnessDonePayload(rowIndex, pairIndex, totalSections, sectionIndex, result),
        harnessSetters,
      );
      return { pairIndex, entry: result };
    }),
  );

  const merged = [...snapshotEntries];
  let anyFailed = false;
  for (const result of pairResults) {
    if (!result) {
      anyFailed = true;
      continue;
    }
    merged[result.pairIndex] = result.entry;
  }

  if (anyFailed && pairResults.every((r) => !r)) {
    markFaqRowError(url, rowIndex, harnessSetters, updateRow);
    return false;
  }

  const sourceHtml = resolveFaqSourceHtml(row);
  let appended: ReturnType<typeof appendFaqSectionToPostHtml> = null;
  let introError: string | null = null;
  if (sourceHtml) {
    try {
      const apiKey = (loadApiKey() ?? "").trim();
      if (!apiKey) {
        throw new Error("OpenRouter API key required for FAQ intro");
      }
      const introParagraph = await generateFaqIntroParagraph({
        apiKey,
        model: getProductionModel(),
        focusKeyword: row.focusKeyword,
        pageTitle: row.title,
        entries: merged,
      });
      appended = appendFaqSectionToPostHtml({
        sourceHtml,
        entries: merged,
        introParagraph,
      });
    } catch (err) {
      introError = err instanceof Error ? err.message : "FAQ intro generation failed";
    }
  }

  finishFaqRowHarness(url, rowIndex, merged, harnessSetters, updateRow, {
    postHtml: appended?.html,
    faqSectionHtml: appended?.faqSectionHtml,
  });

  if (introError) {
    markFaqRowError(url, rowIndex, harnessSetters, updateRow, introError);
    return false;
  }
  return true;
}

export type RunOverviewFaqHarnessBatchParams = {
  site: WordPressSite;
  rows: OverviewRow[];
  bulkAiFaqSeedCount: number;
  deps: FaqHarnessOptimizeDeps;
  harnessSetters: FaqHarnessSetters;
  updateRow: (index: number, patch: Partial<OverviewRow>) => void;
  concurrency?: number;
  rowIndices?: number[];
};

export async function runOverviewFaqHarnessBatch(
  params: RunOverviewFaqHarnessBatchParams,
): Promise<{ ok: number; failed: number }> {
  const {
    site,
    rows,
    bulkAiFaqSeedCount,
    deps,
    harnessSetters,
    updateRow,
    concurrency = 4,
    rowIndices,
  } = params;

  const eligible = (rowIndices ?? rows.map((_, index) => index))
    .map((index) => ({ row: rows[index], index }))
    .filter((entry): entry is { row: OverviewRow; index: number } =>
      Boolean(entry.row?.url?.trim()),
    );

  if (!eligible.length) {
    return { ok: 0, failed: 0 };
  }

  const pageRanges = overviewBulkPageRanges(eligible.length);
  let ok = 0;
  let failed = 0;

  for (const { start, end, page, pageCount } of pageRanges) {
    const pageEligible = eligible.slice(start, end);
    setOverviewBulkHarnessPageState({
      batchKey: harnessSetters.batchKey,
      siteId: harnessSetters.siteId,
      page,
      pageCount,
      start,
      end,
      total: eligible.length,
      setBulkOptimizationState: harnessSetters.setBulkOptimizationState,
      setOptimizationProgress: harnessSetters.setOptimizationProgress,
      step: "AI FAQs",
    });

    const limit = pLimit(Math.max(1, Math.min(concurrency, pageEligible.length)));

    await Promise.all(
      pageEligible.map(({ row, index }) =>
        limit(async () => {
          const url = row.url.trim();
          try {
            updateRow(index, { status: "ai-faq" });
            harnessSetters.setBulkOptimizationState((prev) => {
              const current = prev[harnessSetters.batchKey];
              if (!current) return prev;
              return {
                ...prev,
                [harnessSetters.batchKey]: {
                  ...current,
                  urlStatuses: { ...(current.urlStatuses || {}), [url]: "optimizing" },
                  currentUrl: url,
                },
              };
            });

            const success = await runFaqPairsForRow({
              row,
              rowIndex: index,
              bulkAiFaqSeedCount,
              deps,
              harnessSetters,
              updateRow,
              skipLoadingState: true,
            });
            if (success) ok += 1;
            else failed += 1;
          } catch (err) {
            failed += 1;
            markFaqRowError(
              url,
              index,
              harnessSetters,
              updateRow,
              err instanceof Error ? err.message : "FAQ optimization failed",
            );
          }
        }),
      ),
    );
  }

  if (ok > 0) {
    notify.success(notifyAiFaqOptimizationFinishedForXPage(ok));
  }
  if (failed > 0 && ok === 0) {
    notify.error(NOTIFY_FAQ_OPTIMIZATION_FAILED_FOR_ALL_SELECTED);
  }

  return { ok, failed };
}
