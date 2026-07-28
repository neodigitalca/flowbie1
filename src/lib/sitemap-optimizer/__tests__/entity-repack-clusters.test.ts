import { describe, expect, it } from "vitest";
import { repackEntityClustersByCompression } from "@/lib/sitemap-optimizer/entity-repack-clusters";
import { finalizeGridClusterResult } from "@/lib/sitemap-optimizer/grid-finalize-clusters";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function entityRow(id: number, slug: string): SitemapOptimizerPostRow {
  return {
    postId: `wp:${id}`,
    url: `https://advanceblindsanddrapery.com/service-area/${slug}/`,
    collection: "service-area",
    title: `Area ${slug}`,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
    gscPageClicks: id % 5,
    gscPageImpressions: id * 10,
  };
}

describe("entity-repack-clusters", () => {
  it("packs 30 winnipeg suburbs into ceil(30/5) clusters under aggressive 5:1", () => {
    const slugs = [
      "charleswood-blinds",
      "transcona-shades",
      "st-vital-drapery",
      "fort-garry-blinds",
      "river-heights-shades",
      "tuxedo-blinds",
      "westwood-shades",
      "east-kildonan-blinds",
      "north-kildonan-shades",
      "southland-blinds",
      "lindenwoods-shades",
      "bridgwater-blinds",
      "whyteridge-shades",
      "crescentwood-blinds",
      "osborne-shades",
      "fort-rouge-blinds",
      "st-boniface-shades",
      "st-james-blinds",
      "elmwood-shades",
      "inkster-blinds",
      "brookside-shades",
      "winnipeg-blinds",
      "winnipeg-shades",
      "winnipeg-drapery",
      "winnipeg-roller",
      "winnipeg-roman",
      "winnipeg-honeycomb",
      "winnipeg-motorized",
      "winnipeg-commercial",
      "winnipeg-residential",
    ];
    const rows = slugs.map((slug, i) => entityRow(i + 1, slug));
    const packed = finalizeGridClusterResult(
      repackEntityClustersByCompression(rows, {
        compression: "aggressive",
        maxUrlsPerPost: 5,
        allowMetroMerge: true,
      }),
      rows,
      5,
    );

    expect(packed.clusters.length).toBe(6);
    const memberCount = packed.clusters.reduce((n, c) => n + c.memberPostIds.length, 0);
    expect(memberCount).toBe(30);
    for (const cluster of packed.clusters) {
      expect(cluster.memberPostIds.length).toBeLessThanOrEqual(5);
    }
  });
});
