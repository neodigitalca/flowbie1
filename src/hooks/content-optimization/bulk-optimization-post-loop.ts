import { notify } from "@/lib/app-notifications";
import { notifyBatchOptimizationCompleteProcessedX, notifyCompletedOptimizationForPostXOfX } from "@/lib/notify-messages";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import { getStepProgress, mergeOptimizationProgress, updateBulkProgress } from "./optimization-helpers";
import { updateBulkStateForPost } from "./bulk-optimization-update-bulk-state";
import type { WordPressSite } from "@/components/integrations/types";
import type { HandleOptimizeMultipleContentParams } from "./bulk-optimization-params";
import type { BulkDoPrefetchArgs } from "./bulk-optimization-do-prefetch";
import type { BulkSerpWarmupController } from "./bulk-optimization-serp-warmup";
import type { BulkGoogleMapsImageWarmupController } from "./bulk-optimization-google-maps-image-warmup";

export interface BulkPostLoopParams {
  urls: string[];
  /** Inclusive start index into `urls` (default 0). */
  rangeStart?: number;
  /** Exclusive end index into `urls` (default urls.length). */
  rangeEnd?: number;
  skipUrlSet: Set<string>;
  batchKey: string;
  site: WordPressSite;
  muteToasts: boolean;
  isAcfKeywordMode: boolean;
  prefetchedPendingCache: Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>;
  prefetchedAcfFieldsCache: Map<number, Record<string, any>>;
  pendingOptimizationData: Record<string, any>;
  wordPressPostsForRun?: Array<Record<string, unknown>>;
  wordPressPagesForOfferTable?: Array<{
    id: number;
    slug: string;
    title: string;
    excerpt: string;
    link: string;
    date_gmt: string;
  }>;
  optimizationFileManagers: Record<string, OptimizationFileManager>;
  bulkContinueOptimizationRef: {
    current:
      | ((
          siteId: string,
          selectedKeyword: any,
          clusterKeywords?: string[],
          setIsKeywordSelectionOpen?: (prev: any) => any,
          testMode?: boolean,
          secondaryKeywords?: string[]
        ) => Promise<void>)
      | null;
  };
  bulkContextRef: { current: { bulkIndex: number; totalBulkUrls: number; batchKey: string } | null };
  setBulkOptimizationState: HandleOptimizeMultipleContentParams["setBulkOptimizationState"];
  setOptimizationProgress: HandleOptimizeMultipleContentParams["setOptimizationProgress"];
  recordGeneratedFilesForUrl: (siteId: string, url: string) => void;
  serpWarmup: BulkSerpWarmupController;
  googleMapsImageWarmup?: BulkGoogleMapsImageWarmupController | null;
  prefetchArgs: Omit<BulkDoPrefetchArgs, "prefetchedAcfFieldsCache" | "prefetchedPendingCache" | "setBulkOptimizationState"> & {
    prefetchedAcfFieldsCache: Map<number, Record<string, any>>;
    prefetchedPendingCache: Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>;
    setBulkOptimizationState: HandleOptimizeMultipleContentParams["setBulkOptimizationState"];
  };
}

export async function bulkOptimizationRunPostLoop(p: BulkPostLoopParams): Promise<void> {
  const {
    urls,
    rangeStart = 0,
    rangeEnd = urls.length,
    skipUrlSet,
    batchKey,
    site,
    muteToasts,
    prefetchedPendingCache,
    prefetchedAcfFieldsCache,
    pendingOptimizationData,
    wordPressPostsForRun,
    wordPressPagesForOfferTable,
    optimizationFileManagers,
    bulkContinueOptimizationRef,
    bulkContextRef,
    setBulkOptimizationState,
    setOptimizationProgress,
    recordGeneratedFilesForUrl,
    serpWarmup,
    googleMapsImageWarmup,
  } = p;

  const runCount = Math.max(0, rangeEnd - rangeStart);
  let batchFailedCount = 0;
  let firstBatchFailureMsg = "";

  const recordBatchFailure = (msg: string) => {
    batchFailedCount += 1;
    if (!firstBatchFailureMsg) firstBatchFailureMsg = msg;
  };

  if (!muteToasts && runCount > 0) {
    notify.info(
      rangeStart === 0 && rangeEnd === urls.length
        ? `Starting optimization of ${urls.length} posts...`
        : `Optimizing targets ${rangeStart + 1}–${rangeEnd} of ${urls.length}…`,
    );
  }

  if (rangeStart < rangeEnd) {
    serpWarmup.maintainBuffer(rangeStart);
    googleMapsImageWarmup?.maintainBuffer(rangeStart);
  }

  const fileManagersByIndex = new Map<number, OptimizationFileManager>();

  const recordGeneratedFilesForIndex = (index: number, url: string) => {
    const fm = fileManagersByIndex.get(index);
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

  for (let i = rangeStart; i < rangeEnd; i++) {
    const url = urls[i]!;

    let cancelNow = false;
    setBulkOptimizationState((prev: any) => {
      const current = prev[batchKey];
      if (current?.cancelRequested) cancelNow = true;
      return prev;
    });
    if (cancelNow) {
      setOptimizationProgress((prev: any) =>
        mergeOptimizationProgress(prev, batchKey, {
          step: "Aborted",
          progress: 100,
          message: "Operation aborted by user.",
        }),
      );
      setBulkOptimizationState((prev: any) => {
        const current = prev[batchKey];
        if (!current) return prev;
        return {
          ...prev,
          [batchKey]: {
            ...current,
            currentStep: "Aborted",
            warmingUpIndex: null,
            warmingUpIndex2: null,
          },
        };
      });
      break;
    }

    if (skipUrlSet.has(url)) {
      updateBulkStateForPost(setBulkOptimizationState, batchKey, url, i, i + 1, urls.length, "skipped");
      continue;
    }

    serpWarmup.maintainBuffer(i);
    googleMapsImageWarmup?.maintainBuffer(i);
    void googleMapsImageWarmup?.warmIndex(i);
    // Never skip research: await SERP fill (or URL-derived keyword + SERP) before optimizing.
    await serpWarmup.ensureReady(i);

    if (!prefetchedPendingCache.has(i)) {
      const msg = `Missing prefetch for target ${i + 1}; bulk prep should have loaded inventory first.`;
      console.error(`[Batch Optimization] ${msg}`, url);
      if (!muteToasts) notify.error(msg);
      recordBatchFailure(msg);
      setBulkOptimizationState((prev: any) => {
        const current = prev[batchKey];
        if (!current) return prev;
        return {
          ...prev,
          [batchKey]: {
            ...current,
            urlStatuses: { ...(current.urlStatuses || {}), [url]: "error" },
            urlSkipReasons: { ...(current.urlSkipReasons || {}), [url]: msg },
          },
        };
      });
      updateBulkStateForPost(setBulkOptimizationState, batchKey, url, i, i + 1, urls.length, "error");
      continue;
    }

    const currentPost = i + 1;
    const totalPosts = urls.length;
    bulkContextRef.current = { bulkIndex: i, totalBulkUrls: urls.length, batchKey };

    updateBulkStateForPost(setBulkOptimizationState, batchKey, url, i, currentPost, totalPosts, "optimizing");

    setOptimizationProgress((prev: any) =>
      mergeOptimizationProgress(prev, batchKey, {
        step: `Optimizing post ${currentPost} of ${totalPosts}...`,
        progress: Math.round((i / totalPosts) * 100),
        message: url,
      }),
    );

    let progressInterval: ReturnType<typeof setInterval> | undefined;
    progressInterval = setInterval(() => {
      setOptimizationProgress((current: any) => {
        const siteProgress = current[site.id];
        if (siteProgress) {
          const stepProgress = getStepProgress(siteProgress.step);
          updateBulkProgress(
            setBulkOptimizationState,
            batchKey,
            url,
            siteProgress.step,
            stepProgress,
            siteProgress.message,
            siteProgress.linkCheckResults,
            Array.isArray(siteProgress.harnessSections)
              ? {
                  harnessSections: siteProgress.harnessSections,
                  harnessPlannedSectionCount: siteProgress.harnessPlannedSectionCount ?? null,
                }
              : undefined,
            i,
          );
          recordGeneratedFilesForIndex(i, url);
        }
        return current;
      });
    }, 500);

    try {
      const fullCached = !!prefetchedPendingCache.get(i);
      const hasManualKeyword = false;
      if (fullCached && !hasManualKeyword) {
        const { pending: cachedPending, primaryKeyword: cachedKeyword } = prefetchedPendingCache.get(i)!;
        if (!bulkContinueOptimizationRef.current) {
          throw new Error("Bulk continue optimization handler is not ready.");
        }
        Object.assign(pendingOptimizationData, {
          [site.id]: {
            ...cachedPending,
            ...(wordPressPostsForRun?.length ? { wordPressPosts: wordPressPostsForRun } : {}),
            ...(wordPressPagesForOfferTable?.length
              ? { wordPressPagesForOfferTable }
              : {}),
            bulkIndex: i,
            totalBulkUrls: urls.length,
            batchKey,
          },
        });
        const fileManager = new OptimizationFileManager();
        fileManagersByIndex.set(i, fileManager);
        optimizationFileManagers[site.id] = fileManager;

        await bulkContinueOptimizationRef.current(
          site.id,
          { query: cachedKeyword, clicks: 0, impressions: 0, ctr: 0, position: 0 },
        );
        recordGeneratedFilesForIndex(i, url);
        if (progressInterval) clearInterval(progressInterval);
        updateBulkStateForPost(setBulkOptimizationState, batchKey, url, i, currentPost, totalPosts, "completed");
        if (!muteToasts) notify.success(notifyCompletedOptimizationForPostXOfX(currentPost, totalPosts));
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      if (progressInterval) clearInterval(progressInterval);
      const msg = `Could not run bulk optimization for post ${currentPost}: missing WordPress/ACF prefetch.`;
      console.error(`[Batch Optimization] ${msg}`, url);
      if (!muteToasts) notify.error(msg);
      recordBatchFailure(msg);
      setBulkOptimizationState((prev: any) => {
        const current = prev[batchKey];
        if (!current) return prev;
        return {
          ...prev,
          [batchKey]: {
            ...current,
            urlSkipReasons: { ...(current.urlSkipReasons || {}), [url]: msg },
          },
        };
      });
      updateBulkStateForPost(setBulkOptimizationState, batchKey, url, i, currentPost, totalPosts, "error");
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (progressInterval) {
        clearInterval(progressInterval);
      }

      console.error(`[Batch Optimization] Error optimizing post ${currentPost} (${url}):`, error);
      if (!muteToasts) notify.error(`Post ${currentPost} failed: ${errorMessage}`, { duration: 12000 });
      recordBatchFailure(errorMessage);
      setBulkOptimizationState((prev: any) => {
        const current = prev[batchKey];
        if (!current) return prev;
        return {
          ...prev,
          [batchKey]: {
            ...current,
            urlSkipReasons: { ...(current.urlSkipReasons || {}), [url]: errorMessage },
          },
        };
      });
      updateBulkStateForPost(setBulkOptimizationState, batchKey, url, i, currentPost, totalPosts, "error");
    }
  }

  setOptimizationProgress((prev: any) =>
    mergeOptimizationProgress(prev, batchKey, {
      step: batchFailedCount > 0 ? "Batch finished with errors" : "Batch optimization complete",
      progress: 100,
      message:
        batchFailedCount > 0
          ? `${batchFailedCount} of ${urls.length} targets failed`
          : `Successfully processed ${urls.length} posts`,
    }),
  );

  serpWarmup.clearWarmingIndices();
  setBulkOptimizationState((prev: any) => {
    const current = prev[batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [batchKey]: {
        ...current,
        currentStep: "Batch complete",
        currentIndex: urls.length,
        warmingUpIndex: null,
        warmingUpIndex2: null,
        researchedUrls: [],
      },
    };
  });
  bulkContextRef.current = null;

  if (!muteToasts) {
    if (batchFailedCount > 0) {
      notify.error(
        `${batchFailedCount} of ${urls.length} targets failed: ${firstBatchFailureMsg}`,
        { duration: 12000 },
      );
    } else {
      notify.success(notifyBatchOptimizationCompleteProcessedX(urls.length));
    }
  }
}
