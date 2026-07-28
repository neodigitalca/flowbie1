import { describe, expect, it } from "vitest";
import { repackGridClustersByTopicTag } from "@/lib/sitemap-optimizer/grid-repack-clusters-by-topic";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const makeRow = (id: string, topic: string): SitemapOptimizerPostRow => ({
  postId: `csv:${id}`,
  url: `https://example.com/p/${id}/`,
  collection: "grid_csv",
  title: `Page ${id}`,
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
  uploadRowIndex: Number(id),
  gridTopicTag: topic,
  gridTagLabel: topic,
  gridIntent: "mixed",
});

describe("repackGridClustersByTopicTag", () => {
  it("packs same topic into clusters of at most maxUrlsPerPost", () => {
    const rows = Array.from({ length: 11 }, (_, i) => makeRow(String(i + 1), "tax_planning"));
    const result = repackGridClustersByTopicTag(rows, 5);
    expect(result.singletons).toHaveLength(0);
    expect(result.clusters).toHaveLength(3);
    expect(result.clusters[0]?.memberPostIds).toHaveLength(5);
    expect(result.clusters[1]?.memberPostIds).toHaveLength(5);
    expect(result.clusters[2]?.memberPostIds).toHaveLength(1);
    const assigned = new Set(result.clusters.flatMap((c) => c.memberPostIds));
    expect(assigned.size).toBe(11);
  });

  it("never mixes different topic tags", () => {
    const rows = [
      makeRow("1", "quickbooks"),
      makeRow("2", "quickbooks"),
      makeRow("3", "backups"),
      makeRow("4", "backups"),
      makeRow("5", "backups"),
    ];
    const result = repackGridClustersByTopicTag(rows, 5);
    const qb = result.clusters.find((c) => c.memberPostIds.includes("csv:1"));
    const bk = result.clusters.find((c) => c.memberPostIds.includes("csv:3"));
    expect(qb?.memberPostIds).toEqual(["csv:1", "csv:2"]);
    expect(bk?.memberPostIds).toHaveLength(3);
    expect(qb?.clusterId).not.toBe(bk?.clusterId);
  });
});
