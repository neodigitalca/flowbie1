import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import { createEmptyOverviewRow } from "@/lib/overview/overview-row-helpers";
import {
  applyHarnessHtmlPatchesToRows,
  buildOverviewHarnessCatalogWithHtml,
} from "@/lib/overview/overview-harness-page-catalog";

vi.mock("@/lib/overview/overview-page-content-batch", () => ({
  fetchOverviewPageContentBatch: vi.fn(),
  sliceOverviewRowsByPage: vi.fn((rows: unknown[]) => [rows]),
}));

import { fetchOverviewPageContentBatch } from "@/lib/overview/overview-page-content-batch";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";

const site = {
  id: "wp-test",
  name: "Test",
  siteUrl: "https://example.com",
  username: "u",
  appPassword: "p",
} as WordPressSite;

beforeEach(() => {
  vi.mocked(fetchOverviewPageContentBatch).mockReset();
});

describe("buildOverviewHarnessCatalogWithHtml", () => {
  it("loads SAP entity HTML from page content batch patches", async () => {
    const url = "https://example.com/plumbing-edmonton/";
    const rows = [
      {
        ...createEmptyOverviewRow(url),
        title: "Plumbing Edmonton",
        focusKeyword: "plumbing edmonton",
      },
    ];

    vi.mocked(fetchOverviewPageContentBatch).mockResolvedValueOnce({
      ok: true,
      contentRows: [],
      includeIds: [],
      patches: new Map([
        [normalizePageUrlKey(url), { postContentOptimized: "<h2>Services</h2><p>Body</p>" }],
      ]),
    });

    const { catalog, rowHtmlByIndex } = await buildOverviewHarnessCatalogWithHtml({
      site,
      rows,
      indices: [0],
      sitemapSource: "sap",
      bindings: {},
      getInventoryMatchForUrl: () => undefined,
      bulkScopeUrlKeys: new Set([normalizePageUrlKey(url)]),
    });

    expect(fetchOverviewPageContentBatch).toHaveBeenCalledWith(
      expect.objectContaining({ sitemapSource: "sap" }),
    );
    expect(rowHtmlByIndex[0]).toContain("Services");
    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.pageKind).toBe("entity");
    expect(catalog[0]?.html).toContain("Services");
  });

  it("marks post rows as post page kind", async () => {
    const url = "https://example.com/blog/post/";
    const rows = [
      {
        ...createEmptyOverviewRow(url),
        postContentOptimized: "<h2>Intro</h2><p>Post body</p>",
      },
    ];

    const postsSite = {
      id: "wp-posts",
      name: "Posts only",
      siteUrl: "https://example.com",
    } as WordPressSite;

    const { catalog } = await buildOverviewHarnessCatalogWithHtml({
      site: postsSite,
      rows,
      indices: [0],
      sitemapSource: "posts",
      bindings: {},
      getInventoryMatchForUrl: () => undefined,
      bulkScopeUrlKeys: new Set([normalizePageUrlKey(url)]),
    });

    expect(catalog[0]?.pageKind).toBe("post");
    expect(fetchOverviewPageContentBatch).not.toHaveBeenCalled();
  });
});

describe("applyHarnessHtmlPatchesToRows", () => {
  it("writes postContentOptimized on matched indices", () => {
    const patches: Partial<Record<number, { postContentOptimized?: string }>> = {};
    const updateRow = (index: number, patch: Partial<Record<string, string>>) => {
      patches[index] = patch;
    };

    applyHarnessHtmlPatchesToRows({
      rowHtmlByIndex: { 2: "<p>SAP body</p>" },
      updateRow,
    });

    expect(patches[2]?.postContentOptimized).toBe("<p>SAP body</p>");
  });
});
