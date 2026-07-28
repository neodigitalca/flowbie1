import { describe, it, expect } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import {
  pickInitialSitemapUrlForMode,
  pickChildSitemapUrlForOfferings,
  scoreSitemapUrlForOfferings,
} from "../local-analysis-site-context";

function minimalSite(overrides: Partial<WordPressSite> = {}): WordPressSite {
  return {
    id: "t1",
    name: "Test Site",
    siteUrl: "https://example.com",
    username: "",
    appPassword: "",
    connectedAt: Date.now(),
    ...overrides,
  } as WordPressSite;
}

describe("pickInitialSitemapUrlForMode", () => {
  it("offerings prefers main sitemap over entity sitemap", () => {
    const site = minimalSite({
      entitySitemapUrl: "https://example.com/entity-sitemap.xml",
      sitemaps: {
        mainSitemapUrl: "https://example.com/wp-sitemap.xml",
        detectedAt: 1,
        type: "index",
        childSitemaps: [],
      },
    });
    expect(pickInitialSitemapUrlForMode(site, "offerings")).toBe("https://example.com/wp-sitemap.xml");
  });

  it("entity mode prefers entity sitemap over main", () => {
    const site = minimalSite({
      entitySitemapUrl: "https://example.com/entity-sitemap.xml",
      sitemaps: {
        mainSitemapUrl: "https://example.com/wp-sitemap.xml",
        detectedAt: 1,
        type: "index",
        childSitemaps: [],
      },
    });
    expect(pickInitialSitemapUrlForMode(site, "entity")).toBe("https://example.com/entity-sitemap.xml");
  });

  it("offerings prefers scored child over entity when main is missing", () => {
    const site = minimalSite({
      entitySitemapUrl: "https://example.com/entity-sitemap.xml",
      sitemaps: {
        mainSitemapUrl: "",
        detectedAt: 1,
        type: "index",
        childSitemaps: [
          "https://example.com/entity-sitemap.xml",
          "https://example.com/post-sitemap.xml",
        ],
      },
    });
    expect(pickInitialSitemapUrlForMode(site, "offerings")).toBe("https://example.com/post-sitemap.xml");
  });
});

describe("pickChildSitemapUrlForOfferings", () => {
  it("prefers post-sitemap over location-style sitemap", () => {
    const children = [
      "https://example.com/location-sitemap.xml",
      "https://example.com/post-sitemap.xml",
    ];
    expect(pickChildSitemapUrlForOfferings(children)).toBe("https://example.com/post-sitemap.xml");
  });
});

describe("scoreSitemapUrlForOfferings", () => {
  it("scores content sitemaps lower than location sitemaps", () => {
    expect(
      scoreSitemapUrlForOfferings("https://example.com/post-sitemap.xml") <
        scoreSitemapUrlForOfferings("https://example.com/entity-sitemap.xml")
    ).toBe(true);
  });
});
