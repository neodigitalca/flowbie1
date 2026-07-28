import { describe, expect, it } from "vitest";
import { runGridClusterByTag } from "@/lib/sitemap-optimizer/grid-cluster-by-tag";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const makeRow = (id: string, topic: string, geo = ""): SitemapOptimizerPostRow => ({
  postId: `csv:${id}`,
  url: `https://example.com/2025/01/0${id}/page-${id}/`,
  collection: "grid_csv",
  title: `Page ${id}`,
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
  uploadRowIndex: Number(id),
  gridTopicTag: topic,
  gridGeoTag: geo,
  gridTagLabel: topic.replace(/_/g, " "),
  gridIntent: "mixed",
});

describe("runGridClusterByTag", () => {
  it("never merges rows from different topic tags", async () => {
    const rows = [
      makeRow("1", "quickbooks_online"),
      makeRow("2", "quickbooks_online"),
      makeRow("3", "directors_liability"),
      makeRow("4", "directors_liability"),
      makeRow("5", "directors_liability"),
    ];
    const result = await runGridClusterByTag(rows, 5, "test-key");

    const findCluster = (postId: string) =>
      result.clusters.find((c) => c.memberPostIds.includes(postId));

    const c1 = findCluster("csv:1");
    const c3 = findCluster("csv:3");
    expect(c1).toBeDefined();
    expect(c3).toBeDefined();
    expect(c1!.clusterId).not.toBe(c3!.clusterId);
    expect(c1!.memberPostIds).toHaveLength(2);
    expect(c3!.memberPostIds).toHaveLength(3);
  });

  it("splits large topic buckets into max-sized clusters", async () => {
    const rows = Array.from({ length: 6 }, (_, i) =>
      makeRow(String(i + 1), "cloud_accounting"),
    );
    const result = await runGridClusterByTag(rows, 3, "test-key");
    const assigned = new Set(result.clusters.flatMap((c) => c.memberPostIds));
    expect(assigned.size).toBe(6);
    expect(result.clusters).toHaveLength(2);
    for (const c of result.clusters) {
      expect(c.memberPostIds.length).toBe(3);
    }
  });
});
