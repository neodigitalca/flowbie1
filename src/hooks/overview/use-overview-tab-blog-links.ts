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
import { buildBlogLinksCatalog } from "@/lib/overview/overview-blog-links-catalog";
import type { LinksHarnessSetters } from "@/lib/overview/overview-blog-links-harness-mutations";
import { setLinksHarnessMessage } from "@/lib/overview/overview-blog-links-harness-mutations";
import {
  finalizeOverviewLinksHarnessBatch,
  initOverviewLinksHarnessBatchState,
  runOverviewLinksHarnessBatch,
} from "@/lib/overview/overview-blog-links-harness-run";
import { loadBlogLinksLinkInventory } from "@/lib/overview/overview-blog-links-inventory";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import { setOptimizingState } from "@/hooks/content-optimization/optimization-helpers-a";
import { getWordPressPostContent } from "@/lib/wordpress-api/posts";

type Args = Pick<
  OverviewTabBase,
  "rows" | "bindings" | "resolveBindings" | "updateRow" | "opt"
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

async function fetchRowHtmlByIndex(
  site: WordPressSite,
  indices: number[],
  rows: OverviewRow[],
  bindings: Record<string, OverviewBinding | undefined>,
  getInventoryMatchForUrl?: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined,
): Promise<Record<number, string>> {
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
    site.username!,
    site.appPassword!,
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

export function useOverviewTabBlogLinks({
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
}: Args) {
  const makeHarnessSetters = useCallback(
    (batchKey: string): LinksHarnessSetters | null => {
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

  const runLinksForIndices = useCallback(
    async (indices: number[]) => {
      if (!site) return;
      if (!apiKey?.trim()) return;

      const batchKey = `${site.id}-batch`;
      const harnessSetters = makeHarnessSetters(batchKey);
      if (!harnessSetters) return;

      const subset = indices.map((i) => rows[i]).filter(Boolean) as OverviewRow[];
      const urls = subset.map((r) => r.url);

      flushSync(() => {
        setOptimizingState(opt.setIsOptimizingContent, batchKey, true);
        setLinksHarnessMessage(harnessSetters, "Downloading posts + pages inventory…", 3);
      });

      try {
        const linkInventory = await loadBlogLinksLinkInventory(site, (msg) => {
          setLinksHarnessMessage(harnessSetters, msg, 6);
        });
        if (!linkInventory) {
          setLinksHarnessMessage(harnessSetters, "Link inventory unavailable.", 0);
          return;
        }

        const { pool: linkPool } = linkInventory;

        setLinksHarnessMessage(harnessSetters, "Binding rows from inventory…", 8);

        const [extraBindings, rowHtmlByIndex] = await Promise.all([
          resolveBindings(urls, site, undefined, { inventoryOnly: true }),
          fetchRowHtmlByIndex(site, indices, rows, bindings, getInventoryMatchForUrl),
        ]);
        const mergedBindings: Record<string, OverviewBinding | undefined> = {
          ...bindings,
          ...extraBindings,
        };

        const indexSet = new Set(indices);
        const { catalog, skippedNoHtml, skippedNoBinding, skippedNoWork } = buildBlogLinksCatalog(
          rows,
          mergedBindings,
          getInventoryMatchForUrl,
          site,
          site.siteUrl,
          linkPool,
          sitemapSource,
          rowHtmlByIndex,
        );

        const eligible = catalog.filter(
          (c) =>
            indexSet.has(c.index) &&
            overviewRowInBulkScope(rows[c.index]?.url ?? "", bulkScopeUrlKeys),
        );

        if (!eligible.length) {
          return;
        }

        flushSync(() => {
          initOverviewLinksHarnessBatchState({
            site,
            catalog: eligible,
            setBulkOptimizationState: opt.setBulkOptimizationState,
            setOptimizationProgress: opt.setOptimizationProgress,
            setIsOptimizingContent: opt.setIsOptimizingContent,
            prepMessage: `Links: 1 blog at a time (${eligible.length} rows)…`,
          });
        });

        await runOverviewLinksHarnessBatch({
          catalog: eligible,
          linkPool,
          agentOptions: {
            apiKey,
            model: selectedModel || "google/gemini-2.5-flash",
            siteId: site.id,
            siteUrl: site.siteUrl,
          },
          harnessSetters,
          updateRow,
        });

        void skippedNoHtml;
        void skippedNoBinding;
        void skippedNoWork;
      } finally {
        finalizeOverviewLinksHarnessBatch(
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
      bulkScopeUrlKeys,
      updateRow,
      makeHarnessSetters,
      opt.setBulkOptimizationState,
      opt.setOptimizationProgress,
      opt.setIsOptimizingContent,
    ],
  );

  const handleAiLinksRow = useCallback(
    async (index: number) => {
      if (!site || index < 0 || index >= rows.length) return;
      await runLinksForIndices([index]);
    },
    [site, rows.length, runLinksForIndices],
  );

  const handleAiLinksAll = useCallback(async () => {
    if (!site || !rows.length) return;
    const indices = overviewBulkRowIndices(rows, bulkScopeUrlKeys);
    await runLinksForIndices(indices);
  }, [site, rows, bulkScopeUrlKeys, runLinksForIndices]);

  return {
    handleAiLinksRow,
    handleAiLinksAll,
  };
}
