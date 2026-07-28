import { useCallback } from "react";
import { flushSync } from "react-dom";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import type { OverviewTabBase } from "@/hooks/overview/use-overview-tab-base";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import {
  overviewBulkRowIndices,
  overviewRowInBulkScope,
} from "@/lib/overview/overview-bulk-row-scope";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import { fetchOverviewPageContentBatch } from "@/lib/overview/overview-page-content-batch";
import type { OverviewInventoryRow } from "@/lib/overview/overview-inventory-csv";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import { setOptimizingState } from "@/hooks/content-optimization/optimization-helpers-a";
import {
  buildContentCleanupStubCatalog,
  finalizeOverviewContentCleanupBatch,
  hydrateCleanupCatalogHtml,
  initOverviewContentCleanupBatchState,
  runOverviewContentCleanupBatch,
  type ContentCleanupSetters,
} from "@/lib/overview/overview-content-cleanup-run";

type Args = Pick<
  OverviewTabBase,
  | "rows"
  | "bindings"
  | "resolveBindings"
  | "updateRow"
  | "opt"
> & {
  site: WordPressSite | undefined;
  sitemapSource: OverviewSitemapSource;
  bulkScopeUrlKeys: Set<string>;
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
  mergeInventoryContentForSource: (
    site: WordPressSite,
    source: OverviewSitemapSource,
    contentRows: OverviewInventoryRow[],
  ) => void;
};

export function useOverviewTabContentCleanup({
  site,
  sitemapSource,
  rows,
  bindings,
  resolveBindings,
  updateRow,
  opt,
  bulkScopeUrlKeys,
  getInventoryMatchForUrl,
  mergeInventoryContentForSource,
}: Args) {
  const makeSetters = useCallback(
    (batchKey: string): ContentCleanupSetters | null => {
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

  const runCleanupForIndices = useCallback(
    async (indices: number[]) => {
      if (!site) return;

      const batchKey = `${site.id}-batch`;
      const setters = makeSetters(batchKey);
      if (!setters) return;

      const scopedIndices = indices.filter((i) =>
        overviewRowInBulkScope(rows[i]?.url ?? "", bulkScopeUrlKeys),
      );
      const stubCatalog = buildContentCleanupStubCatalog(scopedIndices, rows);
      const urls = stubCatalog.map((r) => r.url);

      flushSync(() => {
        setOptimizingState(opt.setIsOptimizingContent, batchKey, true);
        initOverviewContentCleanupBatchState({
          site,
          catalog: stubCatalog,
          setBulkOptimizationState: opt.setBulkOptimizationState,
          setOptimizationProgress: opt.setOptimizationProgress,
          setIsOptimizingContent: opt.setIsOptimizingContent,
          prepMessage: "Starting Clean Up…",
        });
      });

      try {
        const mergedBindings: Record<string, OverviewBinding | undefined> = {
          ...bindings,
          ...(await resolveBindings(urls, site, undefined, { inventoryOnly: true })),
        };

        await runOverviewContentCleanupBatch({
          catalog: stubCatalog,
          harnessSetters: setters,
          updateRow,
          preparePage: async ({ page, pageCount, pageCatalog }) => {
            setters.setBulkOptimizationState((prev) => {
              const current = prev[batchKey];
              if (!current) return prev;
              return {
                ...prev,
                [batchKey]: {
                  ...current,
                  currentStepProgress: {
                    ...(current.currentStepProgress || {}),
                    step: "Clean Up",
                    progress: 5 + Math.round(((page - 1) / Math.max(pageCount, 1)) * 10),
                    message: `Fetching content page ${page}/${pageCount}…`,
                  },
                },
              };
            });

            const pageRows = pageCatalog
              .map((c) => rows[c.index])
              .filter(Boolean) as OverviewRow[];

            const batch = await fetchOverviewPageContentBatch({
              site,
              sitemapSource,
              pageRows,
              bindings: mergedBindings,
              getInventoryMatchForUrl,
            });

            if (!batch.ok) {
              for (const entry of pageCatalog) {
                updateRow(entry.index, {
                  status: "error",
                  error: batch.error || "Page content inventory fetch failed",
                });
                setters.setBulkOptimizationState((prev) => {
                  const current = prev[batchKey];
                  if (!current) return prev;
                  return {
                    ...prev,
                    [batchKey]: {
                      ...current,
                      urlStatuses: {
                        ...(current.urlStatuses || {}),
                        [entry.url]: "error",
                      },
                    },
                  };
                });
              }
              return [];
            }

            if (batch.contentRows.length) {
              mergeInventoryContentForSource(site, sitemapSource, batch.contentRows);
            }

            for (const entry of pageCatalog) {
              const patch = batch.patches.get(normalizePageUrlKey(entry.url));
              if (patch) updateRow(entry.index, { ...patch, status: "idle" });
            }

            return hydrateCleanupCatalogHtml(
              pageCatalog,
              rows,
              site,
              getInventoryMatchForUrl,
              batch.patches,
            );
          },
        });
      } finally {
        finalizeOverviewContentCleanupBatch(
          batchKey,
          site.id,
          opt.setIsOptimizingContent,
          opt.setOptimizationProgress,
        );
      }
    },
    [
      site,
      rows,
      bindings,
      resolveBindings,
      sitemapSource,
      getInventoryMatchForUrl,
      mergeInventoryContentForSource,
      bulkScopeUrlKeys,
      updateRow,
      makeSetters,
      opt.setBulkOptimizationState,
      opt.setOptimizationProgress,
      opt.setIsOptimizingContent,
    ],
  );

  const handleContentCleanupRow = useCallback(
    async (index: number) => {
      if (!site || index < 0 || index >= rows.length) return;
      await runCleanupForIndices([index]);
    },
    [site, rows.length, runCleanupForIndices],
  );

  const handleContentCleanupAll = useCallback(async () => {
    if (!site || !rows.length) return;
    const indices = overviewBulkRowIndices(rows, bulkScopeUrlKeys);
    await runCleanupForIndices(indices);
  }, [site, rows, bulkScopeUrlKeys, runCleanupForIndices]);

  return {
    handleContentCleanupRow,
    handleContentCleanupAll,
  };
}
