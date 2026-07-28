import { describe, expect, it } from "vitest";
import {
  buildGscOutputPages,
  detectBrandProductLineClusters,
  mergedAwayUrls,
} from "../vertical-benchmark-gsc-clusters";
import type { GscTop10RagPage } from "../vertical-benchmark-gsc-rag";

function page(url: string, clicks: number): GscTop10RagPage {
  return {
    rank: 1,
    url,
    clicks,
    impressions: 100,
    position: 3,
    content_kind: "post",
  };
}

describe("detectBrandProductLineClusters", () => {
  it("merges 3+ hunter douglas product-line URLs into one cluster", () => {
    const pages = [
      page("https://example.com/blog/hunter-douglas-skyline-panel-track", 30),
      page("https://example.com/blog/hunter-douglas-duette-cellular-shades", 50),
      page("https://example.com/blog/hunter-douglas-luminette-vertical-shades", 20),
      page("https://example.com/blog/powerview-vs-softtouch", 40),
    ];
    const clusters = detectBrandProductLineClusters(pages, ["Hunter Douglas"]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].memberPages).toHaveLength(3);
    expect(clusters[0].leadPage.url).toContain("duette");
    const away = mergedAwayUrls(clusters);
    expect(away.size).toBe(2);
    const output = buildGscOutputPages(pages, clusters);
    expect(output).toHaveLength(2);
  });

  it("does not cluster comparison URLs", () => {
    const pages = [
      page("https://example.com/blog/hunter-douglas-duette", 50),
      page("https://example.com/blog/powerview-vs-softtouch", 40),
    ];
    const clusters = detectBrandProductLineClusters(pages, ["Hunter Douglas", "PowerView"]);
    expect(clusters).toHaveLength(0);
    expect(buildGscOutputPages(pages, clusters)).toHaveLength(2);
  });
});
