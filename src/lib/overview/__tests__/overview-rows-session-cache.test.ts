import { describe, expect, it, beforeEach } from "vitest";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  clearOverviewRowsSessionCache,
  getOverviewRowsSessionCache,
  setOverviewRowsSessionCache,
} from "@/lib/overview/overview-rows-session-cache";

function row(url: string): OverviewRow {
  return {
    url,
    title: url,
    metaDescription: "",
    focusKeyword: "",
    faq: "",
    schemaJson: "",
    seoResearch: "",
    dateModifier: "",
    status: "idle",
    aiTitle: "",
    aiMeta: "",
    postId: null,
    postType: null,
  };
}

describe("overview-rows-session-cache", () => {
  const siteId = "test-site";

  beforeEach(() => {
    clearOverviewRowsSessionCache(siteId);
  });

  it("stores each sitemap bucket under a separate cache key", () => {
    setOverviewRowsSessionCache(siteId, "pages", [row("https://example.com/page/")]);
    setOverviewRowsSessionCache(siteId, "posts", [row("https://example.com/blog/post/")]);
    setOverviewRowsSessionCache(siteId, "sap", [row("https://example.com/service-area/a/")]);

    expect(getOverviewRowsSessionCache(siteId, "pages")?.[0]?.url).toBe("https://example.com/page/");
    expect(getOverviewRowsSessionCache(siteId, "posts")?.[0]?.url).toBe("https://example.com/blog/post/");
    expect(getOverviewRowsSessionCache(siteId, "sap")?.[0]?.url).toBe("https://example.com/service-area/a/");
  });

  it("does not cross-write when switching bucket keys", () => {
    setOverviewRowsSessionCache(siteId, "pages", [row("https://example.com/giving-back/")]);
    setOverviewRowsSessionCache(siteId, "posts", [row("https://example.com/blog/commercial-blinds/")]);

    const pages = getOverviewRowsSessionCache(siteId, "pages");
    const posts = getOverviewRowsSessionCache(siteId, "posts");

    expect(pages?.[0]?.url).toContain("giving-back");
    expect(posts?.[0]?.url).toContain("commercial-blinds");
    expect(posts?.[0]?.url).not.toContain("giving-back");
  });
});
