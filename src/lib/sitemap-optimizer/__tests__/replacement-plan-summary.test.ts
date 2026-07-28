import { describe, expect, it } from "vitest";
import {
  replacementPlanBreakdown,
  replacementPlanBreakdownLine,
  replacementPlanSummaryLine,
} from "@/lib/sitemap-optimizer/build-content-sheet-rows";
import {
  MATURITY_KEEP_RATIONALE_IMMATURE,
  MATURITY_KEEP_RATIONALE_UNKNOWN,
} from "@/lib/sitemap-optimizer/content-maturity-gate";
import type {
  SitemapOptimizerContentSheetRow,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

function mergeRow(clusterId: string, sources: number): SitemapOptimizerContentSheetRow {
  return {
    postId: `wp:${clusterId}`,
    sourceUrl: `https://example.com/a/`,
    sourceTitle: "",
    action: "merge",
    priority: "medium",
    proposedTitle: "Merged",
    proposedPrimaryKeyword: "merged",
    proposedMeta: "",
    rationale: "",
    proposedDestinationUrl: `https://example.com/b/`,
    mergeClusterId: clusterId,
    mergeSourceCount: sources,
  };
}

function keepRow(rationale: string): SitemapOptimizerPostRow {
  return {
    postId: "wp:keep",
    url: "https://example.com/service-area/keep/",
    collection: "entity",
    title: "Keep",
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: false,
    gscDisposition: "keep",
    gscTriageRationale: rationale,
  };
}

describe("replacementPlanSummaryLine", () => {
  it("uses plain language for replacements and redirects", () => {
    const line = replacementPlanSummaryLine({
      inventoryCount: 143,
      merges: [{ clusterId: "c1" } as never, { clusterId: "c2" } as never],
      contentSheet: [mergeRow("c1", 7), mergeRow("c2", 5)],
      entityPrimary: true,
    });
    expect(line).toBe(
      "143 service areas scanned · 2 new replacement posts · 12 redirects",
    );
  });

  it("reports when no replacements are needed", () => {
    const line = replacementPlanSummaryLine({
      inventoryCount: 50,
      merges: [],
      contentSheet: [],
      entityPrimary: false,
    });
    expect(line).toBe("50 URLs scanned · no replacements needed");
  });
});

describe("replacementPlanBreakdown", () => {
  it("counts immature keep, performing keep, must-compress, and replacements", () => {
    const breakdown = replacementPlanBreakdown({
      rows: [
        keepRow(MATURITY_KEEP_RATIONALE_IMMATURE),
        keepRow(MATURITY_KEEP_RATIONALE_UNKNOWN),
        keepRow("Strong relative traffic."),
        {
          ...keepRow(""),
          gscDisposition: "consolidate",
        },
      ],
      contentSheet: [mergeRow("c1", 2), mergeRow("c2", 1)],
      merges: [{ clusterId: "c1" } as never, { clusterId: "c2" } as never],
    });
    expect(breakdown.immatureKeepCount).toBe(2);
    expect(breakdown.performingKeepCount).toBe(1);
    expect(breakdown.mustCompressCount).toBe(1);
    expect(breakdown.replacementCount).toBe(2);
    expect(breakdown.redirectCount).toBe(3);
    expect(replacementPlanBreakdownLine(breakdown)).toBe(
      "2 kept (immature) · 1 kept (performing) · 1 to compress · 2 replacements proposed",
    );
  });
});
