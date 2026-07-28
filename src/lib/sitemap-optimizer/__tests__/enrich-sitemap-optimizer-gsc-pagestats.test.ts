import { describe, expect, it, vi, afterEach } from "vitest";
import { enrichSitemapOptimizerRowsWithGsc } from "@/lib/sitemap-optimizer/enrich-sitemap-optimizer-gsc";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

vi.mock("@/lib/wordpress-api/gsc", () => ({
  fetchGSCPagesPerformanceBatch: vi.fn(),
}));

import { fetchGSCPagesPerformanceBatch } from "@/lib/wordpress-api/gsc";

const row: SitemapOptimizerPostRow = {
  postId: "wp:1",
  url: "https://example.com/blog/test/",
  collection: "posts",
  title: "Test",
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: false,
};

describe("enrichSitemapOptimizerRowsWithGsc pageStats", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("maps pageStats clicks and impressions onto rows", async () => {
    vi.mocked(fetchGSCPagesPerformanceBatch).mockResolvedValue({
      success: true,
      pages: [
        {
          success: true,
          pageUrl: "https://example.com/blog/test/",
          matchedUrl: "https://example.com/blog/test/",
          pageStats: { clicks: 7, impressions: 50, ctr: 0.14, position: 3 },
          dateRange: { startDate: "2026-01-01", endDate: "2026-01-31" },
          queries: [{ query: "test kw", clicks: 7, impressions: 50, ctr: 0.14, position: 3 }],
          topKeyword: null,
          totalQueries: 1,
        },
      ],
    });

    const { rows } = await enrichSitemapOptimizerRowsWithGsc(
      "https://example.com",
      [row],
      { startDate: "2026-01-01", endDate: "2026-01-31" },
    );

    expect(rows[0]?.gscPageClicks).toBe(7);
    expect(rows[0]?.gscPageImpressions).toBe(50);
    expect(rows[0]?.gscQueries).toHaveLength(1);
    expect(rows[0]?.gscFetched).toBe(true);
  });
});
