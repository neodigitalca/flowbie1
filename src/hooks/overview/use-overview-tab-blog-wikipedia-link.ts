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
import { setOptimizingState } from "@/hooks/content-optimization/optimization-helpers-a";
import {
  buildWikipediaLinkCatalog,
  buildWikipediaLinkStubCatalog,
  finalizeOverviewWikipediaLinkHarnessBatch,
  initOverviewWikipediaLinkHarnessBatchState,
  mergeWikipediaLinkCatalogHtml,
  runOverviewWikipediaLinkHarnessBatch,
  runWikipediaLinkForCatalogRow,
  type WikipediaLinkHarnessSetters,
} from "@/lib/overview/overview-blog-wikipedia-link-harness-run";
import {
  fetchOverviewPageContentBatch,
  sliceOverviewRowsByPage,
} from "@/lib/overview/overview-page-content-batch";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import { getWordPressPostContent } from "@/lib/wordpress-api/posts";

async function fetchRowHtmlByIndex(
  site: WordPressSite,
  indices: number[],
  rows: OverviewRow[],
  bindings: Record<string, OverviewBinding | undefined>,
  getInventoryMatchForUrl?: (
    site: WordPressSite | null,
    url: string,
  ) => import("@/lib/overview/overview-row-scrape").OverviewInventoryUrlMatch | undefined,
): Promise<Record<number, string>> {
  if (!site.username?.trim() || !site.appPassword?.trim()) return {};

  const idToIndices = new Map<number, number[]>();

  for (const index of indices) {
    const row = rows[index];
    const url = row?.url?.trim();
    if (!url) continue;
    if (row.postContentOptimized?.trim() || row.postContent?.trim()) continue;
    let postId = bindings[url]?.postId;
    if (!postId && getInventoryMatchForUrl) {
      postId = getInventoryMatchForUrl(site, url)?.row?.id;
    }
    if (!postId) continue;
    const list = idToIndices.get(postId) ?? [];
    list.push(index);
    idToIndices.set(postId, list);
  }

  const postIds = [...idToIndices.keys()];
  if (!postIds.length) return {};

  const result = await getWordPressPostContent(
    site.siteUrl,
    site.username,
    site.appPassword,
    postIds,
  );

  const out: Record<number, string> = {};
  for (const post of result.posts ?? []) {
    const content = post.content?.trim();
    if (!content) continue;
    for (const index of idToIndices.get(post.id) ?? []) {
      out[index] = content;
    }
  }
  return out;
}

function applyLocalRowPatch(
  localRows: OverviewRow[],
  index: number,
  patch: Partial<OverviewRow>,
  updateRow: (index: number, patch: Partial<OverviewRow>) => void,
): void {
  const current = localRows[index];
  if (!current) return;
  localRows[index] = { ...current, ...patch };
  updateRow(index, patch);
}

type Args = Pick<
  OverviewTabBase,
  | "rows"
  | "bindings"
  | "resolveBindings"
  | "updateRow"
  | "opt"
  | "prefetchOverviewInventory"
  | "mergeInventoryContentForSource"
> & {
  site: WordPressSite | undefined;
  sitemapSource: OverviewSitemapSource;
  bulkScopeUrlKeys: Set<string>;
  apiKey: string;
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => import("@/lib/overview/overview-row-scrape").OverviewInventoryUrlMatch | undefined;
};

export function useOverviewTabBlogWikipediaLink(args: Args) {
  const {
    site,
    sitemapSource,
    rows,
    bindings,
    resolveBindings,
    updateRow,
    opt,
    bulkScopeUrlKeys,
    apiKey,
    getInventoryMatchForUrl,
    prefetchOverviewInventory,
    mergeInventoryContentForSource,
  } = args;

  const makeHarnessSetters = useCallback(
    (batchKey: string): WikipediaLinkHarnessSetters | null => {
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

  const markBatchUrlsError = useCallback(
    (batchKey: string, urls: string[]) => {
      if (!urls.length) return;
      opt.setBulkOptimizationState((prev) => {
        const current = prev[batchKey];
        if (!current) return prev;
        const urlStatuses = { ...(current.urlStatuses || {}) };
        for (const url of urls) {
          urlStatuses[url] = "error";
        }
        return {
          ...prev,
          [batchKey]: {
            ...current,
            urlStatuses,
          },
        };
      });
    },
    [opt.setBulkOptimizationState],
  );

  const runSingleWikipediaLinkRow = useCallback(
    async (index: number) => {
      if (!site || index < 0 || index >= rows.length) return;
      const row = rows[index];
      const url = row?.url?.trim();
      if (!url) return;

      const pageTitle = row.title || url;

      flushSync(() => {
        updateRow(index, {
          status: "ai-wikipedia-link",
          blogWikiLinkSummary: "Wikipedia link…",
        });
      });

      if (!site.username?.trim() || !site.appPassword?.trim()) {
        updateRow(index, {
          status: "error",
          blogWikiLinkSummary: `${pageTitle}: WordPress credentials required`,
        });
        return;
      }

      const localRows = [...rows];

      try {
        const mergedBindings: Record<string, OverviewBinding | undefined> = {
          ...bindings,
          ...(await resolveBindings([url], site, undefined, { inventoryOnly: true })),
        };

        const rowHtmlByIndex = await fetchRowHtmlByIndex(
          site,
          [index],
          localRows,
          mergedBindings,
          getInventoryMatchForUrl,
        );
        if (rowHtmlByIndex[index]) {
          applyLocalRowPatch(localRows, index, { postContent: rowHtmlByIndex[index] }, updateRow);
        }

        const withHtml = buildWikipediaLinkCatalog(
          localRows,
          [index],
          mergedBindings,
          site,
          sitemapSource,
          getInventoryMatchForUrl,
          rowHtmlByIndex,
        );
        const stub = buildWikipediaLinkStubCatalog(localRows, [index]);
        const [entry] = mergeWikipediaLinkCatalogHtml(stub, withHtml);
        if (!entry) {
          updateRow(index, {
            status: "error",
            blogWikiLinkSummary: `${pageTitle}: row unavailable`,
          });
          return;
        }

        const outcome = await runWikipediaLinkForCatalogRow({
          entry,
          overviewRow: localRows[index]!,
          site,
          sitemapSource,
          apiKey,
        });

        if (outcome.kind === "skipped") {
          updateRow(index, {
            status: "idle",
            blogWikiLinkSummary: outcome.summary,
          });
          return;
        }

        updateRow(index, {
          ...outcome.patch,
          status: "idle",
        });
      } catch {
        updateRow(index, {
          status: "error",
          blogWikiLinkSummary: `${pageTitle}: Wikipedia link error`,
        });
      }
    },
    [
      site,
      rows,
      bindings,
      resolveBindings,
      sitemapSource,
      getInventoryMatchForUrl,
      apiKey,
      updateRow,
    ],
  );

  const runBulkWikipediaLinkForIndices = useCallback(
    async (scopedIndices: number[]) => {
      if (!site || !scopedIndices.length) return;

      const batchKey = `${site.id}-batch`;
      const harnessSetters = makeHarnessSetters(batchKey);
      if (!harnessSetters) return;

      const localRows = [...rows];
      const stubCatalog = buildWikipediaLinkStubCatalog(localRows, scopedIndices);
      if (!stubCatalog.length) {
        opt.setBulkOptimizationState((prev) => ({
          ...prev,
          [batchKey]: {
            urls: [],
            currentIndex: 0,
            urlStatuses: {},
            currentStep: "Wikipedia link",
            currentUrl: "",
            urlKeywords: {},
            runKind: "aiWikipediaLink",
            urlHarnessSections: {},
            urlGeneratedFiles: {},
            currentStepProgress: {
              step: "Wikipedia link",
              progress: 0,
              message: "No rows in scope",
            },
          },
        }));
        return;
      }

      flushSync(() => {
        setOptimizingState(opt.setIsOptimizingContent, batchKey, true);
        initOverviewWikipediaLinkHarnessBatchState({
          site,
          catalog: stubCatalog,
          setBulkOptimizationState: opt.setBulkOptimizationState,
          setOptimizationProgress: opt.setOptimizationProgress,
          setIsOptimizingContent: opt.setIsOptimizingContent,
          prepMessage: `Loading post HTML for Wikipedia link (${stubCatalog.length})…`,
        });
      });

      try {
        if (!site.username?.trim() || !site.appPassword?.trim()) {
          opt.setBulkOptimizationState((prev) => {
            const current = prev[batchKey];
            if (!current) return prev;
            return {
              ...prev,
              [batchKey]: {
                ...current,
                currentStepProgress: {
                  ...(current.currentStepProgress || {}),
                  step: "Wikipedia link",
                  progress: 0,
                  message: "WordPress credentials required",
                },
              },
            };
          });
          return;
        }

        await prefetchOverviewInventory(site, {
          includeContent: true,
          source: sitemapSource,
          silent: true,
        });

        const subset = scopedIndices.map((i) => localRows[i]).filter(Boolean) as OverviewRow[];
        const urls = subset.map((r) => r.url);
        const mergedBindings: Record<string, OverviewBinding | undefined> = {
          ...bindings,
          ...(await resolveBindings(urls, site, undefined, { inventoryOnly: true })),
        };

        let rowHtmlByIndex: Record<number, string> = {};

        for (const pageRows of sliceOverviewRowsByPage(subset)) {
          const batch = await fetchOverviewPageContentBatch({
            site,
            sitemapSource,
            pageRows,
            bindings: mergedBindings,
            getInventoryMatchForUrl,
          });
          if (!batch.ok) {
            markBatchUrlsError(
              batchKey,
              pageRows.map((r) => r.url.trim()).filter(Boolean),
            );
            continue;
          }
          if (batch.contentRows.length) {
            mergeInventoryContentForSource(site, sitemapSource, batch.contentRows);
          }
          for (const pageRow of pageRows) {
            const patch = batch.patches.get(normalizePageUrlKey(pageRow.url));
            if (!patch) continue;
            const index = scopedIndices.find(
              (i) =>
                normalizePageUrlKey(localRows[i]?.url ?? "") === normalizePageUrlKey(pageRow.url),
            );
            if (index != null) {
              applyLocalRowPatch(localRows, index, patch, updateRow);
            }
          }
        }

        rowHtmlByIndex = await fetchRowHtmlByIndex(
          site,
          scopedIndices,
          localRows,
          mergedBindings,
          getInventoryMatchForUrl,
        );
        for (const [indexStr, html] of Object.entries(rowHtmlByIndex)) {
          applyLocalRowPatch(localRows, Number(indexStr), { postContent: html }, updateRow);
        }

        const withHtml = buildWikipediaLinkCatalog(
          localRows,
          scopedIndices,
          mergedBindings,
          site,
          sitemapSource,
          getInventoryMatchForUrl,
          rowHtmlByIndex,
        );
        const catalog = mergeWikipediaLinkCatalogHtml(stubCatalog, withHtml);

        const batchState = opt.bulkOptimizationState[batchKey];
        const urlEntities = batchState?.urlEntities;

        await runOverviewWikipediaLinkHarnessBatch({
          catalog,
          site,
          sitemapSource,
          apiKey,
          urlEntities,
          rows: localRows,
          harnessSetters,
          updateRow,
        });
      } finally {
        finalizeOverviewWikipediaLinkHarnessBatch(
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
      apiKey,
      updateRow,
      makeHarnessSetters,
      opt.setBulkOptimizationState,
      opt.setOptimizationProgress,
      opt.setIsOptimizingContent,
      opt.bulkOptimizationState,
      prefetchOverviewInventory,
      mergeInventoryContentForSource,
      markBatchUrlsError,
    ],
  );

  const runWikipediaLinkForIndices = useCallback(
    async (indices: number[]) => {
      if (!site || !indices.length) return;

      if (indices.length === 1) {
        await runSingleWikipediaLinkRow(indices[0]!);
        return;
      }

      const scopedIndices = indices.filter((index) =>
        overviewRowInBulkScope(rows[index]?.url ?? "", bulkScopeUrlKeys),
      );
      await runBulkWikipediaLinkForIndices(scopedIndices);
    },
    [site, rows, bulkScopeUrlKeys, runSingleWikipediaLinkRow, runBulkWikipediaLinkForIndices],
  );

  const handleAiWikipediaLinkRow = useCallback(
    async (index: number) => {
      await runSingleWikipediaLinkRow(index);
    },
    [runSingleWikipediaLinkRow],
  );

  const handleAiWikipediaLinkAll = useCallback(async () => {
    if (!site || !rows.length) return;
    const indices = overviewBulkRowIndices(rows, bulkScopeUrlKeys);
    await runBulkWikipediaLinkForIndices(indices);
  }, [site, rows, bulkScopeUrlKeys, runBulkWikipediaLinkForIndices]);

  return {
    handleAiWikipediaLinkRow,
    handleAiWikipediaLinkAll,
    runWikipediaLinkForIndices,
  };
}
