import { describe, expect, it } from "vitest";
import { dedupeContentSheetRowsByDestination } from "@/lib/sitemap-optimizer/dedupe-content-sheet-by-destination";
import type { SitemapOptimizerContentSheetRow } from "@/lib/sitemap-optimizer/types";

function mergeRow(
  clusterId: string,
  dest: string,
  sources: number,
): SitemapOptimizerContentSheetRow {
  return {
    postId: `wp:${clusterId}`,
    sourceUrl: dest,
    sourceTitle: "",
    action: "merge",
    priority: "medium",
    proposedTitle: "Merged",
    proposedPrimaryKeyword: "merged",
    proposedMeta: "",
    rationale: "",
    proposedDestinationUrl: dest,
    mergeClusterId: clusterId,
    mergeSourceCount: sources,
  };
}

describe("dedupeContentSheetRowsByDestination entity redirect cap", () => {
  it("does not merge rows when combined redirects would exceed max per replacement", () => {
    const dest = "https://example.com/service-area/griesbach/";
    const sheet = [
      mergeRow("c1", dest, 5),
      mergeRow("c2", dest, 5),
      mergeRow("c3", dest, 5),
    ];
    const out = dedupeContentSheetRowsByDestination(sheet, { maxRedirectsPerReplacement: 5 });
    expect(out).toHaveLength(3);
    expect(out.every((r) => (r.mergeSourceCount ?? 0) <= 5)).toBe(true);
  });
});
