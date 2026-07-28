import { describe, expect, it } from "vitest";
import {
  buildRedirectMatcherRankMathCsv,
  buildRedirectMatcherWideCsv,
} from "@/lib/redirect-matcher/redirect-matcher-export-csv";
import type { RedirectMatcherResultRow } from "@/lib/redirect-matcher/types";

const sampleRow: RedirectMatcherResultRow = {
  legacyUrl: "https://example.com/2020/03/old-slug/",
  matchedBlogUrl: "https://example.com/blog/new-slug/",
  uploadRow: 1,
  title: "Old Slug",
  meta: "Meta",
  bodyExcerpt: "Body",
  focusKeyword: "old keyword",
  slugTitle: "Old Slug",
  grepResolved: true,
  matchedBlogKeyword: "new keyword",
  rationale: "Same topic upgraded to blog permalink.",
};

describe("redirect-matcher-export-csv", () => {
  it("builds Rank Math import CSV with full domain in source", () => {
    const csv = buildRedirectMatcherRankMathCsv([sampleRow]);
    expect(csv.split("\n")[0]).toBe("id,source,matching,destination,type,category,status,ignore");
    expect(csv).toContain("https://example.com/2020/03/old-slug/");
    expect(csv).toContain("https://example.com/blog/new-slug/");
  });

  it("builds wide review sheet", () => {
    const csv = buildRedirectMatcherWideCsv([sampleRow]);
    expect(csv.split("\n")[0]).toBe(
      "upload_row,legacy_url,matched_blog_url,rank_math_source,rank_math_destination,rationale,legacy_keyword,blog_keyword",
    );
    expect(csv).toContain("old keyword");
    expect(csv).toContain("new keyword");
  });
});
