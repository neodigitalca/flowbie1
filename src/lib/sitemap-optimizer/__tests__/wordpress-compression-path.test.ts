import { describe, expect, it } from "vitest";
import { targetGridClusterCount } from "@/lib/sitemap-optimizer/grid-compression-policy";
import { finalizeGridClusterResult } from "@/lib/sitemap-optimizer/grid-finalize-clusters";
import { repackGridClustersByCompression } from "@/lib/sitemap-optimizer/grid-repack-clusters-by-compression";
import { buildDeterministicGridBriefs } from "@/lib/sitemap-optimizer/grid-deterministic-brief";
import { buildContentSheetRows } from "@/lib/sitemap-optimizer/build-content-sheet-rows";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function wpRow(id: number): SitemapOptimizerPostRow {
  return {
    postId: `wp:${id}`,
    url: `https://example.com/blog/post-${id}/`,
    collection: "posts",
    title: `Blog post ${id}`,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
  };
}

describe("wordpress 5:1 compression packing", () => {
  it("packs 417 URLs into at most ceil(n/5) content plans", () => {
    const rows = Array.from({ length: 417 }, (_, i) => wpRow(i + 1));
    const maxUrlsPerPost = 5 as const;
    const target = targetGridClusterCount(rows.length, maxUrlsPerPost);
    expect(target).toBe(84);

    const packed = finalizeGridClusterResult(
      repackGridClustersByCompression(rows, maxUrlsPerPost, "moderate"),
      rows,
      maxUrlsPerPost,
    );
    expect(packed.clusters.length).toBeLessThanOrEqual(target);
    expect(packed.clusters.length).toBeGreaterThan(0);

    const merges = buildDeterministicGridBriefs(packed.clusters, rows);
    const sheet = buildContentSheetRows({
      rows,
      clusters: packed,
      merges,
      minClusterMembers: 1,
    });

    expect(sheet.length).toBe(packed.clusters.length);
    expect(sheet.length).toBeLessThanOrEqual(target);
  });
});
