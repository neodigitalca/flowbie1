import { describe, expect, it } from "vitest";
import {
  applyPageGscToPendingCache,
  gscResultFromPagePerformance,
  pageGscQueryStringsFromPending,
} from "../bulk-optimization-prefetch-page-gsc";
import type { GSCPagePerformanceResult } from "@/lib/wordpress-api/types";
import { DEATH_STAR_NO_GSC } from "../bulk-optimization-constants";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";

describe("bulk-optimization-prefetch-page-gsc", () => {
  it("gscResultFromPagePerformance returns stub when no queries", () => {
    expect(gscResultFromPagePerformance(undefined)).toBe(DEATH_STAR_NO_GSC);
    expect(
      gscResultFromPagePerformance({
        success: true,
        pageUrl: "https://example.com/a/",
        queries: [],
        topKeyword: null,
        totalQueries: 0,
        dateRange: { startDate: "2024-01-01", endDate: "2024-03-01" },
      }),
    ).toBe(DEATH_STAR_NO_GSC);
  });

  it("applyPageGscToPendingCache injects page gsc into pending entries", () => {
    const page: GSCPagePerformanceResult = {
      success: true,
      pageUrl: "https://example.com/post/",
      matchedUrl: "https://example.com/post/",
      queries: [{ query: "test kw", clicks: 2, impressions: 20, ctr: 0.1, position: 5 }],
      topKeyword: { query: "test kw", clicks: 2, impressions: 20, ctr: 0.1, position: 5 },
      totalQueries: 1,
      dateRange: { startDate: "2024-01-01", endDate: "2024-03-01" },
    };

    const cache = new Map([[normalizePageUrlKey("https://example.com/post/"), page]]);
    const pending = new Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>([
      [0, { pending: { gscResult: DEATH_STAR_NO_GSC }, primaryKeyword: "test kw" }],
    ]);

    applyPageGscToPendingCache(["https://example.com/post/"], pending, cache);

    const gsc = pending.get(0)?.pending.gscResult as { queries?: Array<{ query: string }> };
    expect(gsc?.queries?.[0]?.query).toBe("test kw");
  });

  it("pageGscQueryStringsFromPending extracts deduped query strings", () => {
    const strings = pageGscQueryStringsFromPending({
      gscResult: {
        queries: [
          { query: "a" },
          { query: "A" },
          { query: "b" },
        ],
      },
    });
    expect(strings).toEqual(["a", "b"]);
  });
});
