import { describe, expect, it } from "vitest";
import {
  applyLegacyRedirectBlogDefaultsToMatches,
  buildLegacyRedirectGridRowsFromSheetLines,
  buildLegacyRedirectGridRowsFromUrls,
  legacyRedirectGridDisplayPath,
  legacyRedirectLegacyMatchKey,
  legacyRedirectGridPageCount,
  mergeLegacyRedirectMatchesIntoGrid,
  resolveLegacyRedirectDefaultBlogUrl,
  sliceLegacyRedirectGridPage,
} from "@/lib/sitemap-optimizer/legacy-redirect-grid-rows";
import { LEGACY_REDIRECT_GRID_PAGE_SIZE } from "@/lib/sitemap-optimizer/constants";

const legacyA = "https://example.com/2019/03/old-post/";
const legacyB = "https://example.com/2018/01/another-old/";
const legacyC = "https://example.com/2017/05/third-old/";
const destA = "https://example.com/blog/new-post/";

describe("legacyRedirectGridDisplayPath", () => {
  it("strips host and keeps trailing slash path", () => {
    expect(legacyRedirectGridDisplayPath("https://www.example.com/blog/post/")).toBe("blog/post/");
  });
});

describe("legacyRedirectLegacyMatchKey", () => {
  it("matches full URL to path-only upload line", () => {
    const full = "https://www.kwbllp.com/darren-buma/";
    expect(legacyRedirectLegacyMatchKey(full)).toBe(legacyRedirectLegacyMatchKey("darren-buma/"));
  });
});

describe("mergeLegacyRedirectMatchesIntoGrid", () => {
  it("merges when Gemini URL differs from path-only grid row", () => {
    const rows = buildLegacyRedirectGridRowsFromUrls(["darren-buma/"]);
    const merged = mergeLegacyRedirectMatchesIntoGrid(rows, [
      {
        legacyUrl: "https://www.kwbllp.com/darren-buma/",
        destinationUrl: "https://kwbllp.com/about/",
        uploadRow: 1,
      },
    ]);
    expect(merged[0]?.destinationUrl).toBe("https://kwbllp.com/about/");
  });
});

describe("buildLegacyRedirectGridRowsFromSheetLines", () => {
  it("builds one row per non-empty line, skips URL header", () => {
    const rows = buildLegacyRedirectGridRowsFromSheetLines(
      `URL\n${legacyA}\n${legacyB}`,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.legacyUrl).toBe(legacyA);
    expect(rows[1]?.legacyUrl).toBe(legacyB);
  });
});

describe("buildLegacyRedirectGridRowsFromUrls", () => {
  it("builds ordered rows with empty New URL", () => {
    const rows = buildLegacyRedirectGridRowsFromUrls([legacyA, legacyB]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ uploadRow: 1, legacyUrl: legacyA, destinationUrl: "" });
    expect(rows[1]).toEqual({ uploadRow: 2, legacyUrl: legacyB, destinationUrl: "" });
  });
});

describe("mergeLegacyRedirectMatchesIntoGrid", () => {
  it("fills New URL on matched rows only and keeps all upload rows", () => {
    const rows = buildLegacyRedirectGridRowsFromUrls([legacyA, legacyB, legacyC]);
    const merged = mergeLegacyRedirectMatchesIntoGrid(rows, [
      { legacyUrl: legacyA, destinationUrl: destA, uploadRow: 99 },
    ]);
    expect(merged).toHaveLength(3);
    expect(merged[0]?.destinationUrl).toBe(destA);
    expect(merged[0]?.uploadRow).toBe(1);
    expect(merged[1]?.destinationUrl).toBe("");
    expect(merged[2]?.destinationUrl).toBe("");
  });

  it("merges incremental batches without dropping rows", () => {
    const rows = buildLegacyRedirectGridRowsFromUrls([legacyA, legacyB]);
    const afterFirst = mergeLegacyRedirectMatchesIntoGrid(rows, [
      { legacyUrl: legacyA, destinationUrl: destA, uploadRow: 1 },
    ]);
    const afterSecond = mergeLegacyRedirectMatchesIntoGrid(afterFirst, [
      { legacyUrl: legacyA, destinationUrl: destA, uploadRow: 1 },
      { legacyUrl: legacyB, destinationUrl: destA, uploadRow: 2 },
    ]);
    expect(afterSecond[0]?.destinationUrl).toBe(destA);
    expect(afterSecond[1]?.destinationUrl).toBe(destA);
  });
});

describe("resolveLegacyRedirectDefaultBlogUrl", () => {
  it("returns site origin /blog/ when no blog index in inventory", () => {
    expect(
      resolveLegacyRedirectDefaultBlogUrl("https://www.kwbllp.com", [
        "https://www.kwbllp.com/blog/hst-and-gst-filing/",
      ]),
    ).toBe("https://www.kwbllp.com/blog/");
  });
});

describe("applyLegacyRedirectBlogDefaultsToMatches", () => {
  it("fills unmatched upload rows with blog/ default", () => {
    const legacyUnmatched =
      "2026/04/02/integrated-financial-and-tax-planning-for-yellowknife-and-northern-canadian-business-owners-3/";
    const sheet = `URL\n${legacyA}\n${legacyUnmatched}`;
    const defaultBlog = "https://www.kwbllp.com/blog/";
    const rows = applyLegacyRedirectBlogDefaultsToMatches({
      legacySheetText: sheet,
      matchedRows: [{ legacyUrl: legacyA, destinationUrl: destA, uploadRow: 1 }],
      defaultBlogUrl: defaultBlog,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.destinationUrl).toBe(destA);
    expect(rows[1]?.destinationUrl).toBe(defaultBlog);
    expect(rows[1]?.legacyUrl).toBe(legacyUnmatched);

    const grid = buildLegacyRedirectGridRowsFromSheetLines(sheet);
    const merged = mergeLegacyRedirectMatchesIntoGrid(grid, rows);
    expect(merged[1]?.destinationUrl).toBe(defaultBlog);
    expect(legacyRedirectGridDisplayPath(merged[1]!.destinationUrl)).toBe("blog/");
  });
});

describe("sliceLegacyRedirectGridPage", () => {
  it("returns 100-row pages", () => {
    const urls = Array.from({ length: 250 }, (_, i) => `https://example.com/page-${i}/`);
    const rows = buildLegacyRedirectGridRowsFromUrls(urls);
    expect(legacyRedirectGridPageCount(rows.length)).toBe(3);
    expect(sliceLegacyRedirectGridPage(rows, 1, LEGACY_REDIRECT_GRID_PAGE_SIZE)).toHaveLength(100);
    expect(sliceLegacyRedirectGridPage(rows, 3, LEGACY_REDIRECT_GRID_PAGE_SIZE)).toHaveLength(50);
  });
});
