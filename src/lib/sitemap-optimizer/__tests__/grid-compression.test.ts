import { describe, expect, it } from "vitest";
import {
  compressionClusterKey,
  effectiveGridCompression,
  shouldClusterRedirectMapBySharedNewUrl,
  shouldUsePrefilledGridGroups,
  targetGridClusterCount,
} from "@/lib/sitemap-optimizer/grid-compression-policy";
import { packGridClustersIfOverTarget } from "@/lib/sitemap-optimizer/grid-compression-pack";
import { repackGridClustersByCompression } from "@/lib/sitemap-optimizer/grid-repack-clusters-by-compression";
import { clusterOneRowPerUpload } from "@/lib/sitemap-optimizer/grid-prefilled-group-cluster";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const yellowknifeRow = (id: string, slug: string, topic: string): SitemapOptimizerPostRow => ({
  postId: id,
  url: `https://www.kwbllp.com/blog/${slug}/`,
  gridRedirectFromUrl: `https://www.kwbllp.com/2025/old/${slug}/`,
  gridTopicTag: topic,
  gridGeoTag: "yellowknife",
  gridTagLabel: slug.replace(/-/g, " "),
  collection: "grid_csv",
  title: slug,
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
  uploadRowIndex: Number(id.replace(/\D/g, "")) || 1,
});

describe("grid-compression-policy", () => {
  it("forces none when max URLs per post is 1", () => {
    expect(effectiveGridCompression(1, "aggressive")).toBe("none");
    expect(effectiveGridCompression(1, "moderate")).toBe("none");
    expect(effectiveGridCompression(3, "aggressive")).toBe("aggressive");
    expect(effectiveGridCompression(2, "none")).toBe("none");
  });

  it("uses topic:company bucket for firm news rows", () => {
    const row = yellowknifeRow("csv:99", "welcome-new-partner", "welcome_partner");
    row.title = "KWB Welcomes New Partner";
    expect(compressionClusterKey(row, "aggressive")).toBe("topic:company");
  });

  it("uses geo-only bucket keys in aggressive mode", () => {
    const row = yellowknifeRow("csv:1", "yellowknife-business-coaching", "yellowknife_business_coaching");
    expect(compressionClusterKey(row, "aggressive")).toBe("geo:yellowknife");
    expect(compressionClusterKey(row, "moderate")).toContain("yellowknife");
    expect(compressionClusterKey(row, "none")).toContain("yellowknife_business_coaching");
  });

  it("infers geo from slug when geo_tag column is empty", () => {
    const row: SitemapOptimizerPostRow = {
      ...yellowknifeRow("csv:1", "yellowknife-business-coaching", "coaching_a"),
      gridGeoTag: undefined,
    };
    expect(compressionClusterKey(row, "aggressive")).toBe("geo:yellowknife");
  });

  it("uses intent buckets for non-local URLs in aggressive mode", () => {
    const row: SitemapOptimizerPostRow = {
      postId: "csv:1",
      url: "https://example.com/blog/cpp-retirement-planning/",
      collection: "grid_csv",
      title: "CPP retirement",
      keyword: "",
      meta: "",
      contentSnippet: "",
      gscQueries: [],
      gscFetched: true,
      gridTopicTag: "cpp_retirement",
      gridIntent: "informational",
    };
    expect(compressionClusterKey(row, "aggressive")).toBe("intent:informational");
  });

  it("does not use CSV group clustering when compression is enabled", () => {
    expect(shouldUsePrefilledGridGroups("none")).toBe(true);
    expect(shouldUsePrefilledGridGroups("aggressive")).toBe(false);
  });

  it("skips shared new_url clustering when compression is enabled or max is 1", () => {
    expect(shouldClusterRedirectMapBySharedNewUrl("none", 5)).toBe(true);
    expect(shouldClusterRedirectMapBySharedNewUrl("none", 1)).toBe(false);
    expect(shouldClusterRedirectMapBySharedNewUrl("moderate", 5)).toBe(false);
    expect(shouldClusterRedirectMapBySharedNewUrl("aggressive", 5)).toBe(false);
  });
});

describe("clusterOneRowPerUpload", () => {
  it("keeps rows with the same new_url in separate clusters when max is 1", () => {
    const dest = "https://www.kwbllp.com/blog/canadian-business-tax-deductions/";
    const row = (id: string, oldSlug: string): SitemapOptimizerPostRow => ({
      postId: id,
      url: dest,
      gridRedirectFromUrl: `https://www.kwbllp.com/old/${oldSlug}/`,
      collection: "grid_csv",
      title: oldSlug,
      keyword: "",
      meta: "",
      contentSnippet: "",
      gscQueries: [],
      gscFetched: true,
    });
    const result = clusterOneRowPerUpload([
      row("csv:0", "canadian-business-a"),
      row("csv:1", "canadian-business-b"),
    ]);
    expect(result.clusters).toHaveLength(2);
    expect(result.clusters.every((c) => c.memberPostIds.length === 1)).toBe(true);
  });
});

describe("repackGridClustersByCompression", () => {
  it("merges Yellowknife URLs into one cluster under aggressive compression", () => {
    const rows = [
      yellowknifeRow("csv:1", "yellowknife-business-coaching", "yellowknife_business_coaching"),
      yellowknifeRow("csv:2", "yellowknife-business-efficiency", "yellowknife_business_efficiency"),
      yellowknifeRow("csv:3", "yellowknife-profit-strategies", "yellowknife_profit_strategies"),
      yellowknifeRow("csv:4", "quickbooks-online-yellowknife", "quickbooks_online_yellowknife"),
    ];
    const result = repackGridClustersByCompression(rows, 5, "aggressive");
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0]?.memberPostIds).toHaveLength(4);
  });

  it("packs loose clusters when compression produced too many groups", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      yellowknifeRow(`csv:${i + 1}`, `yellowknife-topic-${i + 1}`, `topic_${i + 1}`),
    );
    const draft = {
      clusters: rows.map((r) => ({
        clusterId: `solo-${r.postId}`,
        label: r.title,
        intent: "mixed" as const,
        memberPostIds: [r.postId],
        confidence: "high" as const,
        rationale: "",
      })),
      singletons: [] as string[],
    };
    expect(targetGridClusterCount(12, 5)).toBe(3);
    const packed = packGridClustersIfOverTarget(draft, rows, 5, "aggressive");
    expect(packed.clusters.length).toBeLessThanOrEqual(3);
    expect(packed.clusters.every((c) => c.memberPostIds.length <= 5)).toBe(true);
  });

  it("splits to one URL per cluster when max is 1 even under aggressive compression", () => {
    const rows = [
      yellowknifeRow("csv:1", "yellowknife-business-coaching", "yellowknife_business_coaching"),
      yellowknifeRow("csv:2", "yellowknife-business-efficiency", "yellowknife_business_efficiency"),
      yellowknifeRow("csv:3", "yellowknife-profit-strategies", "yellowknife_profit_strategies"),
      yellowknifeRow("csv:4", "quickbooks-online-yellowknife", "quickbooks_online_yellowknife"),
    ];
    const result = repackGridClustersByCompression(rows, 1, "aggressive");
    expect(result.clusters).toHaveLength(4);
    expect(result.clusters.every((c) => c.memberPostIds.length === 1)).toBe(true);
  });
});
