import { useCallback } from "react";
import { notify } from "@/lib/app-notifications";
import {
  NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN,
  notifyFocusKeywordsDerivedForXRowS,
  notifyKeywordDerivationFailedForXRowS,
  notifyKeywordsFinishedXUpdatedXFailed,
} from "@/lib/notify-messages";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewTabBase } from "@/hooks/overview/use-overview-tab-base";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import { overviewBulkRowIndices, overviewRowInBulkScope } from "@/lib/overview/overview-bulk-row-scope";
import {
  isOverviewKeywordRunKind,
  keywordHarnessModeForSource,
  writeOverviewKeywordsOneAtATime,
} from "@/lib/overview/overview-keywords-harness-run";
import { initBulkSliceWithStatus } from "@/lib/overview/overview-bulk-inline-status";
import type { useWordPressOptimization } from "@/contexts/wordpress-optimization-context";

type Opt = ReturnType<typeof useWordPressOptimization>;

type Args = Pick<
  OverviewTabBase,
  | "rowsRef"
  | "updateRow"
  | "setBulkActionProgress"
  | "deriveFocusKeywordFromPageContext"
  | "deriveEntityKeyword"
> & {
  site: WordPressSite | undefined;
  sitemapSource: OverviewSitemapSource;
  bulkScopeUrlKeys: Set<string>;
  opt: Pick<Opt, "setIsOptimizingContent" | "setBulkOptimizationState">;
};

function clearStaleKeywordHarness(
  opt: Pick<Opt, "setIsOptimizingContent" | "setBulkOptimizationState">,
  siteId: string,
): void {
  const batchKey = `${siteId}-batch`;
  opt.setIsOptimizingContent((prev) => {
    if (!prev[batchKey]) return prev;
    const next = { ...prev };
    delete next[batchKey];
    return next;
  });
  opt.setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    if (!current || !isOverviewKeywordRunKind(current.runKind)) return prev;
    const next = { ...prev };
    delete next[batchKey];
    return next;
  });
}

export function useOverviewTabKeywordsHarness({
  site,
  sitemapSource,
  rowsRef,
  updateRow,
  setBulkActionProgress,
  deriveFocusKeywordFromPageContext,
  deriveEntityKeyword,
  bulkScopeUrlKeys,
  opt,
}: Args) {
  const keywordMode = keywordHarnessModeForSource(sitemapSource);
  const progressKey = keywordMode === "entity" ? "entityKw" : "contentKw";

  const deriveKeyword = useCallback(
    async (_index: number, row: OverviewRow): Promise<string | null> => {
      if (keywordMode === "entity") {
        return deriveEntityKeyword(row.url, row.title, row.metaDescription, {
          skipLoadingState: true,
        });
      }
      return deriveFocusKeywordFromPageContext(
        row.url,
        row.title,
        row.metaDescription,
        row.faq,
        undefined,
        { skipLoadingState: true },
      );
    },
    [keywordMode, deriveEntityKeyword, deriveFocusKeywordFromPageContext],
  );

  const runKeywordsForIndices = useCallback(
    async (indices: number[]) => {
      if (!site) {
        notify.error(NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN);
        return;
      }

      const scoped = indices.filter((index) =>
        overviewRowInBulkScope(rowsRef.current[index]?.url ?? "", bulkScopeUrlKeys),
      );
      if (!scoped.length) return;
      clearStaleKeywordHarness(opt, site.id);

      const total = scoped.length;
      setBulkActionProgress((p) => ({
        ...p,
        [progressKey]: initBulkSliceWithStatus(progressKey, total, 0),
      }));

      let stats = { ok: 0, failed: 0 };
      try {
        stats = await writeOverviewKeywordsOneAtATime({
          indices: scoped,
          rowsRef,
          deriveKeyword,
          updateRow,
          onRowDone: (done, rowTotal) => {
            setBulkActionProgress((p) => ({
              ...p,
              [progressKey]: initBulkSliceWithStatus(progressKey, rowTotal, done),
            }));
          },
        });
      } finally {
        setBulkActionProgress((p) => {
          const next = { ...p };
          delete next[progressKey];
          return next;
        });
      }

      if (stats.ok > 0 && stats.failed === 0) {
        notify.success(notifyFocusKeywordsDerivedForXRowS(stats.ok));
      } else if (stats.ok > 0 && stats.failed > 0) {
        notify.warning(notifyKeywordsFinishedXUpdatedXFailed(stats.ok, stats.failed));
      } else if (stats.failed > 0) {
        notify.error(notifyKeywordDerivationFailedForXRowS(stats.failed));
      }
    },
    [
      site,
      keywordMode,
      progressKey,
      rowsRef,
      bulkScopeUrlKeys,
      deriveKeyword,
      updateRow,
      setBulkActionProgress,
      opt,
    ],
  );

  const handleKeywordsAll = useCallback(async () => {
    const indices = overviewBulkRowIndices(rowsRef.current, bulkScopeUrlKeys);
    await runKeywordsForIndices(indices);
  }, [rowsRef, bulkScopeUrlKeys, runKeywordsForIndices]);

  const handleKeywordsRow = useCallback(
    async (index: number) => {
      await runKeywordsForIndices([index]);
    },
    [runKeywordsForIndices],
  );

  return { handleKeywordsAll, handleKeywordsRow, keywordMode };
}
