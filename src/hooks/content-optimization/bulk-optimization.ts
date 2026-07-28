import { notify } from "@/lib/app-notifications";
import { NOTIFY_PLEASE_SELECT_AT_LEAST_ONE_POST_TO_OPTIM, notifyBulkSeoExtraTextFailedX, notifyProcessingXTargetsInXPagesOfX } from "@/lib/notify-messages";
import { mergeOptimizationProgress, setOptimizingState } from "./optimization-helpers";
import { buildWordPressPostsForLinkingFromInventory, buildWordPressPagesForLinkingFromInventory } from "@/lib/content-generation/extra-text-inventory-links";
import { seedSiteCacheFromLinkablePosts } from "@/lib/wordpress-site-cache";
import type { HandleOptimizeMultipleContentParams } from "./bulk-optimization-params";
import { seedBulkUrlKeywordsFromCaches } from "./bulk-optimization-seed-keywords";
import {
  assertBulkInventorySnapshotReady,
  seedAllBulkPrefetchCachesFromInventory,
} from "./bulk-optimization-seed-from-inventory";
import {
  seedBulkUrlSerpResearchReadyFromAcfCache,
  hasSubstantiveSeoResearch,
} from "./bulk-optimization-missing-seo-research";
import { mergeSeoResearchFromAcfIntoContext } from "@/lib/content-generation/ai-driven-acf-reader";
import { createBulkSerpWarmupController } from "./bulk-optimization-serp-warmup";
import { prefetchBulkAcfFieldsByPostIdForUrls } from "./bulk-optimization-prefetch-acf-by-post-id";
import {
  bulkSapGoogleMapsImageWarmupEnabled,
  createBulkGoogleMapsImageWarmupController,
} from "./bulk-optimization-google-maps-image-warmup";
import { clearGoogleMapsImageSessionCache } from "@/lib/content-generation/google-maps-image-api";
import { bulkOptimizationRunPostLoop } from "./bulk-optimization-post-loop";
import { patchBulkPrefetchedPendingLinkPools } from "./bulk-optimization-pending-link-pools";
import { runBulkSeoExtraTextBatch } from "./bulk-seo-extra-text-run";
import { initBulkExtraTextHarnessBatchState } from "./bulk-seo-extra-text-harness";
import type { WpPostSnapshotFromAcfByUrl } from "@/lib/wordpress-api/fields-client";
import {
  getSiteMirrorIndex,
  siteHasFlowbieWp,
} from "@/lib/wordpress-api/fields-client";
import { snapshotHasInventoryEntries, type BulkOptimizerInventorySnapshot } from "@/lib/wordpress-api/inventory-match";
import { ensureBulkOptimizerInventoryForRun, ensurePostsInventoryForHarness, ensurePagesInventoryForHarness, ensureSapInventoryForHarness } from "./bulk-optimization-load-inventory-snapshot";
import {
  everyUrlHasOverviewFastPathData,
  seedSeoExtraTextCachesFromOverviewTargets,
} from "./bulk-seo-extra-text-fast-path";
import { getMergedBulkInventorySessionSnapshot } from "@/lib/wordpress-bulk-inventory-session-cache";
import {
  CONTENT_OPTIMIZER_BULK_PAGE_SIZE,
  contentOptimizerBulkPageRanges,
  contentOptimizerBulkUsesPagination,
} from "@/lib/content-optimizer/content-optimizer-bulk-page-size";
import {
  buildContentPrepUrlHarnessMap,
  type ContentPrepHarnessSetters,
} from "@/lib/overview/overview-content-prep-harness-run";
import {
  applyBatchPrepHarnessPayload,
  applyPostPrepHarnessPayload,
  buildBatchPrepHarnessPayload,
  buildPostPrepHarnessPayload,
  buildWaitingBatchPrepHarnessSections,
  resolveContentPrepBatchSectionTitles,
  CONTENT_PREP_POST_HARNESS_TOTAL_SECTIONS,
} from "@/lib/overview/overview-content-prep-harness-sections";
import {
  buildEntityBucketHarnessMarkdown,
  buildInventoryBucketHarnessMarkdown,
  buildMergedInventoryHarnessMarkdown,
} from "@/lib/overview/overview-inventory-csv";

export { approveBulkKeywordApproval } from "./bulk-optimization-approval";

function bulkRunCancelRequested(
  batchKey: string,
  setBulkOptimizationState: HandleOptimizeMultipleContentParams["setBulkOptimizationState"],
): boolean {
  let cancelled = false;
  setBulkOptimizationState((prev: any) => {
    if (prev[batchKey]?.cancelRequested) cancelled = true;
    return prev;
  });
  return cancelled;
}
export type { HandleOptimizeMultipleContentParams, PrefilledOverviewTarget } from "./bulk-optimization-params";

export async function handleOptimizeMultipleContent(params: HandleOptimizeMultipleContentParams): Promise<void> {
  const {
    site,
    urls,
    wordPressPosts = [],
    updateMode,
    setGscQueriesForSelection: _setGscQueriesForSelection,
    setIsKeywordSelectionOpen: _setIsKeywordSelectionOpen,
    setGscClusterAnalysis: _setGscClusterAnalysis,
    setIsAnalyzingClusters: _setIsAnalyzingClusters,
    optimizationOptions,
    inContentImageRequest,
    setIsOptimizingContent,
    setOptimizationProgress,
    setBulkOptimizationState,
    optimizationFileManagers,
    continueOptimizationRef,
    muteToasts = false,
    prefilledUrlKeywords = {},
    prefilledOverviewTargets,
  } = params;

  if (!urls || urls.length === 0) {
    if (!muteToasts) notify.error(NOTIFY_PLEASE_SELECT_AT_LEAST_ONE_POST_TO_OPTIM);
    return;
  }

  const batchKey = `${site.id}-batch`;
  setOptimizingState(setIsOptimizingContent, batchKey, true);
  const isAcfKeywordMode = true;
  const seoExtraTextFieldOnly = optimizationOptions?.seoExtraTextFieldOnly === true;
  const useInventoryOnlyPrep = Boolean(site.username?.trim() && site.appPassword?.trim());
  const inventorySitemapSource = optimizationOptions?.inventorySitemapSource;
  const isEntitySapRun =
    inventorySitemapSource === "sap" || optimizationOptions?.hasEntity === true;
  const prepIncludesEntitySitemap =
    isEntitySapRun || optimizationOptions?.prepEntitySitemap === true;
  const batchPrepSectionTitles = resolveContentPrepBatchSectionTitles(prepIncludesEntitySitemap);
  const batchPrepHarnessTotalSections = batchPrepSectionTitles.length;
  const waitingBatchPrepHarnessSections = () =>
    buildWaitingBatchPrepHarnessSections(batchPrepSectionTitles);

  const pendingOptimizationData: Record<string, any> = {};
  const bulkContextRef: { current: { bulkIndex: number; totalBulkUrls: number; batchKey: string } | null } = {
    current: null,
  };
  const prefetchedPendingCache = new Map<
    number,
    { pending: Record<string, unknown>; primaryKeyword: string }
  >();
  const prefetchedAcfFieldsCache = new Map<number, Record<string, any>>();
  const prefetchedPostPayloadByUrlIndex = new Map<number, WpPostSnapshotFromAcfByUrl>();
  const prefetchedAcfFullPostByUrlIndex = new Map<number, Record<string, unknown>>();
  const setPendingOptimization = (updater: (prev: any) => any) => {
    const updated = updater(pendingOptimizationData);
    Object.assign(pendingOptimizationData, updated);
    const ctx = bulkContextRef.current;
    if (ctx && pendingOptimizationData[site.id] && typeof pendingOptimizationData[site.id] === "object") {
      Object.assign(pendingOptimizationData[site.id], {
        bulkIndex: ctx.bulkIndex,
        totalBulkUrls: ctx.totalBulkUrls,
        batchKey: ctx.batchKey,
      });
    }
  };

  const bulkContinueOptimizationRef = {
    ...continueOptimizationRef,
    current: async (
      siteId: string,
      selectedKeyword: any,
      clusterKeywords?: string[],
      setIsKeywordSelectionOpen?: (prev: any) => any,
      testMode?: boolean,
      secondaryKeywords?: string[]
    ) => {
      const { continueOptimizationWithKeyword: continueOptimizationWithKeywordModule } = await import(
        "./continue-optimization"
      );
      await continueOptimizationWithKeywordModule({
        siteId,
        selectedKeyword,
        clusterKeywords,
        setIsKeywordSelectionOpen,
        testMode: testMode || false,
        secondaryKeywords,
        pendingOptimization: pendingOptimizationData,
        optimizationFileManagers,
        setPendingOptimization,
        setOptimizationFileManagers: () => {},
        setOptimizationProgress,
        setIsOptimizingContent,
        setBulkOptimizationState,
      });
    },
  };

  const initialUrlStatuses: Record<string, "pending" | "optimizing" | "completed" | "skipped" | "error"> = {};
  urls.forEach((url) => {
    initialUrlStatuses[url] = "pending";
  });

  const bulkPageRanges = contentOptimizerBulkPageRanges(urls.length);
  const bulkUsesPagination = contentOptimizerBulkUsesPagination(urls.length);

  setBulkOptimizationState((prev: any) => {
    const existing = prev[batchKey];
    const batchPrepHarnessSections = waitingBatchPrepHarnessSections();
    const urlHarnessSections =
      existing?.urlHarnessSections ?? buildContentPrepUrlHarnessMap(urls);
    const firstUrl = urls[0]?.trim() ?? "";
    return {
      ...prev,
      [batchKey]: {
        urls,
        currentIndex: 0,
        urlStatuses: initialUrlStatuses,
        currentStep: "Initializing...",
        currentUrl: firstUrl,
        urlKeywords: { ...prefilledUrlKeywords, ...(existing?.urlKeywords || {}) },
        urlSerpResearchReady: {},
        keywordApprovalStatus: undefined,
        warmingUpIndex: null,
        warmingUpIndex2: null,
        researchedUrls: [],
        urlHarnessSections,
        batchPrepHarnessSections,
        currentStepProgress: {
          step: "Initializing...",
          progress: 2,
          message: "Initializing batch…",
          harnessSections: batchPrepHarnessSections,
          harnessPlannedSectionCount: batchPrepHarnessTotalSections,
        },
        ...(bulkUsesPagination
          ? {
              bulkPageSize: CONTENT_OPTIMIZER_BULK_PAGE_SIZE,
              totalBulkPages: bulkPageRanges.length,
              currentBulkPage: 1,
            }
          : {}),
      },
    };
  });

  if (bulkUsesPagination && !muteToasts) {
    notify.info(
      `Processing ${urls.length} targets in ${bulkPageRanges.length} pages of ${CONTENT_OPTIMIZER_BULK_PAGE_SIZE}…`,
    );
  }

  const recordGeneratedFilesForUrl = (siteId: string, url: string) => {
    const fm = optimizationFileManagers[siteId];
    if (!fm) return;
    const files = fm.getFiles();
    if (!files || files.length === 0) return;

    setBulkOptimizationState((prev: any) => {
      const current = prev[batchKey];
      if (!current) return prev;
      return {
        ...prev,
        [batchKey]: {
          ...current,
          urlGeneratedFiles: {
            ...(current.urlGeneratedFiles || {}),
            [url]: files,
          },
        },
      };
    });
  };

  let wordPressPostsForRun = wordPressPosts;
  let wordPressPagesForOfferTable: ReturnType<typeof buildWordPressPagesForLinkingFromInventory> = [];
  type PrepHarnessTarget = { scope: "batch" } | { scope: "post"; sectionIndex: number };

  const prepSectionForStep = (step: string): PrepHarnessTarget | null => {
    const s = step.toLowerCase();
    if (
      s.includes("keyword") ||
      s.includes("focus") ||
      s.includes("inventory") ||
      s.includes("preparing batch") ||
      s.includes("initializ") ||
      s.includes("acf") ||
      s.includes("reading") ||
      s.includes("prefetch") ||
      s.includes("saving keyword") ||
      s.includes("using inventory") ||
      s.includes("loading sitemap") ||
      s.includes("loading site") ||
      s.includes("validat")
    ) {
      return { scope: "batch" };
    }
    if (s.includes("seo research") || s.includes("serp")) return { scope: "post", sectionIndex: 0 };
    if (s.includes("optimiz") || s.includes("generat") || s.includes("content")) {
      return { scope: "post", sectionIndex: 1 };
    }
    return null;
  };

  const markBatchPrepHarnessSectionDone = (
    sectionIndex: number,
    snapshot: BulkOptimizerInventorySnapshot,
    bucket: "posts" | "pages" | "merged" | "entity",
  ) => {
    const markdownSlice =
      bucket === "merged"
        ? buildMergedInventoryHarnessMarkdown(snapshot, site.siteUrl)
        : bucket === "entity"
          ? buildEntityBucketHarnessMarkdown(snapshot, site.siteUrl)
          : buildInventoryBucketHarnessMarkdown(snapshot, site.siteUrl, bucket);
    const rowCount =
      bucket === "merged"
        ? snapshot.postsMaps.byLink.size + snapshot.pagesMaps.byLink.size
        : bucket === "entity"
          ? Object.values(snapshot.customMapsByCollection ?? {}).reduce(
              (n, maps) => n + maps.byLink.size,
              0,
            )
          : bucket === "posts"
            ? snapshot.postsMaps.byLink.size
            : snapshot.pagesMaps.byLink.size;
    setBulkOptimizationState((prev: any) => {
      const current = prev[batchKey];
      if (!current) return prev;
      const waitingSections = waitingBatchPrepHarnessSections();
      const base = current.batchPrepHarnessSections ?? waitingSections;
      const nextSections = applyBatchPrepHarnessPayload(
        base,
        buildBatchPrepHarnessPayload(sectionIndex, "done", markdownSlice, batchPrepSectionTitles),
        waitingSections,
      );
      const doneCount = nextSections.filter((s: { status: string }) => s.status === "done").length;
      return {
        ...prev,
        [batchKey]: {
          ...current,
          batchPrepHarnessSections: nextSections,
          currentStepProgress: {
            ...(current.currentStepProgress || {}),
            harnessSections: nextSections,
            harnessPlannedSectionCount: batchPrepHarnessTotalSections,
          },
        },
      };
    });
  };

  const setBulkStep = (
    step: string,
    _message: string,
    progress = 0,
    opts?: { batchSectionIndex?: number },
  ) => {
    setOptimizationProgress((prev: any) => mergeOptimizationProgress(prev, batchKey, { step, progress, message: "" }));
    setBulkOptimizationState((prev: any) => {
      const current = prev[batchKey];
      if (!current) return prev;
      const activeUrl = (current.currentUrl || urls[current.currentIndex ?? 0] || urls[0] || "").trim();
      const target = prepSectionForStep(step);
      let batchPrepHarnessSections =
        current.batchPrepHarnessSections ?? waitingBatchPrepHarnessSections();
      let urlHarnessSections = current.urlHarnessSections ?? buildContentPrepUrlHarnessMap(urls);
      if (target?.scope === "batch" && opts?.batchSectionIndex !== undefined) {
        const sectionIndex = opts.batchSectionIndex;
        const existingSection = batchPrepHarnessSections.find((s) => s.sectionIndex === sectionIndex);
        if (existingSection?.status !== "done") {
          batchPrepHarnessSections = applyBatchPrepHarnessPayload(
            batchPrepHarnessSections,
            buildBatchPrepHarnessPayload(sectionIndex, "start", undefined, batchPrepSectionTitles),
            waitingBatchPrepHarnessSections(),
          );
        }
      } else if (target?.scope === "post" && activeUrl) {
        const payload = buildPostPrepHarnessPayload(
          current.currentIndex ?? 0,
          target.sectionIndex,
          "start",
        );
        urlHarnessSections = {
          ...urlHarnessSections,
          [activeUrl]: applyPostPrepHarnessPayload(urlHarnessSections[activeUrl], payload),
        };
      }
      const harnessForProgress =
        target?.scope === "post" && activeUrl
          ? urlHarnessSections[activeUrl]
          : batchPrepHarnessSections;
      return {
        ...prev,
        [batchKey]: {
          ...current,
          currentStep: step,
          currentProgress: progress,
          currentStepProgress: {
            step,
            progress,
            message: "",
            harnessSections: harnessForProgress,
            harnessPlannedSectionCount:
              target?.scope === "post"
                ? CONTENT_PREP_POST_HARNESS_TOTAL_SECTIONS
                : batchPrepHarnessTotalSections,
          },
          batchPrepHarnessSections,
          urlHarnessSections,
        },
      };
    });
  };

  const stagingSite = !!optimizationOptions?.stagingSite;

  let linkingInventorySnapshot: BulkOptimizerInventorySnapshot | null = null;

  const buildLinkPoolFromInventory = async (
    bulkSnapshot: BulkOptimizerInventorySnapshot,
    onMsg?: (message: string) => void,
  ): Promise<ReturnType<typeof buildWordPressPostsForLinkingFromInventory>> => {
    if (optimizationOptions?.inventorySitemapSource === "sap") {
      let linkSnapshot = linkingInventorySnapshot;
      const hasLinkRows =
        Boolean(linkSnapshot?.postsMaps.byLink.size) ||
        Boolean(linkSnapshot?.pagesMaps.byLink.size);
      if (!hasLinkRows) {
        const [postsSnap, pagesSnap] = await Promise.all([
          ensurePostsInventoryForHarness(site, onMsg),
          ensurePagesInventoryForHarness(site, onMsg),
        ]);
        linkSnapshot = {
          postsMaps: postsSnap.postsMaps,
          pagesMaps: pagesSnap.pagesMaps,
          customMapsByCollection: {},
        };
      }
      const rows = buildWordPressPostsForLinkingFromInventory(linkSnapshot!, site.siteUrl, {
        postsPagesOnly: true,
      });
      const pageRows = rows.filter((r) => r.postType === "page");
      const postRows = rows.filter((r) => r.postType === "post");
      return [...pageRows, ...postRows];
    }
    return buildWordPressPostsForLinkingFromInventory(bulkSnapshot, site.siteUrl);
  };

  const resolveExtraTextInventoryLinkPool = async (
    snapshot: BulkOptimizerInventorySnapshot | null,
    onMsg?: (message: string) => void,
  ): Promise<{
    snapshot: BulkOptimizerInventorySnapshot | null;
    posts: ReturnType<typeof buildWordPressPostsForLinkingFromInventory>;
  }> => {
    let inv = snapshot;
    if (!inv || !snapshotHasInventoryEntries(inv)) {
      inv = getMergedBulkInventorySessionSnapshot(site.id);
    }
    if (!inv || !snapshotHasInventoryEntries(inv)) {
      inv = await ensureBulkOptimizerInventoryForRun(
        site,
        urls,
        optimizationOptions?.inventorySitemapSource,
        onMsg,
      );
    }
    const posts = inv ? await buildLinkPoolFromInventory(inv, onMsg) : [];
    return { snapshot: inv, posts };
  };

  const runBulkSeoExtraTextAndFinish = async (
    bulkInventorySnapshotForRun: BulkOptimizerInventorySnapshot | null,
    wordPressPostsForExtraText: typeof wordPressPostsForRun,
  ) => {
    if (!optimizationFileManagers[site.id]) {
      const { OptimizationFileManager } = await import("@/lib/optimization-file-manager");
      optimizationFileManagers[site.id] = new OptimizationFileManager();
    }
    try {
      initBulkExtraTextHarnessBatchState({
        site,
        urls,
        urlKeywords: prefilledUrlKeywords,
        setBulkOptimizationState,
        setOptimizationProgress,
        setIsOptimizingContent,
        prepMessage: "Keywords ready — starting bulk extra text…",
      });
      await runBulkSeoExtraTextBatch({
        site,
        urls,
        batchKey,
        muteToasts,
        stagingSite,
        bulkInventorySnapshot: bulkInventorySnapshotForRun,
        prefetchedPendingCache,
        prefetchedAcfFieldsCache,
        prefilledOverviewTargets,
        wordPressPostsForRun: wordPressPostsForExtraText,
        fileManager: optimizationFileManagers[site.id],
        recordGeneratedFilesForUrl,
        setBulkOptimizationState,
        setOptimizationProgress,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[Bulk SEO extra text] Fatal error:", error);
      if (!muteToasts) notify.error(notifyBulkSeoExtraTextFailedX(errorMessage));
    } finally {
      setOptimizingState(setIsOptimizingContent, batchKey, false);
      try {
        const { clearSiteCache } = await import("@/lib/wordpress-site-cache");
        const { clearValidationCache } = await import("@/lib/cached-link-validation");
        const { clearRelevanceCache } = await import("@/lib/content-generation/ai-link-relevance-filter");
        clearSiteCache(site.id);
        clearValidationCache(site.id);
        clearRelevanceCache(site.id);
      } catch (cacheError) {
        console.warn("[Batch Optimization] Error clearing cache:", cacheError);
      }
    }
  };

  const canUseSeoExtraTextFastPath =
    seoExtraTextFieldOnly &&
    useInventoryOnlyPrep &&
    prefilledOverviewTargets &&
    everyUrlHasOverviewFastPathData(urls, prefilledOverviewTargets, prefilledUrlKeywords ?? {});

  if (seoExtraTextFieldOnly && useInventoryOnlyPrep) {
    const gridTargetCount = prefilledOverviewTargets
      ? Object.keys(prefilledOverviewTargets).length
      : 0;
    const hasGridTargets = gridTargetCount > 0;

    setBulkStep(
      "Generating extra text",
      hasGridTargets
        ? `Using ${gridTargetCount} loaded grid row(s). No prep.`
        : "Using session inventory (no ACF re-fetch).",
      10,
    );

    if (hasGridTargets && prefilledOverviewTargets) {
      seedSeoExtraTextCachesFromOverviewTargets(
        urls,
        prefilledOverviewTargets,
        prefilledUrlKeywords ?? {},
        prefetchedPendingCache,
        prefetchedAcfFieldsCache,
      );
      seedBulkUrlKeywordsFromCaches({
        urls,
        batchKey,
        prefetchedAcfFieldsCache,
        setBulkOptimizationState,
      });
      const { snapshot: gridLinkSnapshot, posts: gridLinkPosts } =
        await resolveExtraTextInventoryLinkPool(null, (msg) => {
          setBulkStep("Preparing batch...", msg, 12);
        });
      await runBulkSeoExtraTextAndFinish(gridLinkSnapshot, gridLinkPosts);
      return;
    }

    setBulkStep("Using inventory", "", 8);
    const extraTextSnapshot = await ensureBulkOptimizerInventoryForRun(
      site,
      urls,
      optimizationOptions?.inventorySitemapSource,
      (msg) => setBulkStep("Using inventory", msg, 10),
      { requireBody: false, requireKeyword: false },
    );
    setBulkStep("Using inventory", "", 12);

    assertBulkInventorySnapshotReady(extraTextSnapshot);

    wordPressPostsForRun = await buildLinkPoolFromInventory(extraTextSnapshot, (msg) =>
      setBulkStep("Using inventory", msg, 10),
    );
    if (wordPressPostsForRun.length > 0) {
      seedSiteCacheFromLinkablePosts(site, wordPressPostsForRun);
    }

    if (isAcfKeywordMode && site.username && site.appPassword) {
      seedAllBulkPrefetchCachesFromInventory({
        site,
        urls,
        batchKey,
        bulkInventorySnapshot: extraTextSnapshot,
        updateMode,
        optimizationOptions,
        inContentImageRequest,
        wordPressPostsForRun,
        isAcfKeywordMode,
        prefetchedAcfFieldsCache,
        prefetchedPostPayloadByUrlIndex,
        prefetchedAcfFullPostByUrlIndex,
        prefetchedPendingCache,
        setBulkOptimizationState,
      });
    }

    seedBulkUrlKeywordsFromCaches({
      urls,
      batchKey,
      prefetchedAcfFieldsCache,
      setBulkOptimizationState,
    });

    const extraTextLinkPosts = extraTextSnapshot
      ? await buildLinkPoolFromInventory(extraTextSnapshot, (msg) =>
          setBulkStep("Using inventory", msg, 10),
        )
      : [];
    await runBulkSeoExtraTextAndFinish(extraTextSnapshot, extraTextLinkPosts);
    return;
  }

  let bulkInventorySnapshot: BulkOptimizerInventorySnapshot | null = null;
  const skipUrlSet = new Set<string>();

  try {

  if (useInventoryOnlyPrep) {
    setBulkStep("Using inventory", "Loading site inventory…", 5);
    bulkInventorySnapshot = await ensureBulkOptimizerInventoryForRun(
      site,
      urls,
      inventorySitemapSource ?? (isEntitySapRun ? "sap" : undefined),
      (msg) => setBulkStep("Using inventory", msg, 8),
      { requireBody: false, requireKeyword: false },
    );
    assertBulkInventorySnapshotReady(bulkInventorySnapshot);

    const [postsSnapshot, pagesSnapshot] = await Promise.all([
      ensurePostsInventoryForHarness(site, (msg) =>
        setBulkStep("Using inventory", msg, 10, { batchSectionIndex: 0 }),
      ),
      ensurePagesInventoryForHarness(site, (msg) =>
        setBulkStep("Using inventory", msg, 10, { batchSectionIndex: 1 }),
      ),
    ]);
    linkingInventorySnapshot = {
      postsMaps: postsSnapshot.postsMaps,
      pagesMaps: pagesSnapshot.pagesMaps,
      customMapsByCollection: {},
    };
    markBatchPrepHarnessSectionDone(0, postsSnapshot, "posts");
    markBatchPrepHarnessSectionDone(1, pagesSnapshot, "pages");

    if (prepIncludesEntitySitemap) {
      const sapSnapshot = await ensureSapInventoryForHarness(
        site,
        (msg) => setBulkStep("Using inventory", msg, 10, { batchSectionIndex: 2 }),
        { includeContent: false, includeRawAcf: false },
      );
      markBatchPrepHarnessSectionDone(2, sapSnapshot, "entity");
    }

    if (isEntitySapRun) {
      wordPressPagesForOfferTable = buildWordPressPagesForLinkingFromInventory(
        pagesSnapshot,
        site.siteUrl,
      );
    }

    setBulkStep("Using inventory", "", 12);

    wordPressPostsForRun = await buildLinkPoolFromInventory(bulkInventorySnapshot, (msg) =>
      setBulkStep("Using inventory", msg, 10),
    );
    if (wordPressPostsForRun.length > 0) {
      seedSiteCacheFromLinkablePosts(site, wordPressPostsForRun);
    }

    if (siteHasFlowbieWp(site)) {
      void getSiteMirrorIndex(site).catch((e) => {
        console.warn("[Bulk Optimization] Flowbie WP site index prefetch failed:", e);
      });
    }

    const seedResult = seedAllBulkPrefetchCachesFromInventory({
      site,
      urls,
      batchKey,
      bulkInventorySnapshot,
      updateMode,
      optimizationOptions,
      inContentImageRequest,
      wordPressPostsForRun,
      isAcfKeywordMode,
      prefetchedAcfFieldsCache,
      prefetchedPostPayloadByUrlIndex,
      prefetchedAcfFullPostByUrlIndex,
      prefetchedPendingCache,
      setBulkOptimizationState,
    });
    for (const skippedUrl of Object.keys(seedResult.skippedUrls)) {
      skipUrlSet.add(skippedUrl);
    }

    // Merge Overview-grid cached seo_research into ACF prefetch (no live SERP).
    if (prefilledOverviewTargets) {
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]?.trim();
        if (!url) continue;
        const research = prefilledOverviewTargets[url]?.seoResearch?.trim();
        if (!research) continue;
        const prev = prefetchedAcfFieldsCache.get(i) ?? {};
        if (hasSubstantiveSeoResearch(prev)) continue;
        const next = { ...prev, seo_research: research };
        prefetchedAcfFieldsCache.set(i, next);
        const pending = prefetchedPendingCache.get(i);
        if (pending) {
          prefetchedPendingCache.set(i, {
            ...pending,
            pending: mergeSeoResearchFromAcfIntoContext(next, {
              ...pending.pending,
              keywordFocus: pending.primaryKeyword,
            }),
          });
        }
      }
    }

    // Inventory list often omits large seo_research; backfill from WP so SERP is skipped when research already exists.
    setBulkStep("Using inventory", "Loading existing seo_research…", 14);
    await prefetchBulkAcfFieldsByPostIdForUrls({
      site,
      urls,
      wordPressPostsForRun,
      bulkInventorySnapshot,
      prefetchedAcfFieldsCache,
      prefetchedPostPayloadByUrlIndex,
      prefetchedAcfFullPostByUrlIndex,
      prefetchedPendingCache,
    });

    setBulkStep("Using inventory", "", 16);
  }

  patchBulkPrefetchedPendingLinkPools(
    prefetchedPendingCache,
    wordPressPostsForRun,
    wordPressPagesForOfferTable.length ? wordPressPagesForOfferTable : undefined,
  );

  if (wordPressPostsForRun.length > 0 && !stagingSite && !seoExtraTextFieldOnly) {
    setPendingOptimization((prev: any) => ({
      ...prev,
      wordPressPosts: wordPressPostsForRun,
      wordPressPagesForOfferTable,
    }));
  }

  let siteServiceContext: string | null = null;

  if (!useInventoryOnlyPrep && !seoExtraTextFieldOnly) {
    throw new Error(
      "Bulk content optimization requires WordPress credentials and a loaded inventory snapshot.",
    );
  }

  const prefetchArgsBase = {
    site,
    urls,
    batchKey,
    isAcfKeywordMode,
    updateMode,
    optimizationOptions,
    inContentImageRequest,
    wordPressPostsForRun,
    siteServiceContext,
    bulkInventorySnapshot,
    prefetchedPostPayloadByUrlIndex,
    prefetchedExistingPostByUrlIndex: new Map<number, Record<string, unknown>>(),
    prefetchedAcfFullPostByUrlIndex,
  };

  const setBulkPageState = (page: number) => {
    if (!bulkUsesPagination) return;
    setBulkOptimizationState((prev: any) => {
      const current = prev[batchKey];
      if (!current) return prev;
      return {
        ...prev,
        [batchKey]: {
          ...current,
          currentBulkPage: page,
          totalBulkPages: bulkPageRanges.length,
          bulkPageSize: CONTENT_OPTIMIZER_BULK_PAGE_SIZE,
        },
      };
    });
  };

  const pageProgressLabel = (start: number, end: number, page: number, pageCount: number) =>
    bulkUsesPagination
      ? `Page ${page}/${pageCount}: targets ${start + 1}–${end} of ${urls.length}`
      : `${urls.length} targets`;

  seedBulkUrlKeywordsFromCaches({
    urls,
    batchKey,
    prefetchedAcfFieldsCache,
    setBulkOptimizationState,
  });

  setBulkOptimizationState((prev: any) => {
    const current = prev[batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [batchKey]: {
        ...current,
        keywordApprovalStatus: "approved",
        currentStep: "Starting optimization...",
        currentStepProgress: {
          step: "Starting optimization...",
          progress: 16,
          message: "Inventory loaded — starting content optimization…",
        },
      },
    };
  });

  if (seoExtraTextFieldOnly) {
    await runBulkSeoExtraTextAndFinish(bulkInventorySnapshot, wordPressPostsForRun);
    return;
  }


  const serpHarnessSetters: ContentPrepHarnessSetters = {
    siteId: site.id,
    batchKey,
    setBulkOptimizationState,
    setOptimizationProgress,
  };

  const serpWarmup = createBulkSerpWarmupController({
    urls,
    batchKey,
    skipUrlSet,
    muteToasts,
    prefetchedAcfFieldsCache,
    prefetchedPendingCache,
    setBulkOptimizationState,
    harnessSetters: serpHarnessSetters,
  });
  serpWarmup.seedReadyFromAcf();

  const googleMapsImageWarmup = bulkSapGoogleMapsImageWarmupEnabled(optimizationOptions)
    ? createBulkGoogleMapsImageWarmupController({
        urls,
        skipUrlSet,
        prefetchedAcfFieldsCache,
        prefetchedPendingCache,
      })
    : null;

  for (const { start, end, page, pageCount } of bulkPageRanges) {
      const indexRange = { start, end };
      setBulkPageState(page);

      if (bulkRunCancelRequested(batchKey, setBulkOptimizationState)) {
        break;
      }

      if (isAcfKeywordMode && !seoExtraTextFieldOnly) {
        seedBulkUrlSerpResearchReadyFromAcfCache({
          urls,
          batchKey,
          prefetchedAcfFieldsCache,
          setBulkOptimizationState,
        });
      }

      setBulkStep(
        "SEO research…",
        `${pageProgressLabel(start, end, page, pageCount)}: SERP warmup (2-post buffer)…`,
        18,
      );

      setBulkOptimizationState((prev: any) => {
        const current = prev[batchKey];
        if (!current) return prev;
        return {
          ...prev,
          [batchKey]: {
            ...current,
            currentStep: "Starting optimization...",
            currentProgress: 0,
            currentStepProgress: {
              step: "Starting optimization...",
              progress: 5,
              message: bulkUsesPagination
                ? `${pageProgressLabel(start, end, page, pageCount)}: optimizing…`
                : "Using ACF keyword_focus + seo_research.",
            },
            keywordApprovalStatus: "approved",
          },
        };
      });

      await bulkOptimizationRunPostLoop({
        urls,
        rangeStart: start,
        rangeEnd: end,
        skipUrlSet,
        batchKey,
        site,
        muteToasts,
        isAcfKeywordMode,
        prefetchedPendingCache,
        prefetchedAcfFieldsCache,
        pendingOptimizationData,
        optimizationFileManagers,
        bulkContinueOptimizationRef,
        bulkContextRef,
        setBulkOptimizationState,
        setOptimizationProgress,
        recordGeneratedFilesForUrl,
        serpWarmup,
        googleMapsImageWarmup,
        wordPressPostsForRun,
        wordPressPagesForOfferTable,
        prefetchArgs: {
          ...prefetchArgsBase,
          prefetchedAcfFieldsCache,
          prefetchedPendingCache,
          setBulkOptimizationState,
        },
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Batch Optimization] Fatal error:", error);
    if (!muteToasts) notify.error(errorMessage, { duration: 12000 });
  } finally {
    setOptimizingState(setIsOptimizingContent, batchKey, false);

    // Link-validation cache is intentionally retained across URLs for the batch; clears run here (and on cancel above), not inside bulkOptimizationRunPostLoop.
    try {
      const { clearSiteCache } = await import("@/lib/wordpress-site-cache");
      const { clearValidationCache } = await import("@/lib/cached-link-validation");
      const { clearRelevanceCache } = await import("@/lib/content-generation/ai-link-relevance-filter");
      clearSiteCache(site.id);
      clearValidationCache(site.id);
      clearRelevanceCache(site.id);
    } catch (cacheError) {
      console.warn("[Batch Optimization] Error clearing cache:", cacheError);
    }
    clearGoogleMapsImageSessionCache();
  }
}
