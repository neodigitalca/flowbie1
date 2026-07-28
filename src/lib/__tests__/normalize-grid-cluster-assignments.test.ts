import { describe, expect, it } from "vitest";
import { normalizeGridClusterAssignments } from "@/lib/sitemap-optimizer/normalize-grid-cluster-assignments";
import { gridBlogBriefTargets } from "@/lib/sitemap-optimizer/grid-csv-new-blog-agent";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const row = (id: string): SitemapOptimizerPostRow => ({
  postId: id,
  url: `https://x.com/${id}`,
  collection: "grid_csv",
  title: `Title ${id}`,
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
});

describe("normalize-grid-cluster-assignments", () => {
  it("demotes underfilled clusters to singletons and covers every postId", () => {
    const rows = [row("csv:0"), row("csv:1"), row("csv:6")];
    const normalized = normalizeGridClusterAssignments(
      {
        clusters: [
          {
            clusterId: "c1",
            label: "Pair",
            intent: "mixed",
            memberPostIds: ["csv:0", "csv:1"],
            confidence: "high",
            rationale: "",
          },
          {
            clusterId: "c-bad",
            label: "Phantom",
            intent: "mixed",
            memberPostIds: ["csv:6", "csv:missing"],
            confidence: "medium",
            rationale: "",
          },
        ],
        singletons: [],
      },
      rows,
    );

    expect(normalized.clusters).toHaveLength(1);
    expect(normalized.clusters[0]?.memberPostIds).toEqual(["csv:0", "csv:1"]);
    expect(normalized.singletons).toContain("csv:6");
    expect(normalized.singletons).not.toContain("csv:0");

    expect(normalized.singletons).toContain("csv:6");
    expect(normalized.clusters).toHaveLength(1);
  });
});
