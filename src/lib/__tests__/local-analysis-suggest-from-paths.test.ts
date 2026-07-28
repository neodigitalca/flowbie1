import { describe, it, expect } from "vitest";
import { extractKeywordsFromSiteUrls, suggestKeywordTargetsFromSiteUrls } from "../local-analysis-suggest-from-paths";

describe("extractKeywordsFromSiteUrls", () => {
  it("humanizes path slugs into phrases", () => {
    const urls = [
      "https://example.com/services/motorized-blinds/",
      "https://example.com/products/wood-shutters",
    ];
    const kws = extractKeywordsFromSiteUrls(urls, "https://example.com");
    expect(kws).toContain("motorized blinds");
    expect(kws).toContain("wood shutters");
    expect(kws).toContain("products");
    expect(kws).not.toContain("service area");
  });

  it("collapses brand-dealer-city slugs to the brand phrase", () => {
    const kws = extractKeywordsFromSiteUrls(
      ["https://example.com/hunter-douglas-dealer-phoenix/", "https://example.com/hunter-douglas-dealer-mesa/"],
      "https://example.com"
    );
    expect(kws).toContain("hunter douglas");
    expect(kws.filter((k) => k.includes("phoenix")).length).toBe(0);
  });

  it("ignores other origins", () => {
    const kws = extractKeywordsFromSiteUrls(["https://evil.com/foo-bar/"], "https://example.com");
    expect(kws).toEqual([]);
  });
});

describe("suggestKeywordTargetsFromSiteUrls", () => {
  it("allocates total SAP pages across derived keywords", () => {
    const urls = [
      "https://example.com/a/one-two/",
      "https://example.com/b/three-four/",
    ];
    const rows = suggestKeywordTargetsFromSiteUrls(urls, "https://example.com", 10);
    const sum = rows.reduce((s, r) => s + r.sapPages, 0);
    expect(sum).toBe(10);
    expect(rows.length).toBeGreaterThan(0);
  });
});
