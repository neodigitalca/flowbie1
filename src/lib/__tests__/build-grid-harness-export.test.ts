import { describe, expect, it } from "vitest";
import {
  buildGridHarnessExportRows,
  buildGridHarnessExportCsv,
} from "@/lib/sitemap-optimizer/build-grid-harness-export";
import type {
  SitemapOptimizerClusterResult,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
  SitemapOptimizerRunResult,
} from "@/lib/sitemap-optimizer/types";

const gridRow = (
  index: number,
  url: string,
): SitemapOptimizerPostRow => ({
  postId: `csv:${index}`,
  url,
  collection: "grid_csv",
  title: "slug title",
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
  gscPageClicks: 10,
  gscPageImpressions: 100,
  uploadRowIndex: index + 1,
});

function makeResult(
  rows: SitemapOptimizerPostRow[],
  clusters: SitemapOptimizerClusterResult,
  merges: SitemapOptimizerMergeRecommendation[],
): SitemapOptimizerRunResult {
  return {
    rows,
    clusters,
    merges,
    contentSheet: [],
    gscMissCount: 0,
    dateRange: { startDate: "2025-01-01", endDate: "2025-01-31" },
    analyzedAt: "2025-02-01T00:00:00.000Z",
    gscUploadRowCount: rows.length,
    runMode: "grid_csv",
  };
}

describe("build-grid-harness-export", () => {
  it("exports one row per upload URL grouped by cluster", () => {
    const rows = [
      gridRow(0, "https://x.com/a"),
      gridRow(1, "https://x.com/b"),
      gridRow(2, "https://x.com/c"),
    ];
    const clusters: SitemapOptimizerClusterResult = {
      clusters: [
        {
          clusterId: "c1",
          label: "Topic A",
          intent: "mixed",
          memberPostIds: ["csv:0", "csv:1"],
          confidence: "high",
          rationale: "",
        },
      ],
      singletons: ["csv:2"],
    };
    const merges: SitemapOptimizerMergeRecommendation[] = [
      {
        clusterId: "c1",
        recommendedTitle: "Shared Blog Title",
        recommendedPrimaryKeyword: "shared kw",
        recommendedMeta: "Shared meta",
        combinedOutline: [],
        whatToKeepFromEach: [],
        redirectOrCanonicalNote: "",
        priority: "high",
        confidence: "high",
        rationale: "overlap",
      },
      {
        clusterId: "singleton:csv:2",
        recommendedTitle: "Solo Blog",
        recommendedPrimaryKeyword: "solo kw",
        recommendedMeta: "Solo meta",
        combinedOutline: [],
        whatToKeepFromEach: [],
        redirectOrCanonicalNote: "",
        priority: "medium",
        confidence: "medium",
        rationale: "singleton",
      },
    ];
    const result = makeResult(rows, clusters, merges);
    const exportRows = buildGridHarnessExportRows(result);
    expect(exportRows).toHaveLength(3);
    const clusterRows = exportRows.filter((r) => r.clusterId === "c1");
    expect(clusterRows).toHaveLength(2);
    expect(clusterRows.every((r) => r.mergeGroupId === clusterRows[0]?.mergeGroupId)).toBe(true);
    expect(clusterRows.every((r) => r.proposedNewBlogTitle === "Shared Blog Title")).toBe(true);
    expect(clusterRows[0].clusterSize).toBe(2);
    const solo = exportRows.find((r) => r.clusterId === "singleton:csv:2");
    expect(solo?.proposedNewBlogTitle).toBe("Solo Blog");
    expect(solo?.isSingletonCluster).toBe("yes");
    const csv = buildGridHarnessExportCsv(result);
    expect(csv.split("\n")).toHaveLength(4);
    expect(csv).toContain("proposed_new_blog_title");
  });

  it("throws when a row lacks a blog brief", () => {
    const rows = [gridRow(0, "https://x.com/a")];
    const clusters: SitemapOptimizerClusterResult = {
      clusters: [],
      singletons: ["csv:0"],
    };
    expect(() =>
      buildGridHarnessExportRows(makeResult(rows, clusters, [])),
    ).toThrow(/Missing merge data/);
  });
});
