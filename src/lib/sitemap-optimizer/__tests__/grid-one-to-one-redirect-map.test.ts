import { describe, expect, it } from "vitest";
import { buildContentSheetRowsGrid } from "@/lib/sitemap-optimizer/build-content-sheet-rows-grid";
import { buildDeterministicGridBrief } from "@/lib/sitemap-optimizer/grid-deterministic-brief";
import { clusterOneRowPerUpload } from "@/lib/sitemap-optimizer/grid-prefilled-group-cluster";
import { isGridOneToOneRedirectMap } from "@/lib/sitemap-optimizer/grid-one-to-one-redirect-map";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function redirectRow(args: {
  id: string;
  oldUrl: string;
  newUrl: string;
  uploadRow: number;
}): SitemapOptimizerPostRow {
  return {
    postId: args.id,
    url: args.newUrl,
    gridRedirectFromUrl: args.oldUrl,
    uploadRowIndex: args.uploadRow,
    collection: "grid_csv",
    title: "Tax brackets",
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
  };
}

describe("1:1 redirect map", () => {
  it("detects redirect map uploads with max urls = 1", () => {
    const rows = [
      redirectRow({
        id: "csv:0",
        oldUrl: "https://example.com/old-a/",
        newUrl: "https://example.com/blog/a/",
        uploadRow: 1,
      }),
    ];
    expect(isGridOneToOneRedirectMap(rows, 1)).toBe(true);
    expect(isGridOneToOneRedirectMap(rows, 2)).toBe(false);
  });

  it("emits one content row per upload with old_url and CSV new_url", () => {
    const rows = [
      redirectRow({
        id: "csv:0",
        oldUrl: "https://www.kwbllp.com/2024/02/07/2024-canadian-and-albertan-tax-brackets-and-rates/",
        newUrl: "https://www.kwbllp.com/blog/2024-canadian-alberta-tax-brackets/",
        uploadRow: 1,
      }),
      redirectRow({
        id: "csv:1",
        oldUrl: "https://www.kwbllp.com/2025/12/02/2026-canadian-and-albertan-tax-brackets-and-rates/",
        newUrl: "https://www.kwbllp.com/blog/2026-canadian-alberta-tax-brackets/",
        uploadRow: 2,
      }),
    ];
    const clusters = clusterOneRowPerUpload(rows);
    const rowMap = new Map(rows.map((r) => [r.postId, r]));
    const merges = clusters.clusters.map((c) => buildDeterministicGridBrief(c, rowMap)!);
    const sheet = buildContentSheetRowsGrid({
      rows,
      clusters,
      merges,
      gridMaxUrlsPerPost: 1,
    });

    expect(sheet).toHaveLength(2);
    expect(sheet[0]?.sourceUrl).toBe("https://www.kwbllp.com/blog/2026-canadian-alberta-tax-brackets/");
    expect(sheet[0]?.legacySourceUrl).toBe(rows[0]!.gridRedirectFromUrl);
    expect(sheet[0]?.proposedDestinationUrl).toBe(
      "https://www.kwbllp.com/blog/2026-canadian-alberta-tax-brackets/",
    );
    expect(sheet[1]?.sourceUrl).toBe(rows[1]!.url);
    expect(sheet[1]?.legacySourceUrl).toBe(rows[1]!.gridRedirectFromUrl);
    expect(sheet[1]?.proposedDestinationUrl).toBe(rows[1]!.url);
    expect(sheet[0]?.mergeGroupNumber).toBe(1);
    expect(sheet[1]?.mergeGroupNumber).toBe(2);
  });
});
