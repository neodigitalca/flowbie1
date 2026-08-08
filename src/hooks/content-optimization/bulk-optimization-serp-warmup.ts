import {
  applyBriefToCaches,
  fetchDataForSeoSerpBriefJson,
  hasSubstantiveSeoResearch,
} from "./bulk-optimization-missing-seo-research";
import { pageGscQueryStringsFromPending } from "./bulk-optimization-prefetch-page-gsc";
import { readKeywordFocusFromAcfFields } from "@/lib/content-generation/ai-driven-acf-reader";
import type { HandleOptimizeMultipleContentParams } from "./bulk-optimization-params";
import {
  markContentPrepHarnessSection,
  type ContentPrepHarnessSetters,
} from "@/lib/overview/overview-content-prep-harness-run";

/** Always keep SERP research this many posts ahead of the active optimization index. */
export const BULK_SERP_WARMUP_BUFFER_AHEAD = 2;

export type BulkSerpWarmupController = ReturnType<typeof createBulkSerpWarmupController>;

export type CreateBulkSerpWarmupParams = {
  urls: string[];
  batchKey: string;
  skipUrlSet: Set<string>;
  muteToasts: boolean;
  prefetchedAcfFieldsCache: Map<number, Record<string, unknown>>;
  prefetchedPendingCache: Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>;
  setBulkOptimizationState: HandleOptimizeMultipleContentParams["setBulkOptimizationState"];
  harnessSetters?: ContentPrepHarnessSetters;
};

function bulkCancelled(
  batchKey: string,
  setBulkOptimizationState: CreateBulkSerpWarmupParams["setBulkOptimizationState"],
): boolean {
  let cancelled = false;
  setBulkOptimizationState((prev: Record<string, unknown>) => {
    const current = (prev as Record<string, { cancelRequested?: boolean }>)[batchKey];
    if (current?.cancelRequested) cancelled = true;
    return prev;
  });
  return cancelled;
}

export function createBulkSerpWarmupController(params: CreateBulkSerpWarmupParams) {
  const {
    urls,
    batchKey,
    skipUrlSet,
    muteToasts,
    prefetchedAcfFieldsCache,
    prefetchedPendingCache,
    setBulkOptimizationState,
    harnessSetters,
  } = params;

  const inFlight = new Map<number, Promise<boolean>>();
  const readyIndices = new Set<number>();

  const keywordFor = (index: number): string | null => {
    const acfKw = readKeywordFocusFromAcfFields(
      prefetchedAcfFieldsCache.get(index) as Record<string, unknown> | undefined,
    );
    return acfKw.trim() || null;
  };

  /** If ACF has no keyword_focus, fail fast. Bulk prep requires keyword_focus on every target. */
  const ensureKeywordForIndex = async (index: number): Promise<string> => {
    const existing = keywordFor(index);
    if (existing) return existing;
    const url = urls[index];
    throw new Error(`ACF keyword_focus is required before SERP warmup (${url ?? `index ${index}`}).`);
  };

  const isIndexReady = (index: number): boolean => {
    if (index < 0 || index >= urls.length) return false;
    if (readyIndices.has(index)) return true;
    if (skipUrlSet.has(urls[index]!)) return true;
    return hasSubstantiveSeoResearch(prefetchedAcfFieldsCache.get(index));
  };

  const markUrlSerpReady = (index: number, reason: "existing" | "filled" | "skipped" = "existing") => {
    const url = urls[index];
    if (!url) return;
    const alreadyReady = readyIndices.has(index);
    readyIndices.add(index);
    if (
      !alreadyReady &&
      reason === "existing" &&
      hasSubstantiveSeoResearch(prefetchedAcfFieldsCache.get(index))
    ) {
    }
    setBulkOptimizationState((prev: Record<string, unknown>) => {
      const current = (prev as Record<string, Record<string, unknown>>)[batchKey];
      if (!current) return prev;
      const researchedUrls = Array.isArray(current.researchedUrls)
        ? [...(current.researchedUrls as string[])]
        : [];
      if (!researchedUrls.includes(url)) researchedUrls.push(url);
      return {
        ...prev,
        [batchKey]: {
          ...current,
          urlSerpResearchReady: {
            ...((current.urlSerpResearchReady as Record<string, boolean>) || {}),
            [url]: true,
          },
          researchedUrls,
        },
      };
    });
    if (harnessSetters) {
      markContentPrepHarnessSection(url, 0, "done", harnessSetters, index);
    }
  };

  const setWarmingIndices = (indices: number[]) => {
    const warmingUpIndex = indices[0] ?? null;
    const warmingUpIndex2 = indices[1] ?? null;
    setBulkOptimizationState((prev: Record<string, unknown>) => {
      const current = (prev as Record<string, Record<string, unknown>>)[batchKey];
      if (!current) return prev;
      return {
        ...prev,
        [batchKey]: {
          ...current,
          warmingUpIndex,
          warmingUpIndex2,
        },
      };
    });
  };

  const warmIndex = (index: number): Promise<boolean> => {
    if (index < 0 || index >= urls.length) return Promise.resolve(false);
    if (skipUrlSet.has(urls[index]!)) return Promise.resolve(false);
    if (isIndexReady(index)) {
      markUrlSerpReady(index);
      return Promise.resolve(true);
    }
    const existing = inFlight.get(index);
    if (existing) return existing;

    const run = (async () => {
      if (bulkCancelled(batchKey, setBulkOptimizationState)) return false;
      const url = urls[index]!;
      let keyword: string;
      try {
        keyword = await ensureKeywordForIndex(index);
      } catch (err) {
        throw err;
      }
      if (harnessSetters) {
        markContentPrepHarnessSection(url, 0, "active", harnessSetters, index);
      }
      const brief = await fetchDataForSeoSerpBriefJson({
        keyword,
        pageUrl: url,
        muteToasts,
        gscQueries: pageGscQueryStringsFromPending(prefetchedPendingCache.get(index)?.pending),
      });
      if (bulkCancelled(batchKey, setBulkOptimizationState)) return false;
      if (!brief) {
        if (harnessSetters) {
          markContentPrepHarnessSection(url, 0, "error", harnessSetters, index);
        }
        return false;
      }
      applyBriefToCaches(index, brief, prefetchedAcfFieldsCache, prefetchedPendingCache);
      markUrlSerpReady(index, "filled");
      return true;
    })().finally(() => {
      inFlight.delete(index);
    });

    inFlight.set(index, run);
    return run;
  };

  const ensureReady = async (index: number): Promise<boolean> => {
    const cached = isIndexReady(index);
    if (cached) {
      markUrlSerpReady(index);
      return true;
    }
    return warmIndex(index);
  };

  /** Start SERP warmup for the next two posts (no content optimization). */
  const maintainBuffer = (optimizingIndex: number): void => {
    const warming: number[] = [];
    for (let offset = 1; offset <= BULK_SERP_WARMUP_BUFFER_AHEAD; offset++) {
      const nextIndex = optimizingIndex + offset;
      if (nextIndex >= urls.length) continue;
      if (skipUrlSet.has(urls[nextIndex]!)) continue;
      warming.push(nextIndex);
      if (!isIndexReady(nextIndex) && !inFlight.has(nextIndex)) {
        void warmIndex(nextIndex);
      }
    }
    setWarmingIndices(warming);
  };

  const seedReadyFromAcf = (): void => {
    for (let i = 0; i < urls.length; i++) {
      if (hasSubstantiveSeoResearch(prefetchedAcfFieldsCache.get(i))) {
        markUrlSerpReady(i);
      }
    }
  };

  const clearWarmingIndices = (): void => {
    setWarmingIndices([]);
  };

  return {
    ensureReady,
    maintainBuffer,
    seedReadyFromAcf,
    clearWarmingIndices,
    isIndexReady,
  };
}
