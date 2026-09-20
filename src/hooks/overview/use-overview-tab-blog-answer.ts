import { useCallback } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewTabBase } from "@/hooks/overview/use-overview-tab-base";
import { overviewBulkRowIndices, overviewRowInBulkScope } from "@/lib/overview/overview-bulk-row-scope";
import type { AnswerHarnessSetters } from "@/lib/overview/overview-blog-answer-harness-mutations";
import {
  finalizeOverviewBlogAnswerHarnessBatch,
  initOverviewBlogAnswerHarnessBatchState,
  runOverviewBlogAnswerHarnessBatch,
  type BlogAnswerCatalogRow,
} from "@/lib/overview/overview-blog-answer-harness-run";
import { buildOverviewAnswerCatalogFromCache } from "@/lib/overview/overview-harness-page-catalog";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import type { AiseoAfterRowWriteFn } from "@/lib/overview/overview-aiseo-after-upload";
import { createAiseoCacheWriteAccumulator, finalizeAiseoCacheWriteForUpload } from "@/lib/overview/overview-aiseo-cache-write";

type Args = Pick<OverviewTabBase, "rows" | "opt" | "rowsRef"> & {
  site: WordPressSite | undefined;
  sitemapSource: OverviewSitemapSource;
  bulkScopeUrlKeys: Set<string>;
  apiKey: string;
  selectedModel: string;
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
  uploadAfterRowWrite?: AiseoAfterRowWriteFn;
};

export function useOverviewTabBlogAnswer({
  site,
  sitemapSource,
  rows,
  opt,
  apiKey,
  selectedModel,
  bulkScopeUrlKeys,
  getInventoryMatchForUrl,
  rowsRef,
  uploadAfterRowWrite,
}: Args) {
  const makeHarnessSetters = useCallback(
    (batchKey: string): AnswerHarnessSetters | null => {
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

  const runAnswerForIndices = useCallback(
    async (indices: number[]) => {
      if (!site) return;
      if (!apiKey?.trim()) return;

      const batchKey = `${site.id}-batch`;
      const harnessSetters = makeHarnessSetters(batchKey);
      if (!harnessSetters) return;

      const scoped = indices.filter((i) =>
        overviewRowInBulkScope(rows[i]?.url ?? "", bulkScopeUrlKeys),
      );
      if (!scoped.length) return;

      const bootstrapCatalog = scoped.map((index) => {
        const row = rows[index]!;
        return {
          index,
          url: row.url?.trim() ?? "",
          title: (row.title || "").trim(),
          focusKeyword: (row.focusKeyword || "").trim(),
          html: "",
          pageKind: (sitemapSource === "sap" ? "entity" : "post") as "post" | "entity",
        };
      }).filter((entry) => entry.url);

      initOverviewBlogAnswerHarnessBatchState({
        site,
        catalog: bootstrapCatalog,
        setBulkOptimizationState: opt.setBulkOptimizationState,
        setOptimizationProgress: opt.setOptimizationProgress,
        setIsOptimizingContent: opt.setIsOptimizingContent,
        prepMessage: `Answer (${bootstrapCatalog.length} rows)…`,
      });

      const catalog: BlogAnswerCatalogRow[] = buildOverviewAnswerCatalogFromCache({
        site,
        rows: rowsRef.current,
        indices: scoped,
        sitemapSource,
        getInventoryMatchForUrl,
        bulkScopeUrlKeys,
      });

      const cacheWrite = createAiseoCacheWriteAccumulator(site);

      try {
        if (!catalog.length) return;

        await runOverviewBlogAnswerHarnessBatch({
          catalog,
          site,
          apiKey,
          model: selectedModel || "google/gemini-2.5-flash",
          harnessSetters,
          cacheWrite,
          uploadAfterRowWrite,
        });
      } finally {
        finalizeAiseoCacheWriteForUpload(cacheWrite, rowsRef);
        finalizeOverviewBlogAnswerHarnessBatch(
          batchKey,
          site.id,
          opt.setIsOptimizingContent,
          opt.setOptimizationProgress,
        );
      }
    },
    [
      site,
      sitemapSource,
      apiKey,
      selectedModel,
      rows,
      bulkScopeUrlKeys,
      getInventoryMatchForUrl,
      opt,
      makeHarnessSetters,
      rowsRef,
      uploadAfterRowWrite,
    ],
  );

  const handleAiAnswerAll = useCallback(async () => {
    if (!site) return;
    const indices = overviewBulkRowIndices(rows, bulkScopeUrlKeys);
    await runAnswerForIndices(indices);
  }, [site, rows, bulkScopeUrlKeys, runAnswerForIndices]);

  const handleAiAnswerRow = useCallback(
    async (index: number) => {
      await runAnswerForIndices([index]);
    },
    [runAnswerForIndices],
  );

  return { handleAiAnswerAll, handleAiAnswerRow };
}
