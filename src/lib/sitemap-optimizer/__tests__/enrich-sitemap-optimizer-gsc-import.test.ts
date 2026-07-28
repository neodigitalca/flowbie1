import { describe, expect, it } from "vitest";
import {
  applyAutoTrafficFilter,
  buildInventoryUrlAliases,
  buildSitePageMetricsIndex,
  filterInventoryByTraffic,
  joinInventoryWithSitePageMetrics,
  resolveSitemapOptimizerTrafficFilter,
} from "@/lib/sitemap-optimizer/enrich-sitemap-optimizer-gsc-import";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function row(overrides: Partial<SitemapOptimizerPostRow> = {}): SitemapOptimizerPostRow {
  return {
    postId: "wp:1",
    url: "https://example.com/blog/old-post/",
    collection: "posts",
    title: "Old Post",
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: false,
    ...overrides,
  };
}

describe("enrich-sitemap-optimizer-gsc-import", () => {
  it("joinInventoryWithSitePageMetrics matches legacy URL alias", () => {
    const inventory = [
      row({
        url: "https://example.com/blog/new-post/",
        gridRedirectFromUrl: "https://example.com/blog/old-post/",
      }),
    ];
    const sitePages = [
      {
        pageUrl: "https://example.com/blog/old-post",
        clicks: 12,
        impressions: 100,
        ctr: 0.12,
        position: 4,
      },
    ];
    const out = joinInventoryWithSitePageMetrics(inventory, sitePages);
    expect(out[0]?.gscPageClicks).toBe(12);
    expect(out[0]?.gscPageImpressions).toBe(100);
    expect(out[0]?.gscFetched).toBe(true);
  });

  it("filterInventoryByTraffic splits zero-click vs traffic", () => {
    const rows = [
      row({ postId: "a", gscPageClicks: 0 }),
      row({ postId: "b", gscPageClicks: 3 }),
    ];
    expect(filterInventoryByTraffic(rows, "zero_clicks")).toHaveLength(1);
    expect(filterInventoryByTraffic(rows, "zero_clicks")[0]?.postId).toBe("a");
    expect(filterInventoryByTraffic(rows, "traffic")).toHaveLength(1);
    expect(filterInventoryByTraffic(rows, "traffic")[0]?.postId).toBe("b");
  });

  it("filterInventoryByTraffic supports all and no_impressions modes", () => {
    const rows = [
      row({ postId: "a", gscPageClicks: 0, gscPageImpressions: 0 }),
      row({ postId: "b", gscPageClicks: 0, gscPageImpressions: 12 }),
      row({ postId: "c", gscPageClicks: 2, gscPageImpressions: 40 }),
    ];
    expect(filterInventoryByTraffic(rows, "all")).toHaveLength(3);
    expect(filterInventoryByTraffic(rows, "no_impressions")).toHaveLength(1);
    expect(filterInventoryByTraffic(rows, "no_impressions")[0]?.postId).toBe("a");
  });

  it("applyAutoTrafficFilter prefers clicks, then impressions, then no impressions, then all", () => {
    const withClicks = [
      row({ postId: "a", gscPageClicks: 2, gscPageImpressions: 10 }),
      row({ postId: "b", gscPageClicks: 0, gscPageImpressions: 5 }),
    ];
    expect(applyAutoTrafficFilter(withClicks).filter).toBe("traffic");
    expect(applyAutoTrafficFilter(withClicks).rows.map((r) => r.postId)).toEqual(["a"]);

    const impressionsOnly = [
      row({ postId: "a", gscPageClicks: 0, gscPageImpressions: 8 }),
      row({ postId: "b", gscPageClicks: 0, gscPageImpressions: 0 }),
    ];
    expect(applyAutoTrafficFilter(impressionsOnly).filter).toBe("zero_clicks");
    expect(applyAutoTrafficFilter(impressionsOnly).rows.map((r) => r.postId)).toEqual(["a"]);

    const noSignal = [
      row({ postId: "a", gscPageClicks: 0, gscPageImpressions: 0 }),
      row({ postId: "b", gscPageClicks: 0, gscPageImpressions: 0 }),
    ];
    expect(applyAutoTrafficFilter(noSignal).filter).toBe("no_impressions");
    expect(applyAutoTrafficFilter(noSignal).rows).toHaveLength(2);
  });

  it("resolveSitemapOptimizerTrafficFilter keeps all rows for SAP-only runs", () => {
    const rows = [
      row({ postId: "a", collection: "service-area", gscPageClicks: 2, gscPageImpressions: 10 }),
      row({ postId: "b", collection: "service-area", gscPageClicks: 0, gscPageImpressions: 0 }),
      row({ postId: "c", collection: "service-area", gscPageClicks: 0, gscPageImpressions: 5 }),
    ];
    const resolved = resolveSitemapOptimizerTrafficFilter(rows, { entityOnly: true });
    expect(resolved.filter).toBe("all");
    expect(resolved.rows).toHaveLength(3);
  });

  it("buildInventoryUrlAliases includes redirect from URL", () => {
    const aliases = buildInventoryUrlAliases(
      row({
        url: "https://example.com/blog/canonical/",
        gridRedirectFromUrl: "https://example.com/legacy/path/",
      }),
    );
    expect(aliases.length).toBeGreaterThan(1);
    const index = buildSitePageMetricsIndex([
      {
        pageUrl: "https://example.com/legacy/path/",
        clicks: 1,
        impressions: 10,
        ctr: 0.1,
        position: 1,
      },
    ]);
    expect(index.size).toBe(1);
  });
});
