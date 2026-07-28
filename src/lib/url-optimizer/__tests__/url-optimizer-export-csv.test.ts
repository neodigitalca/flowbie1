import { describe, expect, it } from "vitest";
import { buildUrlOptimizerExportCsv } from "@/lib/url-optimizer/url-optimizer-export-csv";
import type { UrlOptimizerResultRow } from "@/lib/url-optimizer/types";

const row = (overrides: Partial<UrlOptimizerResultRow>): UrlOptimizerResultRow => ({
  page: "https://example.com/2020/01/01/old-long-slug/",
  clicks: 0,
  impressions: 7525,
  ctr: 0,
  position: 44.12,
  title: "Title",
  meta: "Meta",
  bodyExcerpt: "Body",
  status: "optimized",
  proposedUrl: "https://example.com/blog/new-slug/",
  proposedKeyword: "new slug",
  csvUploadRow: 1,
  ...overrides,
});

describe("url-optimizer-export-csv", () => {
  it("exports all rows 1:1 with GSC columns in upload order", () => {
    const rows = [
      row({ csvUploadRow: 2, page: "https://example.com/b/", proposedUrl: "https://example.com/blog/b/" }),
      row({ csvUploadRow: 1 }),
      row({
        csvUploadRow: 3,
        status: "unresolved",
        proposedUrl: undefined,
      }),
    ];
    const csv = buildUrlOptimizerExportCsv(rows);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Top pages,new_url,Clicks,Impressions,CTR,Position");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain("old-long-slug");
    expect(lines[1]).toContain("7525");
    expect(lines[1]).toContain("0%");
    expect(lines[1]).toContain("44.12");
    expect(lines[3]).toContain('""');
  });

  it("quotes URLs containing commas", () => {
    const csv = buildUrlOptimizerExportCsv([
      row({
        page: "https://example.com/2020/01/01/slug,with-comma/",
        proposedUrl: "https://example.com/blog/fixed-slug/",
      }),
    ]);
    expect(csv).toContain('"https://example.com/2020/01/01/slug,with-comma/"');
  });
});
