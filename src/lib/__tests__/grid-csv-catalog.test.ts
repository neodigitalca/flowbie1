import { describe, expect, it } from "vitest";
import {
  buildPostRowsFromGscGrid,
  titleFromUrlPath,
} from "@/lib/sitemap-optimizer/grid-csv-catalog";
import type { GscParsedPageRow } from "@/lib/sitemap-optimizer/parse-gsc-pages-csv";

const gscRow = (page: string, index = 0): GscParsedPageRow => ({
  page,
  clicks: index + 1,
  impressions: (index + 1) * 10,
  ctr: 0.05,
  position: 12,
});

describe("grid-csv-catalog", () => {
  it("builds one post row per CSV line with stable csv postIds", () => {
    const upload = [
      gscRow("https://example.com/blog/alpha", 0),
      gscRow("https://example.com/services/beta", 1),
    ];
    const rows = buildPostRowsFromGscGrid(upload);
    expect(rows).toHaveLength(2);
    expect(rows[0].postId).toBe("csv:0");
    expect(rows[1].postId).toBe("csv:1");
    expect(rows[0].uploadRowIndex).toBe(1);
    expect(rows[1].uploadRowIndex).toBe(2);
    expect(rows[0].collection).toBe("grid_csv");
    expect(rows[0].gscPageClicks).toBe(1);
    expect(rows[1].gscPageImpressions).toBe(20);
  });

  it("derives human title from URL path tail", () => {
    expect(titleFromUrlPath("https://x.com/my-cool-post")).toMatch(/cool post/i);
  });

  it("uses new_url as row url and preserves old_url for redirects", () => {
    const upload = [
      {
        page: "https://www.kwbllp.com/2026/04/02/financial-tax-planning-construction/",
        redirectFromUrl: "https://www.kwbllp.com/2026/04/02/integrated-financial-and-tax-planning-for-construction-and-trades-business-owners-3/",
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        gridTopicTag: "financial_tax_planning_construction",
        gridTagLabel: "Financial & Tax Planning Construction",
        gridGroup: 5,
        csvUploadRow: 213,
      },
    ];
    const rows = buildPostRowsFromGscGrid(upload);
    expect(rows[0]?.url).toBe(upload[0]!.page);
    expect(rows[0]?.gridRedirectFromUrl).toBe(upload[0]!.redirectFromUrl);
    expect(rows[0]?.title).toBe("Financial & Tax Planning Construction");
    expect(rows[0]?.gridRedirectGroup).toBe(5);
    expect(rows[0]?.uploadRowIndex).toBe(213);
  });
});
