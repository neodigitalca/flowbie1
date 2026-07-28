import { useCallback } from "react";
import { flushSync } from "react-dom";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_AI_OPTIMIZED_FAQS_FOR_THIS_ROW, NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN, NOTIFY_FAQ_OPTIMIZATION_FAILED_FOR_THIS_ROW } from "@/lib/notify-messages";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { parseFaqEntries, serializeFaqEntriesPlain } from "@/lib/faq-entries";
import type { OverviewTabBase } from "@/hooks/overview/use-overview-tab-base";
import {
  finalizeOverviewFaqHarnessBatch,
  initOverviewFaqHarnessBatchState,
  runFaqPairsForRow,
  runOverviewFaqHarnessBatch,
  type FaqHarnessOptimizeDeps,
} from "@/lib/overview/overview-faq-harness-run";
import type { FaqHarnessSetters } from "@/lib/overview/overview-faq-harness-mutations";
import { overviewBulkRowIndices, overviewRowsInBulkScope } from "@/lib/overview/overview-bulk-row-scope";

type Args = Pick<
  OverviewTabBase,
  | "rows"
  | "optimizeFaq"
  | "optimizeFaqQuestion"
  | "optimizeFaqAnswer"
  | "updateRow"
  | "getDfsSerpContext"
  | "bulkAiFaqSeedCount"
  | "opt"
> & {
  site: WordPressSite | undefined;
  bulkScopeUrlKeys: Set<string>;
};

export function useOverviewTabFaqHandlers({
  site,
  rows,
  optimizeFaq,
  optimizeFaqQuestion,
  optimizeFaqAnswer,
  updateRow,
  getDfsSerpContext,
  bulkAiFaqSeedCount,
  opt,
  bulkScopeUrlKeys,
}: Args) {
  const faqDeps: FaqHarnessOptimizeDeps = {
    optimizeFaq,
    optimizeFaqQuestion,
    optimizeFaqAnswer,
    getDfsSerpContext,
  };

  const makeHarnessSetters = useCallback(
    (batchKey: string): FaqHarnessSetters | null => {
      if (!site) return null;
      return {
        siteId: site.id,
        batchKey,
        setBulkOptimizationState: opt.setBulkOptimizationState,
        setOptimizationProgress: opt.setOptimizationProgress,
      };
    },
    [site, opt.setBulkOptimizationState, opt.setOptimizationProgress],
  );

  const handleAiFaqQuestion = useCallback(
    async (rowIndex: number, faqIndex: number) => {
      const row = rows[rowIndex];
      if (!row) return;
      const currentEntries = parseFaqEntries(row.faq);
      const entry = currentEntries[faqIndex];
      if (!entry) return;
      updateRow(rowIndex, { status: "ai-faq" });
      const brief = row.seoResearch?.trim();
      const dfsContext = brief ? undefined : await getDfsSerpContext(row);
      const improved = await optimizeFaqQuestion(
        row.url,
        row.focusKeyword,
        entry.question,
        row.faq,
        dfsContext,
        row.title,
        row.metaDescription,
        brief || undefined,
      );
      if (!improved) {
        updateRow(rowIndex, { status: "error" });
        return;
      }
      const next = [...currentEntries];
      next[faqIndex] = { ...entry, question: improved };
      updateRow(rowIndex, { faq: serializeFaqEntriesPlain(next), status: "idle" });
    },
    [rows, optimizeFaqQuestion, updateRow, getDfsSerpContext],
  );

  const handleAiFaqAnswer = useCallback(
    async (rowIndex: number, faqIndex: number) => {
      const row = rows[rowIndex];
      if (!row) return;
      const currentEntries = parseFaqEntries(row.faq);
      const entry = currentEntries[faqIndex];
      if (!entry) return;
      updateRow(rowIndex, { status: "ai-faq" });
      const brief = row.seoResearch?.trim();
      const dfsContext = brief ? undefined : await getDfsSerpContext(row);
      const improved = await optimizeFaqAnswer(
        row.url,
        row.focusKeyword,
        entry.question,
        entry.answer,
        row.faq,
        dfsContext,
        row.title,
        row.metaDescription,
        brief || undefined,
      );
      if (!improved) {
        updateRow(rowIndex, { status: "error" });
        return;
      }
      const next = [...currentEntries];
      next[faqIndex] = { ...entry, answer: improved };
      updateRow(rowIndex, { faq: serializeFaqEntriesPlain(next), status: "idle" });
    },
    [rows, optimizeFaqAnswer, updateRow, getDfsSerpContext],
  );

  const handleAiFaqRowAll = useCallback(
    async (
      rowIndex: number,
      rowOverride?: OverviewRow,
      options?: {
        silentToast?: boolean;
        skipFaqLoading?: boolean;
        onMicroStep?: () => void;
        seedQuestionCount?: number;
      },
    ) => {
      if (!site) {
        notify.error(NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN);
        return;
      }

      const row = rowOverride ?? rows[rowIndex];
      if (!row?.url?.trim()) return;

      const batchKey = `${site.id}-batch`;
      const harnessSetters = makeHarnessSetters(batchKey);
      if (!harnessSetters) return;

      const useHarness = !options?.onMicroStep;

      if (useHarness) {
        flushSync(() => {
          initOverviewFaqHarnessBatchState({
            site,
            rows: [row],
            bulkAiFaqSeedCount: options?.seedQuestionCount ?? bulkAiFaqSeedCount,
            setBulkOptimizationState: opt.setBulkOptimizationState,
            setOptimizationProgress: opt.setOptimizationProgress,
            setIsOptimizingContent: opt.setIsOptimizingContent,
            prepMessage: "Preparing FAQ batch…",
          });
        });
      }

      try {
        const success = await runFaqPairsForRow({
          row,
          rowIndex,
          bulkAiFaqSeedCount: options?.seedQuestionCount ?? bulkAiFaqSeedCount,
          deps: faqDeps,
          harnessSetters,
          updateRow,
          skipLoadingState: options?.skipFaqLoading ?? true,
        });

        if (!success && !options?.silentToast) {
          notify.error(NOTIFY_FAQ_OPTIMIZATION_FAILED_FOR_THIS_ROW);
          return;
        }

        if (!options?.silentToast && success) {
          notify.success(NOTIFY_AI_OPTIMIZED_FAQS_FOR_THIS_ROW);
        }
      } finally {
        if (useHarness) {
          finalizeOverviewFaqHarnessBatch(
            batchKey,
            site.id,
            opt.setIsOptimizingContent,
            opt.setOptimizationProgress,
          );
        }
      }
    },
    [
      site,
      rows,
      bulkAiFaqSeedCount,
      makeHarnessSetters,
      opt.setBulkOptimizationState,
      opt.setOptimizationProgress,
      opt.setIsOptimizingContent,
      updateRow,
      faqDeps,
    ],
  );

  const handleAiFaqAll = useCallback(async () => {
    if (!site) {
      notify.error(NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN);
      return;
    }
    const scopedRows = overviewRowsInBulkScope(rows, bulkScopeUrlKeys);
    const rowIndices = overviewBulkRowIndices(rows, bulkScopeUrlKeys);
    if (!scopedRows.length) return;

    const batchKey = `${site.id}-batch`;
    const harnessSetters = makeHarnessSetters(batchKey);
    if (!harnessSetters) return;

    flushSync(() => {
      initOverviewFaqHarnessBatchState({
        site,
        rows: scopedRows,
        bulkAiFaqSeedCount,
        setBulkOptimizationState: opt.setBulkOptimizationState,
        setOptimizationProgress: opt.setOptimizationProgress,
        setIsOptimizingContent: opt.setIsOptimizingContent,
        prepMessage: "Preparing FAQ batch…",
      });
    });

    try {
      await runOverviewFaqHarnessBatch({
        site,
        rows,
        rowIndices,
        bulkAiFaqSeedCount,
        deps: faqDeps,
        harnessSetters,
        updateRow,
      });
    } finally {
      finalizeOverviewFaqHarnessBatch(
        batchKey,
        site.id,
        opt.setIsOptimizingContent,
        opt.setOptimizationProgress,
      );
    }
  }, [
    site,
    rows,
    bulkScopeUrlKeys,
    bulkAiFaqSeedCount,
    makeHarnessSetters,
    opt.setBulkOptimizationState,
    opt.setOptimizationProgress,
    opt.setIsOptimizingContent,
    updateRow,
    faqDeps,
  ]);

  return {
    handleAiFaqQuestion,
    handleAiFaqAnswer,
    handleAiFaqRowAll,
    handleAiFaqAll,
  };
}
