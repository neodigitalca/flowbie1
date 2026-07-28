import { useCallback } from "react";
import type { MutableRefObject } from "react";
import { flushSync } from "react-dom";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_ADD_A_FOCUS_KEYWORD_BEFORE_RUNNING_AI_AL, NOTIFY_ADD_FOCUS_KEYWORDS_BEFORE_RUNNING_AI_ALL, NOTIFY_A_BULK_CONTENT_RUN_IS_ALREADY_IN_PROGRES, NOTIFY_A_BULK_RUN_IS_ALREADY_IN_PROGRESS, NOTIFY_BACKEND_API_URL_IS_NOT_CONFIGURED_FOR_PR, NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN, NOTIFY_NO_ROWS_HAVE_A_FOCUS_KEYWORD_RUN_KEYWORD, NOTIFY_NO_ROWS_HAVE_A_POST_ID_FROM_LOADED_INVEN, notifyFinishedResearchForXRowSDataforseo, notifyOptimizeAllSerpFinishedX, notifyResearchFailedForAllXRowSBriefJs, notifyResearchFinishedXXBriefJsonUpdated, notifyResearchRanOnXRowSButBriefJsonW, notifyStartingAiExtraTextForXUrlSUseT, notifyStartingBulkContentOptimizationForX } from "@/lib/notify-messages";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import { isProductionBackendMisconfigured } from "@/lib/mcp-tools";
import { runOverviewResearchBatch, type OverviewResearchRowResult } from "@/lib/overview/overview-research-batch";
import { initBulkSliceWithStatus, patchActiveBulkSlice } from "@/lib/overview/overview-bulk-inline-status";
import { needsOverviewResearchRefresh } from "@/lib/overview/overview-ensure-focus-keyword";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { buildPrefilledTargetsFromOverviewRows } from "@/hooks/content-optimization/bulk-seo-extra-text-fast-path";
import { overviewInventoryCollectionsFromSource } from "@/lib/overview/overview-sitemap-source";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewTabBase } from "@/hooks/overview/use-overview-tab-base";
import { overviewTitleOptimizationExcluded } from "@/lib/overview/overview-page-bucket";
import { buildAiAllMetaCatalog } from "@/lib/overview/overview-ai-all-meta-batch-catalog";
import {
  initOverviewAiAllMetaHarnessBatchState,
  runOverviewAiAllMetaHarness,
} from "@/lib/overview/overview-ai-all-meta-harness-run";
import {
  finalizeOverviewResearchHarnessBatch,
  initOverviewResearchHarnessBatchState,
  makeResearchHarnessCallback,
  finishResearchRowHarness,
  setResearchBatchPrepMessage,
  setResearchUrlStatus,
  type ResearchHarnessSetters,
} from "@/lib/overview/overview-research-harness-run";
import { isOverviewBatchRunning } from "@/lib/overview/overview-batch-slot";
import { seedOverviewBulkBatchPrelude } from "@/components/overview/overview-tab/overview-bulk-run-helpers";
import {
  markContentPrepBatchHarnessSection,
  setContentPrepBatchMessage,
  type ContentPrepHarnessSetters,
} from "@/lib/overview/overview-content-prep-harness-run";
import { snapshotHasInventoryEntries } from "@/lib/wordpress-api/inventory-match";
import {
  getAnyBulkInventorySessionSnapshot,
  getBulkInventorySessionSnapshot,
} from "@/lib/wordpress-bulk-inventory-session-cache";
import { overviewBulkPageRanges } from "@/lib/overview/overview-bulk-page-size";
import { setOverviewBulkHarnessPageState } from "@/lib/overview/overview-bulk-page-state";
import {
  overviewBulkRowEntries,
  overviewBulkRowIndices,
  overviewRowInBulkScope,
  overviewRowsInBulkScope,
} from "@/lib/overview/overview-bulk-row-scope";

type Args = Pick<
  OverviewTabBase,
  | "rows"
  | "rowsRef"
  | "updateRow"
  | "setBulkActionProgress"
  | "setGscQuickWinsFile"
  | "opt"
  | "bulkSeoExtraOptions"
  | "bindings"
  | "getInventoryMatchForUrl"
  | "prefetchOverviewInventory"
  | "runAiAllMetaBatchForCatalog"
  | "bulkAiFaqSeedCount"
  | "sitemapSource"
  | "optimizeFaq"
  | "optimizeFaqQuestion"
  | "optimizeFaqAnswer"
  | "getDfsSerpContext"
> & {
  site: WordPressSite | undefined;
  gscQuickWinsFile: string | null;
  serpDumpUrl: (filename: string) => string;
  portfolioBlockedHostsForSemrush: string[];
  handleDataForSeoResearch: (
    rowIndex: number,
    options?: { skipGsc?: boolean; silent?: boolean },
  ) => Promise<Partial<OverviewRow> | null>;
  ensureOverviewKeywordsForMissingRows: (options?: {
    progressKey?: "research" | "contentKw" | "entityKw";
    silent?: boolean;
    singleBatch?: boolean;
  }) => Promise<{ ensured: number; failed: number; keywordsByIndex: Map<number, string> }>;
  handleAiTitleRow: (
    index: number,
    rowOverride?: OverviewRow,
    options?: { skipOptimizeTitleLoading?: boolean },
  ) => Promise<{ title: string; aiTitle: string } | null>;
  handleAiMetaRow: (
    index: number,
    rowOverride?: OverviewRow,
    options?: { skipOptimizeMetaLoading?: boolean },
  ) => Promise<{ metaDescription: string; aiMeta: string } | null>;
  handleAiFaqRowAll: (
    rowIndex: number,
    rowOverride?: OverviewRow,
    options?: {
      silentToast?: boolean;
      skipFaqLoading?: boolean;
      onMicroStep?: () => void;
      seedQuestionCount?: number;
    },
  ) => Promise<void>;
  bulkScopeUrlKeys: Set<string>;
  bulkScopeUrlKeysRef: MutableRefObject<Set<string>>;
};

async function runResearchRefreshForRows(
  indices: number[],
  getRows: () => OverviewRow[],
  handleDataForSeoResearch: Args["handleDataForSeoResearch"],
): Promise<number> {
  let refreshed = 0;
  for (const index of indices) {
    const row = getRows()[index];
    if (!row) continue;
    // Never skip: always run research (handler writes missing keywords first).
    // eslint-disable-next-line no-await-in-loop
    const patch = await handleDataForSeoResearch(index, { silent: true });
    if (patch) refreshed += 1;
  }
  return refreshed;
}

export function useOverviewTabResearchPipelines({
  rows,
  rowsRef,
  updateRow,
  setBulkActionProgress,
  setGscQuickWinsFile,
  site,
  gscQuickWinsFile,
  serpDumpUrl,
  portfolioBlockedHostsForSemrush,
  opt,
  bulkSeoExtraOptions,
  bindings,
  getInventoryMatchForUrl,
  prefetchOverviewInventory,
  runAiAllMetaBatchForCatalog,
  bulkAiFaqSeedCount,
  sitemapSource,
  optimizeFaq,
  optimizeFaqQuestion,
  optimizeFaqAnswer,
  getDfsSerpContext,
  handleDataForSeoResearch,
  ensureOverviewKeywordsForMissingRows,
  handleAiTitleRow,
  handleAiMetaRow,
  handleAiFaqRowAll,
  bulkScopeUrlKeys,
  bulkScopeUrlKeysRef,
}: Args) {
  const runResearchAll = useCallback(
    async () => {
      const scopeKeys = bulkScopeUrlKeysRef.current;
      if (scopeKeys.size === 0) return;
      if (!site) {
        notify.error(NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN);
        return;
      }
      if (isProductionBackendMisconfigured()) {
        notify.error(
          "Backend API URL is not configured for production. On Render, set VITE_MCP_API_BASE on the static frontend service (e.g. https://your-api.onrender.com/api/mcp) and redeploy flowbieonefront-end.",
          { duration: 14000 },
        );
        return;
      }

      const batchKey = `${site.id}-batch`;
      if (isOverviewBatchRunning(opt.isOptimizingContent, batchKey)) {
        notify.error(NOTIFY_A_BULK_RUN_IS_ALREADY_IN_PROGRESS);
        return;
      }

      try {
        // Never skip research: write missing keywords first, then research every scoped row.
        await ensureOverviewKeywordsForMissingRows({ silent: true, progressKey: "research" });

        const currentRows = rowsRef.current;
        const eligible = overviewBulkRowEntries(currentRows, scopeKeys).map(({ row, index }) => {
          const kw = row.focusKeyword?.trim() || "";
          return { row: { ...row, focusKeyword: kw }, index };
        });

        if (!eligible.length) {
          notify.error("No rows in the current scope to research.", { duration: 10000 });
          return;
        }

        const researchTotal = eligible.length;
        let briefUpdated = 0;
        let serpOnly = 0;
        let failed = 0;

        const batchDeps = {
          site,
          gscQuickWinsFile,
          serpDumpUrl,
          portfolioBlockedHostsForSemrush,
          skipGsc: false,
          silent: true,
        };

        const indexToUrl = new Map<number, string>();
        for (const { index, row } of eligible) {
          const url = row.url?.trim();
          if (url) indexToUrl.set(index, url);
        }

        const harnessSetters: ResearchHarnessSetters = {
          siteId: site.id,
          batchKey,
          setBulkOptimizationState: opt.setBulkOptimizationState,
          setOptimizationProgress: opt.setOptimizationProgress,
        };
        const onHarnessSection = makeResearchHarnessCallback(indexToUrl, harnessSetters);

        const prepMessage = `Researching ${researchTotal} page(s)…`;

        flushSync(() => {
          initOverviewResearchHarnessBatchState({
            site,
            rows: eligible.map((e) => e.row),
            setBulkOptimizationState: opt.setBulkOptimizationState,
            setOptimizationProgress: opt.setOptimizationProgress,
            setIsOptimizingContent: opt.setIsOptimizingContent,
            prepMessage,
          });
          for (const { index } of eligible) {
            updateRow(index, { status: "research-faq" });
          }
        });

        const batchCallbacks = {
          onBatchGscExportStart: (urlCount: number) => {
            setResearchBatchPrepMessage(
              batchKey,
              site.id,
              `GSC export for ${urlCount} page(s)…`,
              harnessSetters,
            );
          },
          onBatchGscExportDone: (filename: string | null) => {
            setResearchBatchPrepMessage(
              batchKey,
              site.id,
              filename
                ? `GSC export complete (${filename})`
                : "GSC export finished (no file saved)",
              harnessSetters,
            );
          },
          onPageStart: (index: number, row: OverviewRow) => {
            const url = row.url?.trim();
            if (!url) return;
            flushSync(() => {
              setResearchUrlStatus(batchKey, url, "optimizing", opt.setBulkOptimizationState);
            });
          },
          onHarnessSection,
          onPageComplete: (r: OverviewResearchRowResult) => {
            const url = indexToUrl.get(r.index)?.trim();
            flushSync(() => {
              if (r.patch) {
                updateRow(r.index, { status: "idle", ...r.patch });
              } else {
                updateRow(r.index, { status: "error" });
              }
              if (url) {
                finishResearchRowHarness(
                  url,
                  r.index,
                  r.harnessSummaries,
                  harnessSetters,
                  Boolean(r.patch) && !r.failed,
                );
              }
            });
          },
        };

        const pageRanges = overviewBulkPageRanges(eligible.length);
        let completedOffset = 0;
        for (const { start, end, page, pageCount } of pageRanges) {
          const slice = eligible.slice(start, end);
          setOverviewBulkHarnessPageState({
            batchKey,
            siteId: site.id,
            page,
            pageCount,
            start,
            end,
            total: researchTotal,
            setBulkOptimizationState: opt.setBulkOptimizationState,
            setOptimizationProgress: opt.setOptimizationProgress,
            step: "Researching…",
          });

          const { stats: pageStats } = await runOverviewResearchBatch(
            slice,
            batchDeps,
            { batchIndex: page, batchCount: pageCount, total: researchTotal, completedOffset },
            batchCallbacks,
          );

          briefUpdated += pageStats.briefUpdated;
          serpOnly += pageStats.serpOnly;
          failed += pageStats.failed;
          completedOffset += slice.length;
        }

        finalizeOverviewResearchHarnessBatch(
          batchKey,
          site.id,
          briefUpdated,
          researchTotal,
          opt.setBulkOptimizationState,
          opt.setOptimizationProgress,
          opt.setIsOptimizingContent,
        );

        if (site.siteUrl && BACKEND_API_BASE && !gscQuickWinsFile) {
          try {
            const exportRes = await fetch(`${BACKEND_API_BASE}/api/gsc/export-overview-quick-wins`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                siteUrl: site.siteUrl,
                siteWideQueriesOnly: true,
              }),
            });
            const exportJson = await exportRes.json().catch(() => null);
            if (exportRes.ok && exportJson?.storedFile) {
              setGscQuickWinsFile(exportJson.storedFile);
            }
          } catch {
            /* optional */
          }
        }

        if (failed === researchTotal) {
          notify.error(notifyResearchFailedForAllXRowSBriefJs(researchTotal), { duration: 14000 });
        } else if (briefUpdated === 0) {
          notify.warning(notifyResearchRanOnXRowSButBriefJsonW(researchTotal, serpOnly, failed), {
            duration: 12000,
          });
        } else if (failed > 0 || serpOnly > 0) {
          notify.warning(
            notifyResearchFinishedXXBriefJsonUpdated(briefUpdated, researchTotal, serpOnly > 0),
            { duration: 10000 },
          );
        } else {
          notify.success(notifyFinishedResearchForXRowSDataforseo(briefUpdated));
        }
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Research batch failed.";
        notify.error(msg, { duration: 12000 });
        if (site) {
          finalizeOverviewResearchHarnessBatch(
            `${site.id}-batch`,
            site.id,
            0,
            rows.length,
            opt.setBulkOptimizationState,
            opt.setOptimizationProgress,
            opt.setIsOptimizingContent,
          );
        }
      }
    },
    [
      rows,
      rowsRef,
      site,
      gscQuickWinsFile,
      serpDumpUrl,
      portfolioBlockedHostsForSemrush,
      setGscQuickWinsFile,
      updateRow,
      bulkScopeUrlKeysRef,
      ensureOverviewKeywordsForMissingRows,
      opt.setBulkOptimizationState,
      opt.setOptimizationProgress,
      opt.setIsOptimizingContent,
    ],
  );

  const handleResearchAll = runResearchAll;

  const handleOptimizeAll = useCallback(async () => {
    if (!site) {
      notify.error(NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN);
      return;
    }
    const scopeKeys = bulkScopeUrlKeysRef.current;
    if (scopeKeys.size === 0) return;
    const scopedIndices = overviewBulkRowIndices(rowsRef.current, scopeKeys);
    const urls = scopedIndices.map((index) => rowsRef.current[index]!.url);
    const batchKey = `${site.id}-batch`;
    if (isOverviewBatchRunning(opt.isOptimizingContent, batchKey)) {
      notify.error(NOTIFY_A_BULK_CONTENT_RUN_IS_ALREADY_IN_PROGRES);
      return;
    }
    setBulkActionProgress((p) => ({
      ...p,
      optimizeAll: initBulkSliceWithStatus("optimizeAll", urls.length, 0),
    }));
    let bulkHandedOff = false;
    try {
      seedOverviewBulkBatchPrelude(
        opt.setBulkOptimizationState,
        opt.setIsOptimizingContent,
        batchKey,
        urls,
        "WordPress inventory",
      );
      const prepHarnessSetters: ContentPrepHarnessSetters = {
        siteId: site.id,
        batchKey,
        setBulkOptimizationState: opt.setBulkOptimizationState,
        setOptimizationProgress: opt.setOptimizationProgress,
      };
      markContentPrepBatchHarnessSection(
        0,
        "start",
        prepHarnessSetters,
        "Using WordPress inventory from session…",
      );
      patchActiveBulkSlice(setBulkActionProgress, "optimizeAll", {
        statusMessage: "Using WordPress inventory from session…",
      });
      const sessionSnapshot =
        getBulkInventorySessionSnapshot(site.id, sitemapSource) ??
        getAnyBulkInventorySessionSnapshot(site.id);
      if (!sessionSnapshot || !snapshotHasInventoryEntries(sessionSnapshot)) {
        notify.error("Load the sitemap first so WordPress inventory is in session.");
        return;
      }
      setContentPrepBatchMessage(
        "Using WordPress inventory from this session (no re-fetch).",
        "WordPress inventory",
        prepHarnessSetters,
      );
      markContentPrepBatchHarnessSection(0, "done", prepHarnessSetters);

      const scopedRows = overviewBulkRowEntries(rowsRef.current, scopeKeys).map((e) => e.row);
      const { prefilledOverviewTargets, prefilledUrlKeywords } =
        buildPrefilledTargetsFromOverviewRows(
          scopedRows,
          bindings,
          getInventoryMatchForUrl,
          site,
          sitemapSource,
        );

      notify.info(
        `Starting bulk content optimization for ${urls.length} URL(s). Use the progress strip below or follow the bulk review panel.`,
        { duration: 6000 },
      );
      bulkHandedOff = true;
      const siteOpt = opt.optimizationOptions[site.id];
      await opt.handleOptimizeMultipleContentClick(
        site,
        urls,
        opt.optimizeUpdateMode[site.id] || "update",
        {
          optimizeContent: true,
          autoOptimize: true,
          optimizeTitle: false,
          optimizeMeta: false,
          optimizeExcerpt: false,
          optimizeFeaturedImage:
            sitemapSource === "sap" ? Boolean(siteOpt?.optimizeFeaturedImage) : false,
          featuredImageType:
            sitemapSource === "sap" ? (siteOpt?.featuredImageType ?? "google-maps") : siteOpt?.featuredImageType,
          optimizeExtraText: false,
          optimizeExtraImage: false,
          contentOnlyUpload: true,
          hasEntity: sitemapSource === "sap",
          inventorySitemapSource: sitemapSource,
          prefilledOverviewTargets,
          prefilledUrlKeywords,
        },
      );
    } finally {
      setBulkActionProgress((p) => {
        const next = { ...p };
        delete next.optimizeAll;
        return next;
      });
      if (!bulkHandedOff) {
        opt.resetBulkBatch(batchKey);
      }
    }
  }, [
    bulkScopeUrlKeysRef,
    rowsRef,
    site,
    opt,
    setBulkActionProgress,
    sitemapSource,
    ensureOverviewKeywordsForMissingRows,
    handleDataForSeoResearch,
    bindings,
    getInventoryMatchForUrl,
  ]);

  const handleBulkSeoExtraText = useCallback(async () => {
    if (!site) {
      notify.error(NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN);
      return;
    }
    const scopedRows = overviewRowsInBulkScope(rows, bulkScopeUrlKeys);
    if (!scopedRows.length) return;
    const urls = scopedRows.map((r) => r.url);
    let { prefilledOverviewTargets, prefilledUrlKeywords } =
      buildPrefilledTargetsFromOverviewRows(
        scopedRows,
        bindings,
        getInventoryMatchForUrl,
        site,
        sitemapSource,
      );

    const targetCount = Object.keys(prefilledOverviewTargets).length;
    const missingRatio = scopedRows.length > 0 ? (scopedRows.length - targetCount) / scopedRows.length : 0;
    if (
      targetCount < scopedRows.length &&
      missingRatio > 0.1 &&
      site?.username &&
      site.appPassword
    ) {
      const collections = overviewInventoryCollectionsFromSource(sitemapSource, site);
      await prefetchOverviewInventory(site, {
        collections,
        includeContent: false,
        sitemapUrls: urls,
      });
      ({ prefilledOverviewTargets, prefilledUrlKeywords } = buildPrefilledTargetsFromOverviewRows(
        scopedRows,
        bindings,
        getInventoryMatchForUrl,
        site,
        sitemapSource,
      ));
    }

    const finalTargetCount = Object.keys(prefilledOverviewTargets).length;

    if (finalTargetCount === 0) {
      notify.error(NOTIFY_NO_ROWS_HAVE_A_POST_ID_FROM_LOADED_INVEN, {
        duration: 12000,
      });
      return;
    }

    const batchKey = `${site.id}-batch`;
    if (isOverviewBatchRunning(opt.isOptimizingContent, batchKey)) {
      notify.error(NOTIFY_A_BULK_CONTENT_RUN_IS_ALREADY_IN_PROGRES);
      return;
    }
    notify.info(
      `Starting AI Extra Text for ${urls.length} URL(s). Use the progress strip or bulk review panel.`,
      { duration: 6000 },
    );
    await opt.handleOptimizeMultipleContentClick(
      site,
      urls,
      opt.optimizeUpdateMode[site.id] || "update",
      { ...bulkSeoExtraOptions, prefilledUrlKeywords, prefilledOverviewTargets },
    );
  }, [
    rows,
    bulkScopeUrlKeys,
    site,
    opt,
    bulkSeoExtraOptions,
    bindings,
    getInventoryMatchForUrl,
    prefetchOverviewInventory,
    sitemapSource,
  ]);

  const handleOptimizeAllSerpRow = useCallback(
    async (index: number) => {
      const base = rows[index];
      if (!base) return;

      let snapshot: OverviewRow = { ...base };
      let ranResearch = false;
      if (
        !snapshot.focusKeyword?.trim() ||
        !snapshot.seoResearch?.trim() ||
        needsOverviewResearchRefresh(snapshot, snapshot.focusKeyword ?? "")
      ) {
        ranResearch = true;
        const researchPatch = await handleDataForSeoResearch(index, { silent: true });
        if (researchPatch === null) return;
        snapshot = { ...snapshot, ...researchPatch };
      }

      if (!overviewTitleOptimizationExcluded(snapshot)) {
        const titlePatch = await handleAiTitleRow(index, snapshot);
        if (!titlePatch) return;
        snapshot = { ...snapshot, ...titlePatch };
      }

      const metaPatch = await handleAiMetaRow(index, snapshot);
      if (!metaPatch) return;
      snapshot = { ...snapshot, ...metaPatch };

      await handleAiFaqRowAll(index, snapshot, { silentToast: true, skipFaqLoading: true });

      const parts: string[] = [];
      if (ranResearch) parts.push("research");
      if (!overviewTitleOptimizationExcluded(snapshot)) parts.push("title");
      parts.push("meta");
      parts.push("FAQ");
      notify.success(notifyOptimizeAllSerpFinishedX(parts.join(", ")));
    },
    [rows, handleDataForSeoResearch, handleAiTitleRow, handleAiMetaRow, handleAiFaqRowAll],
  );

  const handleAiAllMetaRow = useCallback(
    async (index: number) => {
      if (!site) {
        notify.error(NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN);
        return;
      }
      const batchKey = `${site.id}-batch`;
      if (isOverviewBatchRunning(opt.isOptimizingContent, batchKey)) {
        notify.error(NOTIFY_A_BULK_CONTENT_RUN_IS_ALREADY_IN_PROGRES);
        return;
      }

      const base = rows[index];
      if (!base) return;

      flushSync(() => {
        initOverviewAiAllMetaHarnessBatchState({
          site,
          rows: [base],
          prepMessage: "Preparing meta batch…",
          setBulkOptimizationState: opt.setBulkOptimizationState,
          setOptimizationProgress: opt.setOptimizationProgress,
          setIsOptimizingContent: opt.setIsOptimizingContent,
        });
      });

      try {
        const { catalog, skippedNoKeyword } = buildAiAllMetaCatalog(
          rows,
          sitemapSource as OverviewSitemapSource | undefined,
          bulkAiFaqSeedCount,
        );
        const entry = catalog.find((c) => c.index === index);
        if (!entry || skippedNoKeyword.includes(index)) {
          notify.error(NOTIFY_ADD_A_FOCUS_KEYWORD_BEFORE_RUNNING_AI_AL);
          updateRow(index, { status: "error" });
          opt.resetBulkBatch(batchKey);
          return;
        }

        await runOverviewAiAllMetaHarness({
          site,
          rows: [base],
          catalog: [entry],
          skippedNoBrief: [],
          runAiAllMetaBatchForCatalog,
          updateRow,
          setBulkOptimizationState: opt.setBulkOptimizationState,
          setOptimizationProgress: opt.setOptimizationProgress,
          setIsOptimizingContent: opt.setIsOptimizingContent,
          skipInit: true,
          bulkAiFaqSeedCount,
          faqDeps: {
            optimizeFaq,
            optimizeFaqQuestion,
            optimizeFaqAnswer,
            getDfsSerpContext,
          },
        });
      } catch {
        opt.resetBulkBatch(batchKey);
      }
    },
    [
      rows,
      site,
      opt,
      sitemapSource,
      bulkAiFaqSeedCount,
      runAiAllMetaBatchForCatalog,
      updateRow,
    ],
  );

  const handleAiAllMetaAll = useCallback(async () => {
    if (!site) {
      notify.error(NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN);
      return;
    }
    const scopeKeys = bulkScopeUrlKeysRef.current;
    if (scopeKeys.size === 0) return;

    const batchKey = `${site.id}-batch`;
    if (isOverviewBatchRunning(opt.isOptimizingContent, batchKey)) {
      notify.error(NOTIFY_A_BULK_CONTENT_RUN_IS_ALREADY_IN_PROGRES);
      return;
    }

    const latestRows = rowsRef.current;
    const scopedRows = overviewRowsInBulkScope(latestRows, scopeKeys);

    flushSync(() => {
      initOverviewAiAllMetaHarnessBatchState({
        site,
        rows: scopedRows,
        prepMessage: "Preparing meta batch…",
        setBulkOptimizationState: opt.setBulkOptimizationState,
        setOptimizationProgress: opt.setOptimizationProgress,
        setIsOptimizingContent: opt.setIsOptimizingContent,
      });
    });

    try {
      const { catalog, skippedNoKeyword } = buildAiAllMetaCatalog(
        latestRows,
        sitemapSource as OverviewSitemapSource | undefined,
        bulkAiFaqSeedCount,
      );
      const scopedCatalog = catalog.filter((entry) =>
        overviewRowInBulkScope(latestRows[entry.index]?.url ?? "", scopeKeys),
      );

      if (scopedCatalog.length === 0) {
        notify.error(NOTIFY_ADD_FOCUS_KEYWORDS_BEFORE_RUNNING_AI_ALL);
        opt.resetBulkBatch(batchKey);
        return;
      }

      await runOverviewAiAllMetaHarness({
        site,
        rows: latestRows,
        catalog: scopedCatalog,
        skippedNoBrief: [],
        skippedNoKeyword,
        runAiAllMetaBatchForCatalog,
        updateRow,
        setBulkOptimizationState: opt.setBulkOptimizationState,
        setOptimizationProgress: opt.setOptimizationProgress,
        setIsOptimizingContent: opt.setIsOptimizingContent,
        skipInit: true,
        bulkAiFaqSeedCount,
        faqDeps: {
          optimizeFaq,
          optimizeFaqQuestion,
          optimizeFaqAnswer,
          getDfsSerpContext,
        },
      });
    } catch {
      opt.resetBulkBatch(batchKey);
    }
  }, [
    bulkScopeUrlKeysRef,
    rowsRef,
    site,
    opt,
    sitemapSource,
    bulkAiFaqSeedCount,
    runAiAllMetaBatchForCatalog,
    updateRow,
    optimizeFaq,
    optimizeFaqQuestion,
    optimizeFaqAnswer,
    getDfsSerpContext,
  ]);

  return {
    handleResearchAll,
    handleOptimizeAll,
    handleBulkSeoExtraText,
    handleOptimizeAllSerpRow,
    handleAiAllMetaRow,
    handleAiAllMetaAll,
  };
}
