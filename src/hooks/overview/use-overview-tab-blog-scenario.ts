import { useCallback } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewTabBase } from "@/hooks/overview/use-overview-tab-base";
import { overviewBulkRowIndices } from "@/lib/overview/overview-bulk-row-scope";
import type { ScenarioHarnessSetters } from "@/lib/overview/overview-blog-scenario-harness-mutations";
import {
  finalizeOverviewScenarioHarnessBatch,
  initOverviewScenarioHarnessBatchState,
  initOverviewScenarioHarnessRowState,
  runOverviewScenarioHarnessBatch,
  runOverviewScenarioHarnessRow,
} from "@/lib/overview/overview-blog-scenario-harness-run";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import type { AiseoAfterRowWriteFn } from "@/lib/overview/overview-aiseo-after-upload";
import { createAiseoCacheWriteAccumulator, finalizeAiseoCacheWriteForUpload } from "@/lib/overview/overview-aiseo-cache-write";

type Args = Pick<OverviewTabBase, "opt" | "syncOpt" | "rowsRef" | "updateRow"> & {
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
  shouldSkipRow?: (row: OverviewRow) => boolean;
};

export function useOverviewTabBlogScenario({
  site,
  sitemapSource,
  opt,
  syncOpt,
  apiKey,
  selectedModel,
  bulkScopeUrlKeys,
  getInventoryMatchForUrl,
  rowsRef,
  updateRow,
  uploadAfterRowWrite,
  shouldSkipRow,
}: Args) {
  const makeHarnessSetters = useCallback(
    (batchKey: string, immediate = false): ScenarioHarnessSetters | null => {
      if (!site?.id) return null;
      const source = immediate ? syncOpt : opt;
      return {
        siteId: site.id,
        batchKey,
        setBulkOptimizationState: source.setBulkOptimizationState,
        setOptimizationProgress: source.setOptimizationProgress,
      };
    },
    [site?.id, opt, syncOpt],
  );

  const handleAiScenarioRow = useCallback(
    async (rowIndex: number) => {
      if (!site) return;
      if (!apiKey?.trim()) return;

      const row = rowsRef.current[rowIndex];
      if (!row?.url?.trim()) return;

      updateRow(rowIndex, { status: "ai-scenario" });

      const batchKey = `${site.id}-batch`;
      const harnessSetters = makeHarnessSetters(batchKey, true);
      if (!harnessSetters) return;

      initOverviewScenarioHarnessRowState({
        site,
        row,
        setBulkOptimizationState: syncOpt.setBulkOptimizationState,
        setOptimizationProgress: syncOpt.setOptimizationProgress,
        setIsOptimizingContent: syncOpt.setIsOptimizingContent,
      });

      try {
        const cacheWrite = createAiseoCacheWriteAccumulator(site);
        await runOverviewScenarioHarnessRow({
          site,
          row,
          rowIndex,
          sitemapSource,
          apiKey,
          model: selectedModel || "google/gemini-2.5-flash",
          harnessSetters,
          cacheWrite,
          updateRow,
          getInventoryMatchForUrl,
          uploadAfterRowWrite,
        });
        finalizeAiseoCacheWriteForUpload(cacheWrite, rowsRef);
      } finally {
        finalizeOverviewScenarioHarnessBatch(
          batchKey,
          site.id,
          syncOpt.setIsOptimizingContent,
          syncOpt.setOptimizationProgress,
        );
      }
    },
    [
      site,
      sitemapSource,
      apiKey,
      selectedModel,
      syncOpt,
      makeHarnessSetters,
      rowsRef,
      updateRow,
      getInventoryMatchForUrl,
      uploadAfterRowWrite,
    ],
  );

  const handleAiScenarioAll = useCallback(async () => {
    if (!site) return;
    if (!apiKey?.trim()) return;

    const rowIndices = overviewBulkRowIndices(rowsRef.current, bulkScopeUrlKeys).filter((index) => {
      const row = rowsRef.current[index];
      return row?.url?.trim() && !shouldSkipRow?.(row);
    });
    if (!rowIndices.length) return;
    const scopedRows = rowIndices.map((index) => rowsRef.current[index]!);

    const batchKey = `${site.id}-batch`;
    const harnessSetters = makeHarnessSetters(batchKey);
    if (!harnessSetters) return;

    initOverviewScenarioHarnessBatchState({
      site,
      rows: scopedRows,
      setBulkOptimizationState: opt.setBulkOptimizationState,
      setOptimizationProgress: opt.setOptimizationProgress,
      setIsOptimizingContent: opt.setIsOptimizingContent,
      prepMessage: "Preparing Case scenario batch…",
    });

    try {
      const cacheWrite = createAiseoCacheWriteAccumulator(site);
      await runOverviewScenarioHarnessBatch({
        site,
        rows: rowsRef.current,
        rowIndices,
        sitemapSource,
        apiKey,
        model: selectedModel || "google/gemini-2.5-flash",
        harnessSetters,
        cacheWrite,
        updateRow,
        getInventoryMatchForUrl,
        uploadAfterRowWrite,
      });
      finalizeAiseoCacheWriteForUpload(cacheWrite, rowsRef);
    } finally {
      finalizeOverviewScenarioHarnessBatch(
        batchKey,
        site.id,
        opt.setIsOptimizingContent,
        opt.setOptimizationProgress,
      );
    }
  }, [
    site,
    sitemapSource,
    apiKey,
    selectedModel,
    bulkScopeUrlKeys,
    opt,
    makeHarnessSetters,
    rowsRef,
    updateRow,
    getInventoryMatchForUrl,
    uploadAfterRowWrite,
    shouldSkipRow,
  ]);

  return { handleAiScenarioRow, handleAiScenarioAll };
}
