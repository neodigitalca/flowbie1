import { describe, expect, it } from "vitest";
import {
  enforceSeparateGeoClusters,
  leadingPlaceKeyFromPathTail,
} from "@/lib/sitemap-optimizer/enforce-separate-geo-clusters";
import type {
  SitemapOptimizerCatalogEntry,
  SitemapOptimizerClusterResult,
} from "@/lib/sitemap-optimizer/types";

function entry(postId: string, urlPathTail: string, title: string): SitemapOptimizerCatalogEntry {
  return {
    postId,
    url: `https://example.com/blog/${urlPathTail}/`,
    urlPathTail,
    title,
    keyword: "",
    meta: "",
    collection: "posts",
    gscTopQueries: [],
    contentSnippet: "",
  };
}

describe("leadingPlaceKeyFromPathTail", () => {
  it("reads leading town slug", () => {
    expect(leadingPlaceKeyFromPathTail("stony-plain")).toBe("stony-plain");
    expect(leadingPlaceKeyFromPathTail("st-albert-roller-blinds")).toBe("st-albert");
  });

  it("returns null for service-first slugs", () => {
    expect(leadingPlaceKeyFromPathTail("blind-repair-guide")).toBeNull();
    expect(leadingPlaceKeyFromPathTail("repair-guide-edmonton")).toBeNull();
  });
});

describe("enforceSeparateGeoClusters", () => {
  const catalog = [
    entry("wp:1", "stony-plain", "Stony Plain Blinds"),
    entry("wp:2", "spruce-grove", "Spruce Grove Blinds"),
    entry("wp:3", "devon", "Blinds In Devon"),
    entry("wp:4", "st-albert-roller-blinds", "St Albert Roller Blinds"),
    entry("wp:5", "blind-repair-guide", "Blind Repair Guide Edmonton"),
    entry("wp:6", "repair-guide-edmonton", "Repair Guide Edmonton"),
  ];

  it("dissolves multi-town cluster into singletons", () => {
    const draft: SitemapOptimizerClusterResult = {
      clusters: [
        {
          clusterId: "bad",
          label: "Multi town",
          intent: "local",
          memberPostIds: ["wp:1", "wp:2", "wp:3", "wp:4"],
          confidence: "high",
          rationale: "",
        },
      ],
      singletons: [],
    };
    const out = enforceSeparateGeoClusters(draft, catalog);
    expect(out.clusters).toHaveLength(0);
    expect(out.singletons).toContain("wp:1");
    expect(out.singletons).toContain("wp:4");
  });

  it("keeps same-town or service-slug repair pair", () => {
    const draft: SitemapOptimizerClusterResult = {
      clusters: [
        {
          clusterId: "repair",
          label: "Repair",
          intent: "informational",
          memberPostIds: ["wp:5", "wp:6"],
          confidence: "high",
          rationale: "",
        },
      ],
      singletons: [],
    };
    const out = enforceSeparateGeoClusters(draft, catalog);
    expect(out.clusters).toHaveLength(1);
    expect(out.clusters[0]!.memberPostIds).toEqual(["wp:5", "wp:6"]);
  });
});
