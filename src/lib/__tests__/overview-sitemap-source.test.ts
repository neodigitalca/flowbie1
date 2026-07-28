import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import {
  canLoadOverviewSitemapSource,
  isOverviewPostsSourceAvailable,
  overviewInventoryCollectionsForOverviewLoad,
  overviewInventoryCollectionsFromSource,
  overviewInventoryCollectionsForSite,
  overviewUrlsFromInventoryRows,
  resolveOverviewSitemapUrls,
} from "@/lib/overview/overview-sitemap-source";
import type { OverviewInventoryRow } from "@/lib/overview/overview-inventory-csv";

function shutterspotSite(): WordPressSite {
  return {
    id: "shutterspot",
    name: "Shutterspot",
    siteUrl: "https://shutterspot.com",
    username: "user",
    appPassword: "pass",
    connectedAt: Date.now(),
    entitySitemapUrl: "https://shutterspot.com/location-sitemap.xml",
    sitemaps: {
      mainSitemapUrl: "https://shutterspot.com/sitemap_index.xml",
      detectedAt: Date.now(),
      type: "index",
      childSitemaps: [
        "https://shutterspot.com/post-sitemap.xml",
        "https://shutterspot.com/page-sitemap.xml",
        "https://shutterspot.com/hunter-douglas-sitemap.xml",
        "https://shutterspot.com/location-sitemap.xml",
        "https://shutterspot.com/promotion-sitemap.xml",
      ],
    },
  } as WordPressSite;
}

describe("resolveOverviewSitemapUrls", () => {
  it("Pages merges page sitemap plus non-post, non-entity children", () => {
    const site = shutterspotSite();
    expect(resolveOverviewSitemapUrls(site, "pages")).toEqual([
      "https://shutterspot.com/page-sitemap.xml",
      "https://shutterspot.com/hunter-douglas-sitemap.xml",
      "https://shutterspot.com/promotion-sitemap.xml",
    ]);
  });

  it("Posts resolves post sitemap only", () => {
    const site = shutterspotSite();
    expect(resolveOverviewSitemapUrls(site, "posts")).toEqual([
      "https://shutterspot.com/post-sitemap.xml",
    ]);
  });

  it("SAP resolves configured entity sitemap only", () => {
    const site = shutterspotSite();
    expect(resolveOverviewSitemapUrls(site, "sap")).toEqual([
      "https://shutterspot.com/location-sitemap.xml",
    ]);
  });

  it("Pages still loads appendable CPT sitemaps when page sitemap is missing", () => {
    const site = shutterspotSite();
    site.sitemaps!.childSitemaps = site.sitemaps!.childSitemaps!.filter(
      (u) => !u.includes("page-sitemap"),
    );
    expect(resolveOverviewSitemapUrls(site, "pages")).toEqual([
      "https://shutterspot.com/hunter-douglas-sitemap.xml",
      "https://shutterspot.com/promotion-sitemap.xml",
    ]);
  });

  it("respects disabled child sitemaps from Integrations", () => {
    const site = shutterspotSite();
    site.sitemaps!.disabledChildSitemapUrls = [
      "https://shutterspot.com/promotion-sitemap.xml",
    ];
    expect(resolveOverviewSitemapUrls(site, "pages")).toEqual([
      "https://shutterspot.com/page-sitemap.xml",
      "https://shutterspot.com/hunter-douglas-sitemap.xml",
    ]);
  });

  it("Posts returns empty when post sitemap is excluded in Integrations", () => {
    const site = shutterspotSite();
    site.sitemaps!.disabledChildSitemapUrls = ["https://shutterspot.com/post-sitemap.xml"];
    expect(resolveOverviewSitemapUrls(site, "posts")).toEqual([]);
    expect(isOverviewPostsSourceAvailable(site)).toBe(true);
    expect(canLoadOverviewSitemapSource(site, "posts")).toBe(true);
  });
});

describe("overviewInventoryCollectionsFromSource", () => {
  it("Pages includes pages plus CPT endpoints from appended sitemaps", () => {
    const site = shutterspotSite();
    expect(overviewInventoryCollectionsFromSource("pages", site)).toEqual([
      "pages",
      "hunter-douglas",
      "promotion",
    ]);
  });

  it("Pages skips local/geo sitemaps that are not wp/v2 collections", () => {
    const site = shutterspotSite();
    site.sitemaps!.childSitemaps = [
      ...(site.sitemaps!.childSitemaps ?? []),
      "https://shutterspot.com/local-sitemap.xml",
      "https://shutterspot.com/shop-by-room-sitemap.xml",
    ];
    expect(overviewInventoryCollectionsFromSource("pages", site)).toEqual([
      "pages",
      "hunter-douglas",
      "promotion",
      "shop-by-room",
    ]);
  });

  it("Posts returns posts collection", () => {
    const site = shutterspotSite();
    expect(overviewInventoryCollectionsFromSource("posts", site)).toEqual(["posts"]);
  });

  it("SAP returns entity REST collection", () => {
    const site = shutterspotSite();
    expect(overviewInventoryCollectionsFromSource("sap", site)).toEqual(["location"]);
  });

  it("SAP prefers manualEndpoint over sitemap filename", () => {
    const site = shutterspotSite();
    site.manualEndpoint = "service-areas";
    expect(overviewInventoryCollectionsFromSource("sap", site)).toEqual(["service-areas"]);
  });
});

describe("overviewInventoryCollectionsForSite", () => {
  it("uses Pages-bucket collections when property has detected sitemaps", () => {
    const site = shutterspotSite();
    expect(overviewInventoryCollectionsForSite(site, "pages")).toEqual([
      "pages",
      "hunter-douglas",
      "promotion",
    ]);
  });
});

describe("overviewUrlsFromInventoryRows", () => {
  it("filters inventory rows by requested collections", () => {
    const rows: OverviewInventoryRow[] = [
      { id: 1, url: "https://shutterspot.com/about/", collection: "pages", fields: { title: "", meta: "", keyword: "" } },
      { id: 2, url: "https://shutterspot.com/blog/post/", collection: "posts", fields: { title: "", meta: "", keyword: "" } },
      { id: 3, url: "https://shutterspot.com/promo/", collection: "promotion", fields: { title: "", meta: "", keyword: "" } },
    ];
    expect(overviewUrlsFromInventoryRows(rows, ["pages", "promotion"])).toEqual([
      "https://shutterspot.com/about/",
      "https://shutterspot.com/promo/",
    ]);
  });
});

describe("canLoadOverviewSitemapSource", () => {
  it("returns true when site has sitemaps and WordPress credentials", () => {
    expect(canLoadOverviewSitemapSource(shutterspotSite(), "pages")).toBe(true);
  });

  it("returns true for SAP when credentials exist even without entity sitemap", () => {
    const site = shutterspotSite();
    delete site.entitySitemapUrl;
    expect(canLoadOverviewSitemapSource(site, "sap")).toBe(true);
  });

  it("returns true for pages even when all child sitemaps are excluded", () => {
    const site = shutterspotSite();
    site.sitemaps!.disabledChildSitemapUrls = [...(site.sitemaps!.childSitemaps ?? [])];
    expect(resolveOverviewSitemapUrls(site, "pages")).toEqual([]);
    expect(canLoadOverviewSitemapSource(site, "pages")).toBe(true);
  });

  it("overviewInventoryCollectionsForOverviewLoad includes CPT collections for pages bucket", () => {
    const site = shutterspotSite();
    const cols = overviewInventoryCollectionsForOverviewLoad(site, "pages");
    expect(cols).toContain("pages");
    expect(cols).toContain("hunter-douglas");
    expect(cols).toContain("promotion");
  });
});
