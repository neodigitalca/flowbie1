import { describe, expect, it } from "vitest";
import {
  buildFallbackGridLockedDestination,
  resolveGridLockedDestinationUrl,
} from "@/lib/sitemap-optimizer/grid-locked-destination";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const member = (url: string): SitemapOptimizerPostRow => ({
  postId: "csv:0",
  url,
  collection: "grid_csv",
  title: "Integrated Tax and Financial Planning for Business Owners",
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
});

describe("grid-locked-destination", () => {
  it("resolves full https URLs without truncating the path", () => {
    const full =
      "https://www.kwbllp.com/2025/06/09/integrated-tax-and-financial-planning-for-business-owners/";
    const out = resolveGridLockedDestinationUrl(full, [member("https://www.kwbllp.com/old/")]);
    expect(out).toBe(full);
    expect(out).toContain("integrated-tax-and-financial-planning-for-business-owners");
  });

  it("fallback builds a complete slug from the full title phrase", () => {
    const url = buildFallbackGridLockedDestination(
      [member("https://www.kwbllp.com/source-post/")],
      "Integrated Tax and Financial Planning for Business Owners",
      "integrated tax financial planning",
    );
    expect(url).toMatch(/^https:\/\/www\.kwbllp\.com\//);
    expect(url).toContain("integrated-tax");
    expect(url).not.toMatch(/-fo\/$/);
  });
});
