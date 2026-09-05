import { describe, expect, it, vi } from "vitest";
import { bulkOptimizationRunPostLoop } from "../bulk-optimization-post-loop";
import type { WordPressSite } from "@/components/integrations/types";

vi.mock("../bulk-optimization-do-prefetch", () => ({
  bulkOptimizationDoPrefetch: vi.fn().mockResolvedValue(undefined),
}));

import { bulkOptimizationDoPrefetch } from "../bulk-optimization-do-prefetch";

const site: WordPressSite = {
  id: "site-1",
  name: "Test",
  siteUrl: "https://example.com",
  username: "u",
  appPassword: "p",
};

function makePending(url: string) {
  return {
    pending: {
      site,
      url,
      existingTitle: "Title",
      existingContent: "<p>Body</p>",
      optimizationOptions: { optimizeContent: true, hasEntity: false },
    },
    primaryKeyword: "test keyword",
  };
}

describe("bulkOptimizationRunPostLoop halt on failure", () => {
  it("halts after prefetch miss when inline prefetch does not populate cache", async () => {
    vi.mocked(bulkOptimizationDoPrefetch).mockResolvedValue(undefined);
    const urls = ["https://example.com/a/", "https://example.com/b/"];
    const prefetchedPendingCache = new Map<number, ReturnType<typeof makePending>>([
      [1, makePending(urls[1]!)],
    ]);
    const continueFn = vi.fn().mockResolvedValue(undefined);

    await bulkOptimizationRunPostLoop({
      urls,
      skipUrlSet: new Set(),
      batchKey: "site-1-batch",
      site,
      muteToasts: true,
      isAcfKeywordMode: true,
      prefetchedPendingCache,
      prefetchedAcfFieldsCache: new Map(),
      pendingOptimizationData: {},
      optimizationFileManagers: {},
      bulkContinueOptimizationRef: { current: continueFn },
      bulkContextRef: { current: null },
      setBulkOptimizationState: vi.fn((fn) => fn({ "site-1-batch": { urls } })),
      setOptimizationProgress: vi.fn((fn) => fn({})),
      recordGeneratedFilesForUrl: vi.fn(),
      serpWarmup: {
        maintainBuffer: vi.fn(),
        ensureReady: vi.fn(),
        clearWarmingIndices: vi.fn(),
      },
      prefetchArgs: {
        site,
        urls,
        batchKey: "site-1-batch",
        isAcfKeywordMode: true,
        updateMode: "draft",
        optimizationOptions: { optimizeContent: true, hasEntity: false },
        inContentImageRequest: null,
        wordPressPostsForRun: [],
        siteServiceContext: null,
        prefetchedAcfFieldsCache: new Map(),
        prefetchedPostPayloadByUrlIndex: new Map(),
        prefetchedPendingCache,
        setBulkOptimizationState: vi.fn(),
        bulkInventorySnapshot: null,
      },
    });

    expect(continueFn).not.toHaveBeenCalled();
    expect(bulkOptimizationDoPrefetch).toHaveBeenCalledWith(0, expect.any(Object));
  });

  it("halts after a pipeline error without running the next URL", async () => {
    const urls = ["https://example.com/a/", "https://example.com/b/"];
    const prefetchedPendingCache = new Map<number, ReturnType<typeof makePending>>([
      [0, makePending(urls[0]!)],
      [1, makePending(urls[1]!)],
    ]);
    const continueFn = vi.fn().mockRejectedValueOnce(new Error("Blueprint failed"));

    await bulkOptimizationRunPostLoop({
      urls,
      skipUrlSet: new Set(),
      batchKey: "site-1-batch",
      site,
      muteToasts: true,
      isAcfKeywordMode: true,
      prefetchedPendingCache,
      prefetchedAcfFieldsCache: new Map(),
      pendingOptimizationData: {},
      optimizationFileManagers: {},
      bulkContinueOptimizationRef: { current: continueFn },
      bulkContextRef: { current: null },
      setBulkOptimizationState: vi.fn((fn) => fn({ "site-1-batch": { urls } })),
      setOptimizationProgress: vi.fn((fn) => fn({})),
      recordGeneratedFilesForUrl: vi.fn(),
      serpWarmup: {
        maintainBuffer: vi.fn(),
        ensureReady: vi.fn(),
        clearWarmingIndices: vi.fn(),
      },
      prefetchArgs: {
        site,
        urls,
        batchKey: "site-1-batch",
        isAcfKeywordMode: true,
        updateMode: "draft",
        optimizationOptions: { optimizeContent: true, hasEntity: false },
        inContentImageRequest: null,
        wordPressPostsForRun: [],
        siteServiceContext: null,
        prefetchedAcfFieldsCache: new Map(),
        prefetchedPostPayloadByUrlIndex: new Map(),
        prefetchedPendingCache,
        setBulkOptimizationState: vi.fn(),
        bulkInventorySnapshot: null,
      },
    });

    expect(continueFn).toHaveBeenCalledTimes(1);
  });
});
