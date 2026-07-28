import { describe, expect, it } from "vitest";
import {
  buildContentSheetRowsGrid,
  gridHarnessSummaryCounts,
} from "@/lib/sitemap-optimizer/build-content-sheet-rows-grid";
import { buildDeterministicGridBrief } from "@/lib/sitemap-optimizer/grid-deterministic-brief";
import { buildMergeContentModifier } from "@/lib/sitemap-optimizer/merge-content-brief";
import type {
  SitemapOptimizerClusterResult,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

const dest = "https://www.kwbllp.com/blog/auto-repair-profitability/";

function gridRow(args: {
  id: string;
  oldUrl: string;
  uploadRow: number;
  clicks?: number;
}): SitemapOptimizerPostRow {
  return {
    postId: args.id,
    url: dest,
    gridRedirectFromUrl: args.oldUrl,
    gridRedirectGroup: 1,
    gridTopicTag: "auto_repair_profitability",
    gridTagLabel: "Auto Repair Profit",
    uploadRowIndex: args.uploadRow,
    collection: "grid_csv",
    title: "Auto Repair Profit",
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
    gscPageClicks: args.clicks ?? 0,
    gscPageImpressions: args.clicks != null ? args.clicks * 10 : 0,
  };
}

describe("buildContentSheetRowsGrid", () => {
  it("emits one content plan row per cluster when three sources share new_url", () => {
    const rows: SitemapOptimizerPostRow[] = [
      gridRow({
        id: "csv:207",
        oldUrl: "https://www.kwbllp.com/blog/auto-repair-profit-accelerator/",
        uploadRow: 207,
        clicks: 2,
      }),
      gridRow({
        id: "csv:297",
        oldUrl: "https://www.kwbllp.com/blog/auto-repair-profit-improvement/",
        uploadRow: 297,
        clicks: 3,
      }),
      gridRow({
        id: "csv:353",
        oldUrl: "https://www.kwbllp.com/blog/auto-repair-profit/",
        uploadRow: 353,
        clicks: 1,
      }),
    ];

    const clusters: SitemapOptimizerClusterResult = {
      clusters: [
        {
          clusterId: "grid-group-1",
          label: "Auto Repair Profitability",
          intent: "informational",
          memberPostIds: ["csv:207", "csv:297", "csv:353"],
          confidence: "high",
          rationale: "Prefilled CSV group 1",
        },
      ],
      singletons: [],
    };

    const rowMap = new Map(rows.map((r) => [r.postId, r]));
    const merges = clusters.clusters.map((c) => buildDeterministicGridBrief(c, rowMap)!);

    const sheet = buildContentSheetRowsGrid({ rows, clusters, merges });

    expect(sheet).toHaveLength(1);
    expect(sheet[0]?.sourceUrl).toBe(dest);
    expect(sheet[0]?.legacySourceUrl).toBe(
      "https://www.kwbllp.com/blog/auto-repair-profit-accelerator/",
    );
    expect(sheet[0]?.proposedDestinationUrl).toBe(dest);
    expect(sheet[0]?.mergeSourceCount).toBe(3);
    expect(sheet[0]?.gscClicks).toBe(6);
    expect(sheet[0]?.uploadRowIndex).toBe(207);
    expect(sheet[0]?.mergeClusterId).toBe("grid-group-1");
    expect(sheet[0]?.modifier).toBe(buildMergeContentModifier(merges[0]!));
    expect(sheet[0]?.whatToKeepFromEach?.length).toBe(3);
    expect(sheet[0]?.modifier).toContain("Required H2 sections:");
  });

  it("summary counts reflect cluster count not upload row count", () => {
    const rows: SitemapOptimizerPostRow[] = [
      gridRow({
        id: "csv:207",
        oldUrl: "https://www.kwbllp.com/blog/auto-repair-profit-accelerator/",
        uploadRow: 207,
      }),
      gridRow({
        id: "csv:297",
        oldUrl: "https://www.kwbllp.com/blog/auto-repair-profit-improvement/",
        uploadRow: 297,
      }),
      gridRow({
        id: "csv:353",
        oldUrl: "https://www.kwbllp.com/blog/auto-repair-profit/",
        uploadRow: 353,
      }),
    ];
    const clusters: SitemapOptimizerClusterResult = {
      clusters: [
        {
          clusterId: "grid-group-1",
          label: "Auto Repair Profitability",
          intent: "informational",
          memberPostIds: ["csv:207", "csv:297", "csv:353"],
          confidence: "high",
          rationale: "Prefilled CSV group 1",
        },
      ],
      singletons: [],
    };
    const rowMap = new Map(rows.map((r) => [r.postId, r]));
    const merges = clusters.clusters.map((c) => buildDeterministicGridBrief(c, rowMap)!);
    const sheet = buildContentSheetRowsGrid({ rows, clusters, merges });

    const summary = gridHarnessSummaryCounts(sheet, clusters, 5, 3);
    expect(summary.uploadRows).toBe(3);
    expect(summary.newPostGroups).toBe(1);
    expect(summary.destinations).toBe(1);
  });
});
