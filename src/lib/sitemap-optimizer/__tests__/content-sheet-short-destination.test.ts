import { describe, expect, it } from "vitest";
import { resolveContentSheetDestinationUrl } from "@/lib/sitemap-optimizer/content-sheet-source-url";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

describe("resolveContentSheetDestinationUrl live refresh", () => {
  it("shortens legacy inventory URL using standalone keyword (not full slug)", () => {
    const row: SitemapOptimizerPostRow = {
      postId: "1",
      url: "https://www.kwbllp.com/2025/01/27/canada-revenue-agency-new-reporting-rules-for-gig-workers/",
      collection: "posts",
      title: "CRA Gig Worker Reporting",
      keyword: "",
      meta: "",
      contentSnippet: "",
      gscQueries: [],
      gscFetched: true,
    };
    const dest = resolveContentSheetDestinationUrl({
      row,
      blogDestination: { forceBlogPermalink: true, parentPrefix: "blog" },
      standaloneKeyword: "cra gig worker reporting",
      standaloneTitle: "CRA Gig Worker Reporting",
    });
    expect(dest).toBe("https://www.kwbllp.com/blog/cra-gig-worker-reporting/");
    expect(dest).not.toContain("canada-revenue-agency-new-reporting");
  });
});
