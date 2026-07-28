import { describe, expect, it } from "vitest";
import {
  buildGscSitePerformanceBenchmarks,
  gscRowPerformanceRanks,
} from "@/lib/sitemap-optimizer/gsc-site-performance-benchmarks";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function gscRow(
  id: string,
  clicks: number,
  impressions: number,
): SitemapOptimizerPostRow {
  return {
    postId: id,
    url: `https://example.com/${id}/`,
    collection: "posts",
    title: id,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
    gscPageClicks: clicks,
    gscPageImpressions: impressions,
  };
}

describe("gsc-site-performance-benchmarks", () => {
  it("computes medians and percentiles for fixture rows", () => {
    const rows = [
      gscRow("a", 0, 0),
      gscRow("b", 2, 20),
      gscRow("c", 4, 40),
      gscRow("d", 8, 80),
    ];
    const benchmarks = buildGscSitePerformanceBenchmarks(rows);
    expect(benchmarks.urlCount).toBe(4);
    expect(benchmarks.totalClicks).toBe(14);
    expect(benchmarks.totalImpressions).toBe(140);
    expect(benchmarks.medianClicks).toBe(3);
    expect(benchmarks.p25Clicks).toBeLessThanOrEqual(benchmarks.medianClicks);
    expect(benchmarks.p75Clicks).toBeGreaterThanOrEqual(benchmarks.medianClicks);
  });

  it("ranks rows by clicks percentile within the site", () => {
    const rows = [gscRow("low", 0, 10), gscRow("high", 10, 100)];
    const low = gscRowPerformanceRanks(rows[0]!, rows);
    const high = gscRowPerformanceRanks(rows[1]!, rows);
    expect(low.clicksPercentile).toBeLessThan(high.clicksPercentile);
    expect(high.clicksPercentile).toBeGreaterThan(50);
  });
});
