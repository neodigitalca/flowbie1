import { beforeEach, describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  buildOverviewSitemapLoadFingerprint,
  clearOverviewSitemapLoadFingerprints,
  getOverviewSitemapLoadFingerprint,
  setOverviewSitemapLoadFingerprint,
  shouldSkipOverviewSitemapLoad,
} from "@/lib/overview/overview-sitemap-load-cache";

function shutterspotSite(overrides: Partial<WordPressSite> = {}): WordPressSite {
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
      ],
    },
    ...overrides,
  } as WordPressSite;
}

function cachedRow(): OverviewRow {
  return {
    url: "https://shutterspot.com/about/",
    title: "About",
    metaDescription: "",
    aiTitle: "",
    aiMeta: "",
    aiSuggestedPath: "",
    status: "idle",
    focusKeyword: "",
    faq: "",
    dateModifier: "",
    seoResearch: "",
  };
}

describe("buildOverviewSitemapLoadFingerprint", () => {
  beforeEach(() => {
    clearOverviewSitemapLoadFingerprints("shutterspot");
  });

  it("is stable for the same site and source", () => {
    const site = shutterspotSite();
    const a = buildOverviewSitemapLoadFingerprint(site, "pages");
    const b = buildOverviewSitemapLoadFingerprint(site, "pages");
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("changes when excluded child sitemaps change", () => {
    const site = shutterspotSite();
    const before = buildOverviewSitemapLoadFingerprint(site, "pages");
    const changed = shutterspotSite({
      sitemaps: {
        ...shutterspotSite().sitemaps!,
        disabledChildSitemapUrls: ["https://shutterspot.com/hunter-douglas-sitemap.xml"],
      },
    });
    const after = buildOverviewSitemapLoadFingerprint(changed, "pages");
    expect(after).not.toBe(before);
  });
});

describe("shouldSkipOverviewSitemapLoad", () => {
  beforeEach(() => {
    clearOverviewSitemapLoadFingerprints("shutterspot");
  });

  it("returns false when cached rows are empty", () => {
    const site = shutterspotSite();
    expect(shouldSkipOverviewSitemapLoad("shutterspot", "pages", site, null)).toBe(false);
    expect(shouldSkipOverviewSitemapLoad("shutterspot", "pages", site, [])).toBe(false);
  });

  it("returns false when fingerprint does not match stored value", () => {
    const site = shutterspotSite();
    setOverviewSitemapLoadFingerprint("shutterspot", "pages", "stale-fingerprint");
    expect(shouldSkipOverviewSitemapLoad("shutterspot", "pages", site, [cachedRow()])).toBe(
      false,
    );
  });

  it("returns true when fingerprint matches stored value", () => {
    const site = shutterspotSite();
    const fp = buildOverviewSitemapLoadFingerprint(site, "pages");
    setOverviewSitemapLoadFingerprint("shutterspot", "pages", fp);
    expect(shouldSkipOverviewSitemapLoad("shutterspot", "pages", site, [cachedRow()])).toBe(true);
    expect(getOverviewSitemapLoadFingerprint("shutterspot", "pages")).toBe(fp);
  });

  it("persists fingerprint and skips when rows exist but fingerprint was missing", () => {
    const site = shutterspotSite();
    expect(getOverviewSitemapLoadFingerprint("shutterspot", "pages")).toBeNull();
    expect(shouldSkipOverviewSitemapLoad("shutterspot", "pages", site, [cachedRow()])).toBe(true);
    expect(getOverviewSitemapLoadFingerprint("shutterspot", "pages")).toBe(
      buildOverviewSitemapLoadFingerprint(site, "pages"),
    );
  });
});
