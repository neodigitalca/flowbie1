import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import { runBulkSeoExtraTextBatch } from "../bulk-seo-extra-text-run";

const { generateExtraTextForPage, finalizeBulkSeoExtraTextHtml, updateOverviewSeoItem } = vi.hoisted(
  () => ({
    generateExtraTextForPage: vi.fn(),
    finalizeBulkSeoExtraTextHtml: vi.fn(),
    updateOverviewSeoItem: vi.fn(),
  }),
);

vi.mock("@/lib/content-generation/page-extra-content-generator", () => ({
  generateExtraTextForPage: (...args: unknown[]) => generateExtraTextForPage(...args),
}));

vi.mock("../bulk-seo-extra-text-finalize", () => ({
  finalizeBulkSeoExtraTextHtml: (...args: unknown[]) => finalizeBulkSeoExtraTextHtml(...args),
}));

vi.mock("@/lib/wordpress-api/meta", () => ({
  updateOverviewSeoItem: (...args: unknown[]) => updateOverviewSeoItem(...args),
  getWordPressPostMeta: vi.fn(),
}));

vi.mock("@/lib/wordpress-api/crud", () => ({
  updateWordPressPost: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  loadApiKey: () => "test-api-key",
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

function pendingCache(urls: string[]) {
  const map = new Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>();
  urls.forEach((url, i) => {
    map.set(i, {
      primaryKeyword: `keyword ${i + 1}`,
      pending: {
        existingPost: {
          id: 100 + i,
          postTypeSubtype: "page",
          postTypeEndpoint: "pages",
          title: `Title ${i + 1}`,
          content: `<p>Body ${i + 1}</p>`,
        },
      },
    });
  });
  return map;
}

function acfCache(urls: string[]) {
  const map = new Map<number, Record<string, string>>();
  urls.forEach((_url, i) => {
    map.set(i, { keyword_focus: `keyword ${i + 1}` });
  });
  return map;
}

describe("runBulkSeoExtraTextBatch parallel upload", () => {
  beforeEach(() => {
    generateExtraTextForPage.mockReset();
    finalizeBulkSeoExtraTextHtml.mockReset();
    updateOverviewSeoItem.mockReset();

    generateExtraTextForPage.mockImplementation(async () => "<h2>Topic</h2><h3>Detail</h3><p>Body</p>");
    finalizeBulkSeoExtraTextHtml.mockImplementation(async ({ extraTextHtml }: { extraTextHtml: string }) => ({
      html: extraTextHtml,
    }));
    updateOverviewSeoItem.mockImplementation(async (_site, _user, _pass, item) => ({
      postId: (item as { postId: number }).postId,
      ok: true,
      method: "direct_put",
    }));
  });

  it("generates all rows then uploads each item via single-post path", async () => {
    const urls = ["https://example.com/a/", "https://example.com/b/"];
    const setBulkOptimizationState = vi.fn((updater: (prev: Record<string, unknown>) => unknown) => {
      if (typeof updater === "function") {
        updater({});
      }
    });
    const setOptimizationProgress = vi.fn();

    await runBulkSeoExtraTextBatch({
      site: testSite(),
      urls,
      batchKey: "site-1-batch",
      muteToasts: true,
      bulkInventorySnapshot: null,
      prefetchedPendingCache: pendingCache(urls),
      prefetchedAcfFieldsCache: acfCache(urls),
      wordPressPostsForRun: [],
      fileManager: new OptimizationFileManager(),
      setBulkOptimizationState: setBulkOptimizationState as never,
      setOptimizationProgress: setOptimizationProgress as never,
    });

    expect(generateExtraTextForPage).toHaveBeenCalledTimes(2);
    expect(updateOverviewSeoItem).toHaveBeenCalledTimes(2);
    const postIds = updateOverviewSeoItem.mock.calls.map(
      (c) => (c[3] as { postId: number }).postId,
    );
    expect(postIds.sort()).toEqual([100, 101]);
  });

  it("excludes failed generates from the upload", async () => {
    generateExtraTextForPage.mockImplementation(async (_opts: { pageUrl: string }) => {
      if (_opts.pageUrl.includes("/bad/")) return "";
      return "<h2>Topic</h2><h3>Detail</h3><p>Body</p>";
    });

    const urls = ["https://example.com/ok/", "https://example.com/bad/"];
    const setBulkOptimizationState = vi.fn((updater: (prev: Record<string, unknown>) => unknown) => {
      if (typeof updater === "function") updater({});
    });

    await runBulkSeoExtraTextBatch({
      site: testSite(),
      urls,
      batchKey: "site-1-batch",
      muteToasts: true,
      bulkInventorySnapshot: null,
      prefetchedPendingCache: pendingCache(urls),
      prefetchedAcfFieldsCache: acfCache(urls),
      wordPressPostsForRun: [],
      fileManager: new OptimizationFileManager(),
      setBulkOptimizationState: setBulkOptimizationState as never,
      setOptimizationProgress: vi.fn() as never,
    });

    expect(updateOverviewSeoItem).toHaveBeenCalledTimes(1);
    expect((updateOverviewSeoItem.mock.calls[0]?.[3] as { postId: number }).postId).toBe(100);
  });

  it("marks completed when each single-post upload succeeds", async () => {
    const urls = ["https://example.com/a/", "https://example.com/b/"];
    const completed: string[] = [];
    const setBulkOptimizationState = vi.fn((updater: (prev: Record<string, unknown>) => unknown) => {
      if (typeof updater !== "function") return;
      const next = updater({
        "site-1-batch": {
          urlStatuses: {},
          urlHarnessSections: {},
          urls,
        },
      }) as Record<string, { urlStatuses: Record<string, string> }>;
      const batch = next["site-1-batch"];
      for (const [url, status] of Object.entries(batch?.urlStatuses ?? {})) {
        if (status === "completed") completed.push(url);
      }
    });

    await runBulkSeoExtraTextBatch({
      site: testSite(),
      urls,
      batchKey: "site-1-batch",
      muteToasts: true,
      bulkInventorySnapshot: null,
      prefetchedPendingCache: pendingCache(urls),
      prefetchedAcfFieldsCache: acfCache(urls),
      wordPressPostsForRun: [],
      fileManager: new OptimizationFileManager(),
      setBulkOptimizationState: setBulkOptimizationState as never,
      setOptimizationProgress: vi.fn() as never,
    });

    expect(completed).toHaveLength(2);
  });

  it("uploads each of 150 rows via single-post path", async () => {
    const urlCount = 150;
    const urls = Array.from({ length: urlCount }, (_, i) => `https://example.com/p${i}/`);

    const setBulkOptimizationState = vi.fn((updater: (prev: Record<string, unknown>) => unknown) => {
      if (typeof updater === "function") updater({});
    });

    await runBulkSeoExtraTextBatch({
      site: testSite(),
      urls,
      batchKey: "site-1-batch",
      muteToasts: true,
      bulkInventorySnapshot: null,
      prefetchedPendingCache: pendingCache(urls),
      prefetchedAcfFieldsCache: acfCache(urls),
      wordPressPostsForRun: [],
      fileManager: new OptimizationFileManager(),
      setBulkOptimizationState: setBulkOptimizationState as never,
      setOptimizationProgress: vi.fn() as never,
    });

    expect(updateOverviewSeoItem).toHaveBeenCalledTimes(urlCount);
  });
});
