import { useCallback } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewTabBase } from "@/hooks/overview/use-overview-tab-base";
import { overviewBulkRowIndices, overviewRowInBulkScope } from "@/lib/overview/overview-bulk-row-scope";
import type { OverviewHarnessSetters } from "@/lib/overview/overview-blog-overview-harness-mutations";
import {
  finalizeOverviewBlogOverviewHarnessBatch,
  initOverviewBlogOverviewHarnessBatchState,
  runOverviewBlogOverviewHarnessBatch,
  type BlogOverviewCatalogRow,
} from "@/lib/overview/overview-blog-overview-harness-run";
import { extractH2TextsFromHtml } from "@/lib/overview/overview-blog-headers-extract";
import {
  buildOverviewAnswerCatalogFromCache,
  enrichHarnessCatalogWithEntities,
} from "@/lib/overview/overview-harness-page-catalog";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import { setOptimizingState } from "@/hooks/content-optimization/optimization-helpers-a";
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

function htmlHasOverviewCiteH2s(html: string): boolean {
  return extractH2TextsFromHtml(html).length > 0;
}

export function useOverviewTabBlogOverview({
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
    (batchKey: string): OverviewHarnessSetters | null => {
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

  const runOverviewForIndices = useCallback(
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

      const cacheWrite = createAiseoCacheWriteAccumulator(site);

      setOptimizingState(opt.setIsOptimizingContent, batchKey, true);
      initOverviewBlogOverviewHarnessBatchState({
        site,
        catalog: scoped.map((index) => {
          const row = rows[index]!;
          return {
            index,
            url: row.url!.trim(),
            title: row.title ?? "",
            focusKeyword: row.focusKeyword ?? "",
            html: "",
          };
        }),
        setBulkOptimizationState: opt.setBulkOptimizationState,
        setOptimizationProgress: opt.setOptimizationProgress,
        setIsOptimizingContent: opt.setIsOptimizingContent,
        prepMessage: `Overview from cache (${scoped.length})…`,
      });

      try {
        const loadedCatalog = buildOverviewAnswerCatalogFromCache({
          site,
          rows,
          indices: scoped,
          sitemapSource,
          getInventoryMatchForUrl,
          bulkScopeUrlKeys,
        });

        const enriched = await enrichHarnessCatalogWithEntities({
          catalog: loadedCatalog,
          rows,
          site,
          sitemapSource,
          apiKey,
          setBulkOptimizationState: opt.setBulkOptimizationState,
          batchKey,
        });

        const catalog: BlogOverviewCatalogRow[] = enriched
          .filter((entry) => htmlHasOverviewCiteH2s(entry.html))
          .map((entry) => ({
            index: entry.index,
            url: entry.url,
            title: entry.title,
            focusKeyword: entry.focusKeyword,
            html: entry.html,
            entity: entry.entity,
            pageKind: entry.pageKind,
            seoResearchBrief: entry.seoResearchBrief,
          }));

        if (!catalog.length) return;

        initOverviewBlogOverviewHarnessBatchState({
          site,
          catalog,
          setBulkOptimizationState: opt.setBulkOptimizationState,
          setOptimizationProgress: opt.setOptimizationProgress,
          setIsOptimizingContent: opt.setIsOptimizingContent,
          prepMessage: `Overview (${catalog.length} rows)…`,
        });

        await runOverviewBlogOverviewHarnessBatch({
          catalog,
          site,
          apiKey,
          model: selectedModel || "google/gemini-2.5-flash",
          harnessSetters,
          cacheWrite,
          uploadAfterRowWrite,
        });

        finalizeAiseoCacheWriteForUpload(cacheWrite, rowsRef);
      } finally {
        finalizeOverviewBlogOverviewHarnessBatch(
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

  const handleAiOverviewAll = useCallback(async () => {
    if (!site) return;
    const indices = overviewBulkRowIndices(rows, bulkScopeUrlKeys);
    await runOverviewForIndices(indices);
  }, [site, rows, bulkScopeUrlKeys, runOverviewForIndices]);

  const handleAiOverviewRow = useCallback(
    async (index: number) => {
      await runOverviewForIndices([index]);
    },
    [runOverviewForIndices],
  );

  return { handleAiOverviewAll, handleAiOverviewRow };
}
