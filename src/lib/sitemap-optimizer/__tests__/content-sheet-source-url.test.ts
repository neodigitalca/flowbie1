import { describe, expect, it } from "vitest";
import {
  resolveContentSheetDestinationUrl,
  resolveContentSheetLegacySourceUrl,
  resolveContentSheetSourceUrl,
} from "@/lib/sitemap-optimizer/content-sheet-source-url";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const row = (overrides: Partial<SitemapOptimizerPostRow> = {}): SitemapOptimizerPostRow => ({
  postId: "wp:1",
  url: "https://www.kwbllp.com/blog/tax-financial-planning/",
  gridRedirectFromUrl:
    "https://www.kwbllp.com/2026/04/02/integrated-financial-and-tax-planning-for-medical-professionals-3/",
  collection: "posts",
  title: "Tax planning",
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
  ...overrides,
});

describe("resolveContentSheetSourceUrl", () => {
  it("uses CSV new_url as primary URL when redirect map is present", () => {
    expect(resolveContentSheetSourceUrl({ row: row() })).toBe(
      "https://www.kwbllp.com/blog/tax-financial-planning/",
    );
  });

  it("uses merge contract destination when no redirect map", () => {
    const plain = row({ gridRedirectFromUrl: undefined, url: "https://example.com/old/" });
    expect(
      resolveContentSheetSourceUrl({
        row: plain,
        contract: {
          clusterId: "c1",
          title: "T",
          keyword: "k",
          slugSegment: "blog-new",
          permalinkPrefix: "blog/",
          relativePath: "blog/new/",
          destinationUrl: "https://example.com/blog/new/",
          publishDateGmt: "",
          modifier: "",
          sourceUrls: [],
        },
      }),
    ).toBe("https://example.com/blog/new/");
  });
});

describe("resolveContentSheetLegacySourceUrl", () => {
  it("returns old_url for redirect map rows", () => {
    expect(resolveContentSheetLegacySourceUrl(row())).toBe(
      "https://www.kwbllp.com/2026/04/02/integrated-financial-and-tax-planning-for-medical-professionals-3/",
    );
  });
});

describe("resolveContentSheetDestinationUrl", () => {
  it("uses CSV new_url when redirect map is present", () => {
    expect(resolveContentSheetDestinationUrl({ row: row() })).toBe(
      "https://www.kwbllp.com/blog/tax-financial-planning/",
    );
  });
});
