import { useCallback, useRef } from "react";
import { notify } from "@/lib/app-notifications";
import {
  NOTIFY_BAD_URL,
  NOTIFY_FINISHED_FOCUS_KEYWORD_URL_PATHS,
} from "@/lib/notify-messages";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewTabBase } from "@/hooks/overview/use-overview-tab-base";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import type { AiseoAfterRowWriteFn } from "@/lib/overview/overview-aiseo-after-upload";
import {
  downloadOverviewRedirectCsv,
  type OverviewRedirectRow,
} from "@/lib/overview/overview-redirect-row";
import {
  overviewBulkRowIndices,
  overviewRowInBulkScope,
} from "@/lib/overview/overview-bulk-row-scope";
import {
  finalizeOverviewAiUrlHarnessBatch,
  initOverviewAiUrlHarnessBatchState,
  runOverviewAiUrlHarnessBatch,
  type AiUrlCatalogRow,
} from "@/lib/overview/overview-ai-url-harness-run";
import type { UrlHarnessSetters } from "@/lib/overview/overview-ai-url-harness-mutations";

type Args = Pick<OverviewTabBase, "rows" | "rowsRef" | "opt" | "updateRow"> & {
  site: WordPressSite | undefined;
  sitemapSource: OverviewSitemapSource;
  bulkScopeUrlKeys: Set<string>;
  uploadAfterRowWrite?: AiseoAfterRowWriteFn;
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
};

function buildUrlCatalog(rows: OverviewRow[], indices: number[]): AiUrlCatalogRow[] {
  return indices
    .map((index) => {
      const row = rows[index];
      if (!row?.url?.trim()) return null;
      return {
        index,
        url: row.url.trim(),
        label: (row.title || row.focusKeyword || row.url).trim(),
      };
    })
    .filter((entry): entry is AiUrlCatalogRow => entry != null);
}

export function useOverviewTabAiUrlHarness({
  site,
  sitemapSource,
  rows,
  rowsRef,
  opt,
  updateRow,
  bulkScopeUrlKeys,
  uploadAfterRowWrite,
  getInventoryMatchForUrl,
}: Args) {
  const redirectRowsRef = useRef<OverviewRedirectRow[]>([]);

  const makeHarnessSetters = useCallback(
    (batchKey: string): UrlHarnessSetters | null => {
      if (!site?.id) return null;
      return {
        siteId: site.id,
        batchKey,
        setBulkOptimizationState: opt.setBulkOptimizationState,
        setOptimizationProgress: opt.setOptimizationProgress,
      };
    },
    [site?.id, opt.setBulkOptimizationState, opt.setOptimizationProgress],
  );

  const runUrlForIndices = useCallback(
    async (indices: number[]) => {
      if (!site) return;

      const scoped = indices.filter((index) =>
        overviewRowInBulkScope(rowsRef.current[index]?.url ?? "", bulkScopeUrlKeys),
      );
      if (!scoped.length) return;

      const catalog = buildUrlCatalog(rowsRef.current, scoped);
      if (!catalog.length) return;

      redirectRowsRef.current = [];
      const batchKey = `${site.id}-batch`;
      const harnessSetters = makeHarnessSetters(batchKey);
      if (!harnessSetters) return;

      initOverviewAiUrlHarnessBatchState({
        site,
        catalog,
        setBulkOptimizationState: opt.setBulkOptimizationState,
        setOptimizationProgress: opt.setOptimizationProgress,
        setIsOptimizingContent: opt.setIsOptimizingContent,
        prepMessage: `AI URL paths (${catalog.length} rows)…`,
      });

      try {
        await runOverviewAiUrlHarnessBatch({
          site,
          sitemapSource,
          rowsRef,
          catalog,
          harnessSetters,
          getInventoryMatchForUrl,
          updateRow,
          uploadAfterRowWrite,
          onRedirectRow: (redirect) => {
            redirectRowsRef.current.push(redirect);
          },
        });
      } finally {
        finalizeOverviewAiUrlHarnessBatch(
          batchKey,
          site.id,
          opt.setIsOptimizingContent,
          opt.setOptimizationProgress,
        );
      }

      const redirectRows = redirectRowsRef.current;
      if (redirectRows.length > 0) {
        downloadOverviewRedirectCsv(
          redirectRows,
          `overview-url-opt-redirects-${new Date().toISOString().slice(0, 10)}.csv`,
        );
      }
      notify.success(NOTIFY_FINISHED_FOCUS_KEYWORD_URL_PATHS);
    },
    [
      site,
      sitemapSource,
      rowsRef,
      bulkScopeUrlKeys,
      makeHarnessSetters,
      opt,
      getInventoryMatchForUrl,
      updateRow,
      uploadAfterRowWrite,
    ],
  );

  const handleAiUrlAll = useCallback(async () => {
    const indices = overviewBulkRowIndices(rows, bulkScopeUrlKeys);
    await runUrlForIndices(indices);
  }, [rows, bulkScopeUrlKeys, runUrlForIndices]);

  const handleAiUrlRow = useCallback(
    async (index: number) => {
      const row = rowsRef.current[index];
      if (!row) return;
      if (!row.url?.trim()) {
        notify.error(NOTIFY_BAD_URL);
        return;
      }
      await runUrlForIndices([index]);
    },
    [rowsRef, runUrlForIndices],
  );

  return { handleAiUrlAll, handleAiUrlRow };
}
