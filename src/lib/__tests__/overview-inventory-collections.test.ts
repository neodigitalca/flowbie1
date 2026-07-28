import { describe, expect, it } from "vitest";
import { overviewInventoryCollectionsFromSitemapUrl } from "@/lib/overview/overview-inventory-collections";

describe("overviewInventoryCollectionsFromSitemapUrl", () => {
  it("returns posts for post sitemap", () => {
    expect(
      overviewInventoryCollectionsFromSitemapUrl("https://example.com/post-sitemap.xml"),
    ).toEqual(["posts"]);
  });

  it("returns pages for page sitemap", () => {
    expect(
      overviewInventoryCollectionsFromSitemapUrl("https://example.com/page-sitemap.xml"),
    ).toEqual(["pages"]);
  });

  it("returns entity REST collection for service-area sitemap", () => {
    expect(
      overviewInventoryCollectionsFromSitemapUrl(
        "https://ridgelinesolar.ca/service-area-sitemap.xml",
      ),
    ).toEqual(["service-area"]);
  });

  it("uses site entitySitemapUrl when loaded sitemap matches", () => {
    expect(
      overviewInventoryCollectionsFromSitemapUrl(
        "https://ridgelinesolar.ca/service-area-sitemap.xml",
        { entitySitemapUrl: "https://ridgelinesolar.ca/service-area-sitemap.xml" },
      ),
    ).toEqual(["service-area"]);
  });

  it("defaults to posts and pages for homepage sitemap index", () => {
    expect(overviewInventoryCollectionsFromSitemapUrl("https://example.com/sitemap.xml")).toEqual([
      "posts",
      "pages",
    ]);
  });
});
