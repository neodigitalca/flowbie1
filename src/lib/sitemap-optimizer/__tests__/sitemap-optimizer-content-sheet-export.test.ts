import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import {
  contentSheetToBulkTemplateObjects,
  ensureBulkKeyword,
  ensureBulkTitle,
  SITEMAP_CONTENT_SHEET_EXPORT_COLUMNS,
} from "@/lib/sitemap-optimizer/content-sheet-bulk-export";
import { buildSitemapOptimizerContentSheetCsv } from "@/lib/sitemap-optimizer/sitemap-optimizer-export";
import type {
  SitemapOptimizerContentSheetRow,
  SitemapOptimizerRunResult,
} from "@/lib/sitemap-optimizer/types";

function parseBulkExportCsv(csv: string): Record<string, string>[] {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  return parsed.data;
}

function validateLikeParseCsv(rows: Record<string, string>[]): string[] {
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (!row.keyword?.trim()) {
      errors.push(`Row ${i + 2}: Missing required field 'keyword'`);
    }
    if (!row.title?.trim()) {
      errors.push(`Row ${i + 2}: Missing required field 'title'`);
    }
  }
  return errors;
}

describe("buildSitemapOptimizerContentSheetCsv bulk template", () => {
  it("exports bulk-auto-generate template columns", () => {
    const result = {
      runMode: "grid_csv" as const,
      rows: [],
      clusters: { clusters: [], singletons: [] },
      merges: [],
      contentSheet: [
        {
          postId: "csv:0",
          sourceUrl: "https://www.kwbllp.com/blog/alberta-budget-2024/",
          legacySourceUrl: "https://www.kwbllp.com/2024/04/01/alberta-budget-2024/",
          sourceTitle: "Alberta Budget",
          action: "new_blog" as const,
          priority: "high" as const,
          proposedTitle: "Alberta Budget Guide",
          proposedPrimaryKeyword: "alberta budget",
          proposedMeta: "Meta",
          proposedDestinationUrl: "https://www.kwbllp.com/blog/alberta-budget-2024/",
          modifier: "Cover fiscal updates",
        },
      ],
      gscMissCount: 0,
      dateRange: { startDate: "2026-01-01", endDate: "2026-01-31" },
      analyzedAt: "2026-01-31T00:00:00.000Z",
    } satisfies SitemapOptimizerRunResult;

    const csv = buildSitemapOptimizerContentSheetCsv(result);
    expect(csv.split(/\r?\n/)[0]).toBe([...SITEMAP_CONTENT_SHEET_EXPORT_COLUMNS].join(","));
    expect(csv).not.toContain("proposedPrimaryKeyword");
    expect(csv).not.toContain("newUrl");
    expect(csv).toContain("alberta budget");
    expect(csv).toContain("Alberta Budget Guide");

    const rows = parseBulkExportCsv(csv);
    expect(validateLikeParseCsv(rows)).toEqual([]);
    expect(rows[0]?.featuredImage).toBe("y");
    expect(rows[0]?.target_slug).toBeTruthy();
  });

  it("fills keyword and title when proposedPrimaryKeyword is empty", () => {
    const row: SitemapOptimizerContentSheetRow = {
      postId: "wp:1",
      sourceUrl: "https://example.com/service-area/winnipeg/",
      sourceTitle: "",
      action: "merge",
      priority: "high",
      proposedTitle: "Winnipeg Blinds Guide",
      proposedPrimaryKeyword: "",
      proposedMeta: "",
      mergeGroupLabel: "Winnipeg blinds",
    };
    const keyword = ensureBulkKeyword(row);
    const title = ensureBulkTitle(row, keyword);
    expect(keyword).toBeTruthy();
    expect(title).toBeTruthy();
  });

  it("populates entity column for service-area rows", () => {
    const result = {
      runMode: "wordpress" as const,
      rows: [
        {
          postId: "wp:10",
          url: "https://advanceblinds.com/service-area/charleswood-blinds/",
          collection: "service-area",
          title: "Charleswood Blinds",
          keyword: "",
          meta: "",
          contentSnippet: "",
          gscQueries: [],
          gscFetched: true,
        },
      ],
      clusters: { clusters: [], singletons: [] },
      merges: [],
      contentSheet: [
        {
          postId: "wp:10",
          sourceUrl: "https://advanceblinds.com/service-area/charleswood-blinds/",
          sourceTitle: "",
          action: "merge",
          priority: "high",
          proposedTitle: "Charleswood Blinds & Shades",
          proposedPrimaryKeyword: "blinds charleswood",
          proposedMeta: "",
          bulkEntityLabel: "Winnipeg",
        },
      ],
      gscMissCount: 0,
      dateRange: { startDate: "2026-01-01", endDate: "2026-01-31" },
      analyzedAt: "2026-01-31T00:00:00.000Z",
    } satisfies SitemapOptimizerRunResult;

    const objects = contentSheetToBulkTemplateObjects(result);
    expect(objects[0]?.entity).toBe("Winnipeg");
    expect(objects[0]?.keyword).toBe("blinds charleswood");
  });
});
