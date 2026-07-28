import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import {
  buildPrefilledTargetsFromOverviewRows,
  everyUrlHasOverviewFastPathData,
  lookupOverviewInventoryHitForUrl,
  seedSeoExtraTextCachesFromOverviewTargets,
  wordPressPostsFromInventorySnapshot,
} from "../bulk-seo-extra-text-fast-path";
import { buildInventoryLookupMaps } from "@/lib/wordpress-api/inventory-match";
import type { SitePostInventoryRow } from "@/lib/wordpress-api/types";
import { setBulkInventorySessionSnapshot } from "@/lib/wordpress-bulk-inventory-session-cache";

const runBulkSeoExtraTextBatch = vi.fn();
const loadBulkOptimizerInventorySnapshot = vi.fn();

vi.mock("../bulk-seo-extra-text-run", () => ({
  runBulkSeoExtraTextBatch: (...args: unknown[]) => runBulkSeoExtraTextBatch(...args),
}));

vi.mock("../bulk-seo-extra-text-harness", () => ({
  initBulkExtraTextHarnessBatchState: vi.fn(),
}));

vi.mock("../bulk-optimization-load-inventory-snapshot", () => ({
  loadBulkOptimizerInventorySnapshot: (...args: unknown[]) =>
    loadBulkOptimizerInventorySnapshot(...args),
}));

function testSite(): WordPressSite {
  return {
    id: "site-1",
    name: "Test",
    siteUrl: "https://example.com",
    username: "user",
    appPassword: "pass",
    connectedAt: Date.now(),
  } as WordPressSite;
}

describe("bulk-seo-extra-text-fast-path helpers", () => {
  it("everyUrlHasOverviewFastPathData requires postId and keyword for every URL", () => {
    const urls = ["https://example.com/a/", "https://example.com/b/"];
    const targets = {
      "https://example.com/a/": { postId: 1, keyword: "alpha" },
      "https://example.com/b/": { postId: 2, keyword: "beta" },
    };
    expect(everyUrlHasOverviewFastPathData(urls, targets, {})).toBe(true);
    expect(
      everyUrlHasOverviewFastPathData(
        urls,
        { "https://example.com/a/": { postId: 1 } },
        { "https://example.com/b/": "beta" },
      ),
    ).toBe(false);
  });

  it("seedSeoExtraTextCachesFromOverviewTargets fills pending and ACF caches", () => {
    const urls = ["https://example.com/page/"];
    const targets = {
      "https://example.com/page/": {
        postId: 42,
        postType: "page",
        postTypeEndpoint: "pages",
        keyword: "widgets",
        content: "<p>Hello</p>",
      },
    };
    const pending = new Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>();
    const acf = new Map<number, Record<string, unknown>>();

    seedSeoExtraTextCachesFromOverviewTargets(urls, targets, {}, pending, acf);

    expect(pending.get(0)?.primaryKeyword).toBe("widgets");
    expect(acf.get(0)?.keyword_focus).toBe("widgets");
    expect((pending.get(0)?.pending.existingPost as { id: number }).id).toBe(42);
  });

  it("wordPressPostsFromInventorySnapshot builds link list from snapshot maps", () => {
    const row: SitePostInventoryRow = {
      id: 7,
      slug: "about",
      url: "https://example.com/about/",
      fields: { title: "About Us", excerpt: "", content: "" },
    };
    const snapshot = {
      postsMaps: buildInventoryLookupMaps([], "https://example.com"),
      pagesMaps: buildInventoryLookupMaps([row], "https://example.com"),
    };
    const posts = wordPressPostsFromInventorySnapshot(snapshot);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.link).toBe("https://example.com/about/");
    expect(posts[0]?.title).toBe("About Us");
  });

  it("buildPrefilledTargetsFromOverviewRows matches CPT rows from page-bucket snapshot", () => {
    const site = testSite();
    const cptRow: SitePostInventoryRow = {
      id: 99,
      slug: "winnipeg-blinds",
      url: "https://example.com/winnipeg-blinds/",
      fields: { title: "Winnipeg", keyword: "", content: "<p>Body</p>", excerpt: "" },
    };
    const snapshot = {
      postsMaps: buildInventoryLookupMaps([], site.siteUrl),
      pagesMaps: buildInventoryLookupMaps([], site.siteUrl),
      customMapsByCollection: {
        "service-area": buildInventoryLookupMaps([cptRow], site.siteUrl),
      },
    };
    setBulkInventorySessionSnapshot(site.id, "pages", snapshot);

    const rows = [
      {
        url: "https://example.com/winnipeg-blinds/",
        title: "Winnipeg",
        metaDescription: "",
        aiTitle: "",
        aiMeta: "",
        status: "idle" as const,
        focusKeyword: "winnipeg blinds",
      },
    ];

    const { prefilledOverviewTargets } = buildPrefilledTargetsFromOverviewRows(
      rows,
      {},
      () => undefined,
      site,
      "pages",
    );

    expect(prefilledOverviewTargets["https://example.com/winnipeg-blinds/"]?.postId).toBe(99);
    expect(lookupOverviewInventoryHitForUrl(site, "https://example.com/winnipeg-blinds/", "pages")?.row.id).toBe(
      99,
    );
  });
});

describe("handleOptimizeMultipleContent seo extra text fast path", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    runBulkSeoExtraTextBatch.mockReset();
    runBulkSeoExtraTextBatch.mockResolvedValue(undefined);
    loadBulkOptimizerInventorySnapshot.mockReset();
  });

  it("skips loadBulkOptimizerInventorySnapshot when session snapshot exists", async () => {
    const { setBulkInventorySessionSnapshot } = await import(
      "@/lib/wordpress-bulk-inventory-session-cache"
    );
    const { handleOptimizeMultipleContent } = await import("../bulk-optimization");

    const row: SitePostInventoryRow = {
      id: 10,
      slug: "a",
      url: "https://example.com/a/",
      fields: { title: "A", keyword: "kw a", content: "", excerpt: "" },
    };
    const snapshot = {
      postsMaps: buildInventoryLookupMaps([], "https://example.com"),
      pagesMaps: buildInventoryLookupMaps([row], "https://example.com"),
    };
    setBulkInventorySessionSnapshot("site-1", "pages", snapshot);

    const setBulkOptimizationState = vi.fn((updater: (prev: Record<string, unknown>) => unknown) => {
      if (typeof updater === "function") updater({});
    });

    await handleOptimizeMultipleContent({
      site: testSite(),
      urls: ["https://example.com/a/"],
      updateMode: "update",
      setGscQueriesForSelection: vi.fn(),
      setIsKeywordSelectionOpen: vi.fn(),
      setGscClusterAnalysis: vi.fn(),
      setIsAnalyzingClusters: vi.fn(),
      optimizationOptions: { seoExtraTextFieldOnly: true },
      setIsOptimizingContent: vi.fn((fn) => (typeof fn === "function" ? fn({}) : fn)),
      setOptimizationProgress: vi.fn((fn) => (typeof fn === "function" ? fn({}) : fn)),
      setBulkOptimizationState: setBulkOptimizationState as never,
      optimizationFileManagers: {},
      continueOptimizationRef: { current: null },
      muteToasts: true,
      prefilledUrlKeywords: { "https://example.com/a/": "kw a" },
      prefilledOverviewTargets: {
        "https://example.com/a/": { postId: 10, postType: "page", keyword: "kw a" },
      },
    });

    expect(loadBulkOptimizerInventorySnapshot).not.toHaveBeenCalled();
    expect(runBulkSeoExtraTextBatch).toHaveBeenCalledTimes(1);
  });
});
