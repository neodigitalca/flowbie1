import { describe, expect, it } from "vitest";
import {
  promoteSingletonsToRewriteClusters,
  splitOversizedEntityClusters,
} from "@/lib/sitemap-optimizer/split-oversized-entity-clusters";
import { SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT } from "@/lib/sitemap-optimizer/constants";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function entityRow(postId: string, url: string): SitemapOptimizerPostRow {
  return {
    postId,
    url,
    collection: "entity",
    title: postId,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: false,
  };
}

describe("splitOversizedEntityClusters", () => {
  it("splits a 12-member cluster by city into smaller groups", () => {
    const rows = [
      entityRow("a", "https://example.com/service-area/morinville-blinds/"),
      entityRow("b", "https://example.com/service-area/morinville-blinds-2/"),
      entityRow("c", "https://example.com/service-area/st-albert-shades/"),
      entityRow("d", "https://example.com/service-area/st-albert-shades-2/"),
      entityRow("e", "https://example.com/service-area/leduc-drapery/"),
      entityRow("f", "https://example.com/service-area/leduc-drapery-2/"),
      entityRow("g", "https://example.com/service-area/devon-blinds/"),
      entityRow("h", "https://example.com/service-area/devon-blinds-2/"),
      entityRow("i", "https://example.com/service-area/spruce-grove-shades/"),
      entityRow("j", "https://example.com/service-area/spruce-grove-shades-2/"),
      entityRow("k", "https://example.com/service-area/stony-plain-blinds/"),
      entityRow("l", "https://example.com/service-area/stony-plain-blinds-2/"),
    ];
    const result = splitOversizedEntityClusters(
      {
        clusters: [
          {
            clusterId: "mega",
            label: "Mega",
            intent: "local",
            memberPostIds: rows.map((r) => r.postId),
            confidence: "medium",
            rationale: "test",
          },
        ],
        singletons: [],
      },
      rows,
      SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT,
    );
    expect(result.clusters.length).toBeGreaterThan(1);
    expect(result.clusters.every((c) => c.memberPostIds.length <= 5)).toBe(true);
    const allAssigned = new Set(result.clusters.flatMap((c) => c.memberPostIds));
    expect(allAssigned.size + result.singletons.length).toBe(12);
  });

  it("splits 31 same-city URLs into seven clusters of five and one singleton", () => {
    const rows = Array.from({ length: 31 }, (_, i) =>
      entityRow(`p${i}`, `https://example.com/service-area/griesbach-blinds-${i + 1}/`),
    );
    const result = splitOversizedEntityClusters(
      {
        clusters: [
          {
            clusterId: "griesbach-mega",
            label: "Griesbach",
            intent: "local",
            memberPostIds: rows.map((r) => r.postId),
            confidence: "medium",
            rationale: "test",
          },
        ],
        singletons: [],
      },
      rows,
      5,
    );
    const multi = result.clusters.filter((c) => c.memberPostIds.length > 1);
    expect(multi.every((c) => c.memberPostIds.length <= 5)).toBe(true);
    const redirectCount =
      multi.reduce((n, c) => n + c.memberPostIds.length, 0) + result.singletons.length;
    expect(redirectCount).toBe(31);
    expect(multi.length).toBeGreaterThanOrEqual(6);
  });
});

describe("promoteSingletonsToRewriteClusters", () => {
  it("creates one-member rewrite clusters", () => {
    const rowById = new Map([
      ["wp:9", entityRow("wp:9", "https://example.com/service-area/weak/")],
    ]);
    const clusters = promoteSingletonsToRewriteClusters(["wp:9"], rowById);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.memberPostIds).toEqual(["wp:9"]);
    expect(clusters[0]?.clusterId).toBe("entity-rewrite-wp:9");
  });
});
