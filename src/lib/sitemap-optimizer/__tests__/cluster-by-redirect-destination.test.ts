import { describe, expect, it } from "vitest";
import {
  clusterResultFromRedirectDestinations,
  redirectDestinationFamilyStats,
} from "@/lib/sitemap-optimizer/cluster-by-redirect-destination";
import { buildContentSheetRows } from "@/lib/sitemap-optimizer/build-content-sheet-rows";
import { buildDeterministicGridBrief } from "@/lib/sitemap-optimizer/grid-deterministic-brief";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function redirectRow(args: {
  id: string;
  oldUrl: string;
  newUrl: string;
}): SitemapOptimizerPostRow {
  return {
    postId: args.id,
    url: args.newUrl,
    gridRedirectFromUrl: args.oldUrl,
    collection: "posts",
    title: "Legacy title",
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
  };
}

describe("clusterResultFromRedirectDestinations", () => {
  it("groups multiple legacy URLs into one family per new_url", () => {
    const rows = [
      redirectRow({
        id: "wp:1",
        oldUrl: "https://example.com/blog/old-a/",
        newUrl: "https://example.com/blog/target/",
      }),
      redirectRow({
        id: "wp:2",
        oldUrl: "https://example.com/blog/old-b/",
        newUrl: "https://example.com/blog/target/",
      }),
      redirectRow({
        id: "wp:3",
        oldUrl: "https://example.com/2024/other/",
        newUrl: "https://example.com/blog/other-topic/",
      }),
    ];

    const clusters = clusterResultFromRedirectDestinations(rows);
    expect(clusters.clusters).toHaveLength(2);
    expect(clusters.clusters.some((c) => c.memberPostIds.length === 2)).toBe(true);
    expect(redirectDestinationFamilyStats(rows).families).toBe(2);
  });

  it("builds one content sheet row per destination family", () => {
    const rows = [
      redirectRow({
        id: "wp:1",
        oldUrl: "https://example.com/a/",
        newUrl: "https://example.com/blog/shared/",
      }),
      redirectRow({
        id: "wp:2",
        oldUrl: "https://example.com/b/",
        newUrl: "https://example.com/blog/shared/",
      }),
    ];
    const clusters = clusterResultFromRedirectDestinations(rows);
    const rowMap = new Map(rows.map((r) => [r.postId, r]));
    const merges = clusters.clusters.map((c) => buildDeterministicGridBrief(c, rowMap)!);
    const sheet = buildContentSheetRows({
      rows,
      clusters,
      merges,
      minClusterMembers: 1,
    });

    expect(sheet).toHaveLength(1);
    expect(sheet[0]?.mergeSourceCount).toBe(2);
    expect(sheet[0]?.proposedDestinationUrl).toContain("/blog/shared/");
  });
});
