import { useCallback } from "react";
import { flushSync } from "react-dom";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewTabBase } from "@/hooks/overview/use-overview-tab-base";
import {
  overviewBulkRowIndices,
  overviewRowInBulkScope,
} from "@/lib/overview/overview-bulk-row-scope";
import type { OverviewHarnessSetters } from "@/lib/overview/overview-blog-overview-harness-mutations";
import {
  finalizeOverviewBlogOverviewHarnessBatch,
  initOverviewBlogOverviewHarnessBatchState,
  runOverviewBlogOverviewHarnessBatch,
  type BlogOverviewCatalogRow,
} from "@/lib/overview/overview-blog-overview-harness-run";
import { resolveOverviewSourceHtml } from "@/lib/overview/overview-blog-overview-prepend";
import { extractH2TextsFromHtml } from "@/lib/overview/overview-blog-headers-extract";
import {
  postBodyHtmlFromInventoryRow,
  sentimentHtmlFromInventoryRow,
} from "@/lib/overview/overview-inventory-seo-fields";
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

/** Prefer bodies that have H2s Overview can cite. Never invent synthetic stubs. */
function resolveCachedOverviewHtml(
  site: WordPressSite | undefined,
  row: OverviewRow,
  getInventoryMatchForUrl: Args["getInventoryMatchForUrl"],
): string {
  const fromGrid = resolveOverviewSourceHtml(row).trim();
  if (fromGrid && htmlHasOverviewCiteH2s(fromGrid)) return fromGrid;

  const url = row.url?.trim();
  if (url && site) {
    const inv = getInventoryMatchForUrl(site, url)?.row;
    if (inv) {
      const body =
        postBodyHtmlFromInventoryRow(inv)?.trim() ||
        sentimentHtmlFromInventoryRow(inv)?.trim() ||
        "";
      if (body && htmlHasOverviewCiteH2s(body)) return body;
    }
  }

  return "";
}

function buildOverviewCatalogFromCache(
  site: WordPressSite | undefined,
  indices: number[],
  rows: OverviewRow[],
  bulkScopeUrlKeys: Set<string>,
  getInventoryMatchForUrl: Args["getInventoryMatchForUrl"],
): BlogOverviewCatalogRow[] {
  const catalog: BlogOverviewCatalogRow[] = [];
  for (const index of indices) {
    const row = rows[index];
    if (!row) continue;
    const url = row.url?.trim();
    if (!url) continue;
    if (!overviewRowInBulkScope(url, bulkScopeUrlKeys)) continue;
    const html = resolveCachedOverviewHtml(site, row, getInventoryMatchForUrl);
    if (!html) continue;
    catalog.push({
      index,
      url,
      title: row.title ?? "",
      focusKeyword: row.focusKeyword ?? "",
      html,
    });
  }
  return catalog;
}

/** After Overview succeeds, write prepended HTML into site-cache CSV content column. */
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
          prepMessage: `Loading post HTML for Overview (${scoped.length})…`,
        });
      });

      try {
        // Join in-flight includeContent fetch; do not race AIO against excerpt-only warm seed.
        await prefetchOverviewInventory(site, {
          includeContent: true,
          includePageHeading: true,
          source: sitemapSource,
          silent: true,
        });

        const catalog = buildOverviewCatalogFromCache(
          site,
          scoped,
          rows,
          bulkScopeUrlKeys,
          getInventoryMatchForUrl,
        );

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

        await resolveBindings(
          catalog.map((c) => c.url),
          site,
          undefined,
          { inventoryOnly: true },
        );

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
