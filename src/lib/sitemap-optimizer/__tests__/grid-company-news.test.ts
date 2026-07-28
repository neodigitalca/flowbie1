import { describe, expect, it } from "vitest";
import {
  applyCompanyNewsTags,
  COMPANY_TAG_LABEL,
  COMPANY_TOPIC_TAG,
  isCompanyNewsRow,
} from "@/lib/sitemap-optimizer/grid-company-news";
import { brandTokensFromSiteUrl } from "@/lib/sitemap-optimizer/site-brand-tokens";
import { compressionClusterKey } from "@/lib/sitemap-optimizer/grid-compression-policy";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function row(overrides: Partial<SitemapOptimizerPostRow> = {}): SitemapOptimizerPostRow {
  return {
    postId: "csv:1",
    url: "https://www.kwbllp.com/blog/example/",
    collection: "grid_csv",
    title: "Example",
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
    ...overrides,
  };
}

describe("isCompanyNewsRow", () => {
  it("detects firm announcements from title", () => {
    expect(isCompanyNewsRow(row({ title: "KWB Welcomes New Partner Jane Doe" }))).toBe(true);
    expect(isCompanyNewsRow(row({ title: "Welcome New Partner 2019" }))).toBe(true);
  });

  it("does not classify tax or budget guides as company news", () => {
    expect(isCompanyNewsRow(row({ title: "Alberta Budget 2024" }))).toBe(false);
    expect(isCompanyNewsRow(row({ title: "2024 Federal Tax Brackets Guide" }))).toBe(false);
    expect(isCompanyNewsRow(row({ title: "QuickBooks Online Tips" }))).toBe(false);
  });

  it("respects existing company topic tags", () => {
    expect(isCompanyNewsRow(row({ gridTopicTag: "company", title: "Annual update" }))).toBe(true);
  });

  it("detects site brand token in legacy slug without hardcoding firm name", () => {
    const tokens = brandTokensFromSiteUrl("https://www.kwbllp.com");
    expect(
      isCompanyNewsRow(
        row({
          url: "https://www.kwbllp.com/2014/12/19/merry-christmas-from-kwb/",
          title: "Merry Christmas",
        }),
        { siteBrandTokens: tokens },
      ),
    ).toBe(true);
    expect(
      isCompanyNewsRow(
        row({
          url: "https://www.kwbllp.com/2024/04/01/alberta-budget-2024/",
          title: "Alberta Budget 2024",
        }),
        { siteBrandTokens: tokens },
      ),
    ).toBe(false);
  });
});

describe("applyCompanyNewsTags", () => {
  it("sets company topic and label on matching rows", () => {
    const [tagged] = applyCompanyNewsTags([
      row({ title: "KWB announces new office in Edmonton" }),
    ]);
    expect(tagged?.gridTopicTag).toBe(COMPANY_TOPIC_TAG);
    expect(tagged?.gridTagLabel).toBe(COMPANY_TAG_LABEL);
  });

  it("tags brand-in-slug rows when site URL is provided", () => {
    const [tagged] = applyCompanyNewsTags(
      [
        row({
          url: "https://www.kwbllp.com/2017/10/10/kwb-10th-annual-bunnock-tournament/",
          title: "10th Annual Bunnock Tournament",
        }),
      ],
      "https://www.kwbllp.com",
    );
    expect(tagged?.gridTopicTag).toBe(COMPANY_TOPIC_TAG);
  });
});

describe("compressionClusterKey", () => {
  it("buckets company news under topic:company", () => {
    const company = row({ title: "Welcome New Partner", gridTopicTag: "company" });
    expect(compressionClusterKey(company, "aggressive")).toBe("topic:company");
    expect(compressionClusterKey(company, "moderate")).toBe("topic:company");
  });
});
