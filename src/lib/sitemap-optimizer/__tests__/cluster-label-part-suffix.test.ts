import { describe, expect, it } from "vitest";
import { repackGridClustersByCompression } from "@/lib/sitemap-optimizer/grid-repack-clusters-by-compression";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function row(id: string, title: string, topic: string): SitemapOptimizerPostRow {
  return {
    postId: id,
    url: `https://example.com/blog/${id}/`,
    collection: "posts",
    title,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
    gridTopicTag: topic,
    uploadRowIndex: Number(id.replace(/\D/g, "")) || 1,
  };
}

describe("cluster labels without part suffix", () => {
  it("does not append (2) when a topic bucket splits across max URLs per post", () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      row(`wp:${i + 1}`, `Tax guide part ${i + 1}`, "tax_guides"),
    );
    const result = repackGridClustersByCompression(rows, 5, "none");
    expect(result.clusters.length).toBeGreaterThan(1);
    for (const cluster of result.clusters) {
      expect(cluster.label).not.toMatch(/\(\d+\)\s*$/);
    }
  });
});
