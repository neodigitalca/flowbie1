import { useCallback } from "react";
import { flushSync } from "react-dom";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
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
  buildOverviewHarnessCatalogWithHtml,
  enrichHarnessCatalogWithEntities,
} from "@/lib/overview/overview-harness-page-catalog";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import { setOptimizingState } from "@/hooks/content-optimization/optimization-helpers-a";
import {
  getEntitySiteWarmCacheIfReady,
  mergeSitePrefetchBulkInventoryRows,
} from "@/lib/local-analysis/entity-site-warm-cache";
import type { SiteInventoryBulkRow } from "@/lib/wordpress-api/types";

type Args = Pick<
  OverviewTabBase,
  "rows" | "bindings" | "resolveBindings" | "updateRow" | "opt" | "prefetchOverviewInventory"
> & {
  site: WordPressSite | undefined;
  sitemapSource: OverviewSitemapSource;
  bulkScopeUrlKeys: Set<string>;
  apiKey: string;
  selectedModel: string;
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
};

function htmlHasOverviewCiteH2s(html: string): boolean {
  return extractH2TextsFromHtml(html).length > 0;
}

function mergeOverviewHtmlIntoSiteCache(
  site: WordPressSite,
  results: Array<{ url: string; html: string }>,
): void {
  const warm = getEntitySiteWarmCacheIfReady(site.id);
  const bulk = warm?.bulkInventoryRows;
  if (!bulk?.length || !results.length) return;
  const byUrl = new Map(results.map((r) => [r.url.trim().toLowerCase(), r.html]));
  let patched = 0;
  const next = bulk.map((row) => {
    const html = byUrl.get((row.url ?? "").trim().toLowerCase());
    if (!html) return row;
    patched += 1;
    return {
      ...row,
      fields: { ...row.fields, content: html },
    } as SiteInventoryBulkRow;
  });
  if (patched === 0) return;
  mergeSitePrefetchBulkInventoryRows(site, next);
}

export function useOverviewTabBlogOverview({
  site,
  sitemapSource,
  rows,
  bindings,
  resolveBindings,
  updateRow,
  opt,
  apiKey,
  selectedModel,
  bulkScopeUrlKeys,
  getInventoryMatchForUrl,
  prefetchOverviewInventory,
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

      flushSync(() => {
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
          prepMessage: `Loading page HTML for Overview (${scoped.length})…`,
        });
      });

      try {
        await prefetchOverviewInventory(site, {
          includeContent: true,
          includePageHeading: true,
          source: sitemapSource,
          silent: true,
        });

        const mergedBindings: Record<string, OverviewBinding | undefined> = {
          ...bindings,
          ...(await resolveBindings(
            scoped.map((i) => rows[i]?.url?.trim() ?? "").filter(Boolean),
            site,
            undefined,
            { inventoryOnly: true },
          )),
        };

        const { catalog: loadedCatalog } = await buildOverviewHarnessCatalogWithHtml({
          site,
          rows,
          indices: scoped,
          sitemapSource,
          bindings: mergedBindings,
          getInventoryMatchForUrl,
          bulkScopeUrlKeys,
          onProgress: (message) => {
            opt.setBulkOptimizationState((prev) => {
              const current = prev[batchKey];
              if (!current) return prev;
              return {
                ...prev,
                [batchKey]: {
                  ...current,
                  currentStepProgress: {
                    ...(current.currentStepProgress || {}),
                    step: "Overview",
                    progress: 5,
                    message,
                  },
                },
              };
            });
          },
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

        if (!catalog.length) {
          finalizeOverviewBlogOverviewHarnessBatch(
            batchKey,
            site.id,
            opt.setIsOptimizingContent,
            opt.setOptimizationProgress,
          );
          return;
        }

        flushSync(() => {
          initOverviewBlogOverviewHarnessBatchState({
            site,
            catalog,
            setBulkOptimizationState: opt.setBulkOptimizationState,
            setOptimizationProgress: opt.setOptimizationProgress,
            setIsOptimizingContent: opt.setIsOptimizingContent,
            prepMessage: `Overview (${catalog.length} rows)…`,
          });
        });

        const writtenForCsv: Array<{ url: string; html: string }> = [];
        await runOverviewBlogOverviewHarnessBatch({
          catalog,
          site,
          apiKey,
          model: selectedModel || "google/gemini-2.5-flash",
          harnessSetters,
          updateRow,
          onRowOk: (url, html) => {
            writtenForCsv.push({ url, html });
          },
        });

        if (writtenForCsv.length) {
          mergeOverviewHtmlIntoSiteCache(site, writtenForCsv);
        }
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
      bindings,
      bulkScopeUrlKeys,
      resolveBindings,
      getInventoryMatchForUrl,
      prefetchOverviewInventory,
      updateRow,
      opt,
      makeHarnessSetters,
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
