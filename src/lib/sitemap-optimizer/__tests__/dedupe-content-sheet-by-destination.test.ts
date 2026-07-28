import { describe, expect, it } from "vitest";
import { applyGridOutputPolicies } from "@/lib/sitemap-optimizer/grid-output-policies";
import { buildDeterministicGridBriefs } from "@/lib/sitemap-optimizer/grid-deterministic-brief";
import {
  countContentSheetDuplicateDestinations,
  dedupeContentSheetRowsByDestination,
} from "@/lib/sitemap-optimizer/dedupe-content-sheet-by-destination";
import { clusterOneRowPerUpload } from "@/lib/sitemap-optimizer/grid-prefilled-group-cluster";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function redirectRow(args: {
  id: string;
  oldUrl: string;
  newUrl: string;
  title: string;
  uploadRow: number;
}): SitemapOptimizerPostRow {
  return {
    postId: args.id,
    url: args.newUrl,
    gridRedirectFromUrl: args.oldUrl,
    collection: "posts",
    title: args.title,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
    uploadRowIndex: args.uploadRow,
  };
}

describe("dedupeContentSheetRowsByDestination", () => {
  it("collapses duplicate newUrl rows into one content plan", () => {
    const dest = "https://www.kwbllp.com/blog/profit-improvement-strategies/";
    const sheet = [
      {
        postId: "wp:1",
        sourceUrl: dest,
        proposedDestinationUrl: dest,
        sourceTitle: "Profit strategies A",
        action: "new_blog" as const,
        priority: "medium" as const,
        proposedTitle: "Profit Improvement Strategies Guide",
        proposedPrimaryKeyword: "profit improvement strategies",
        proposedMeta: "Meta one two three four five six seven eight nine ten eleven.",
        mergeSourceCount: 2,
      },
      {
        postId: "wp:2",
        sourceUrl: dest,
        proposedDestinationUrl: dest,
        sourceTitle: "Profit strategies B",
        action: "new_blog" as const,
        priority: "medium" as const,
        proposedTitle: "Profit Improvement Strategies Guide",
        proposedPrimaryKeyword: "profit improvement strategies",
        proposedMeta: "Meta one two three four five six seven eight nine ten eleven.",
        mergeSourceCount: 3,
      },
    ];

    expect(countContentSheetDuplicateDestinations(sheet)).toBe(1);
    const deduped = dedupeContentSheetRowsByDestination(sheet);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.sourceUrl).toBe(dest);
    expect(deduped[0]?.mergeSourceCount).toBe(5);
  });
});

describe("redirect map content sheet unique destinations", () => {
  it("outputs one row per shared new_url after output policies", () => {
    const dest = "https://www.kwbllp.com/blog/profit-improvement-strategies/";
    const rows = [
      redirectRow({
        id: "wp:1",
        oldUrl: "https://www.kwbllp.com/2024/04/09/improving-your-auto-repair-business/",
        newUrl: dest,
        title: "Improving your auto repair business",
        uploadRow: 71,
      }),
      redirectRow({
        id: "wp:2",
        oldUrl: "https://www.kwbllp.com/2025/10/08/profit-improvement-strategies-for-your-business-the-power-of-one/",
        newUrl: dest,
        title: "Profit improvement strategies for your business",
        uploadRow: 31,
      }),
      redirectRow({
        id: "wp:3",
        oldUrl: "https://www.kwbllp.com/2024/03/06/cheese-tax/",
        newUrl: "https://www.kwbllp.com/blog/cloud-accounting/",
        title: "Cheese tax",
        uploadRow: 76,
      }),
    ];

    const draftClusters = clusterOneRowPerUpload(rows);
    const draftMerges = buildDeterministicGridBriefs(draftClusters.clusters, rows);
    const policies = applyGridOutputPolicies({
      rows,
      clusters: draftClusters,
      merges: draftMerges,
      gridMaxUrlsPerPost: 1,
      analyzedAt: "2026-06-01T00:00:00.000Z",
    });

    expect(policies.contentSheet).toHaveLength(2);
    expect(countContentSheetDuplicateDestinations(policies.contentSheet)).toBe(0);
    const profitRows = policies.contentSheet.filter((r) =>
      r.sourceUrl.includes("profit-improvement-strategies"),
    );
    expect(profitRows).toHaveLength(1);
    expect(profitRows[0]?.mergeSourceCount).toBe(2);
  });
});
