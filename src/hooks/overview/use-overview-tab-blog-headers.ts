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
import { buildBlogHeadersCatalog } from "@/lib/overview/overview-blog-headers-catalog";
import type { HeadersHarnessSetters } from "@/lib/overview/overview-blog-headers-harness-mutations";
import {
  markHeadersRowError,
  setHeadersHarnessMessage,
} from "@/lib/overview/overview-blog-headers-harness-mutations";
import {
  finalizeOverviewHeadersHarnessBatch,
  initOverviewHeadersHarnessBatchState,
  runOverviewHeadersHarnessBatch,
} from "@/lib/overview/overview-blog-headers-harness-run";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import { fetchOverviewPageContentBatch } from "@/lib/overview/overview-page-content-batch";
import type { OverviewInventoryRow } from "@/lib/overview/overview-inventory-csv";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import { setOptimizingState } from "@/hooks/content-optimization/optimization-helpers-a";

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
  apiKey: string;
  selectedModel: string;
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

export function useOverviewTabBlogHeaders({
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
  mergeInventoryContentForSource,
}: Args) {
  const makeHarnessSetters = useCallback(
    (batchKey: string): HeadersHarnessSetters | null => {
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

  const runHeadersForIndices = useCallback(
    async (indices: number[]) => {
      if (!site) return;
      if (!apiKey?.trim()) return;

      const batchKey = `${site.id}-batch`;
      const harnessSetters = makeHarnessSetters(batchKey);
      if (!harnessSetters) return;

      const scopedIndices = indices.filter((i) =>
        overviewRowInBulkScope(rows[i]?.url ?? "", bulkScopeUrlKeys),
      );
      const subset = scopedIndices.map((i) => rows[i]).filter(Boolean) as OverviewRow[];
      const urls = subset.map((r) => r.url);
      const stubCatalog = scopedIndices.map((index) => {
        const row = rows[index];
        return {
          index,
          url: row.url,
          postId: 0,
          title: row.title ?? "",
          focusKeyword: row.focusKeyword ?? "",
          seoResearchBrief: "",
          existingH2s: [] as string[],
          html: "",
          sectionLabels: [] as string[],
          missingLeadingH2: false,
        };
      });

      flushSync(() => {
        setOptimizingState(opt.setIsOptimizingContent, batchKey, true);
        initOverviewHeadersHarnessBatchState({
          site,
          catalog: stubCatalog,
          setBulkOptimizationState: opt.setBulkOptimizationState,
          setOptimizationProgress: opt.setOptimizationProgress,
          setIsOptimizingContent: opt.setIsOptimizingContent,
          prepMessage: "Starting Headers batch…",
        });
        setHeadersHarnessMessage(harnessSetters, "Binding rows from inventory…", 3);
      });

      try {
        const mergedBindings: Record<string, OverviewBinding | undefined> = {
          ...bindings,
          ...(await resolveBindings(urls, site, undefined, { inventoryOnly: true })),
        };

        flushSync(() => {
          initOverviewHeadersHarnessBatchState({
            site,
            catalog: stubCatalog,
            setBulkOptimizationState: opt.setBulkOptimizationState,
            setOptimizationProgress: opt.setOptimizationProgress,
            setIsOptimizingContent: opt.setIsOptimizingContent,
            prepMessage: `Headers: page batches (${scopedIndices.length} rows)…`,
          });
        });

        await runOverviewHeadersHarnessBatch({
          catalog: stubCatalog,
          agentOptions: {
            apiKey,
            model: selectedModel || "google/gemini-2.5-flash",
            siteId: site.id,
            siteUrl: site.siteUrl,
          },
          harnessSetters,
          updateRow,
          preparePage: async ({ page, pageCount, pageCatalog }) => {
            setHeadersHarnessMessage(
              harnessSetters,
              `Fetching content page ${page}/${pageCount}…`,
              5 + Math.round(((page - 1) / Math.max(pageCount, 1)) * 10),
            );

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
                markHeadersRowError(
                  entry.url,
                  entry.index,
                  harnessSetters,
                  updateRow,
                  batch.error || "Page content inventory fetch failed",
                );
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

            setHeadersHarnessMessage(
              harnessSetters,
              `Headers page ${page}/${pageCount}: building catalog…`,
              8 + Math.round(((page - 1) / Math.max(pageCount, 1)) * 10),
            );

            const pageIndexSet = new Set(pageCatalog.map((c) => c.index));
            const { catalog } = buildBlogHeadersCatalog(
              rows,
              mergedBindings,
              getInventoryMatchForUrl,
              site,
              sitemapSource,
            );
            const eligible = catalog.filter((c) => pageIndexSet.has(c.index));
            const eligibleUrls = new Set(eligible.map((c) => normalizePageUrlKey(c.url)));

            for (const entry of pageCatalog) {
              if (eligibleUrls.has(normalizePageUrlKey(entry.url))) continue;
              markHeadersRowError(
                entry.url,
                entry.index,
                harnessSetters,
                updateRow,
                "No HTML body in inventory cache for this URL",
              );
            }

            setHeadersHarnessMessage(
              harnessSetters,
              `Headers page ${page}/${pageCount}: optimizing ${eligible.length} rows…`,
              12 + Math.round(((page - 1) / Math.max(pageCount, 1)) * 10),
            );

            return eligible;
          },
        });
      } finally {
        finalizeOverviewHeadersHarnessBatch(
          batchKey,
          site.id,
          opt.setIsOptimizingContent,
          opt.setOptimizationProgress,
        );
      }
    },
    [
      site,
      apiKey,
      selectedModel,
      rows,
      bindings,
      resolveBindings,
      sitemapSource,
      getInventoryMatchForUrl,
      mergeInventoryContentForSource,
      bulkScopeUrlKeys,
      updateRow,
      makeHarnessSetters,
      opt.setBulkOptimizationState,
      opt.setOptimizationProgress,
      opt.setIsOptimizingContent,
    ],
  );

  const handleAiHeadersRow = useCallback(
    async (index: number) => {
      if (!site || index < 0 || index >= rows.length) return;
      await runHeadersForIndices([index]);
    },
    [site, rows.length, runHeadersForIndices],
  );

  const handleAiHeadersAll = useCallback(async () => {
    if (!site || !rows.length) return;
    const indices = overviewBulkRowIndices(rows, bulkScopeUrlKeys);
    await runHeadersForIndices(indices);
  }, [site, rows, bulkScopeUrlKeys, runHeadersForIndices]);

  return {
    handleAiHeadersRow,
    handleAiHeadersAll,
  };
}
