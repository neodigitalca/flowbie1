import { describe, expect, it } from "vitest";
import type { SitePostInventoryRow } from "@/lib/wordpress-api/types";
import {
  buildInventoryBucketHarnessMarkdown,
  buildOverviewInventoryCsv,
  buildOverviewSitemapUrlsInventoryCsv,
  mergeOverviewInventoryRows,
} from "@/lib/overview/overview-inventory-csv";
import {
  buildInventoryLookupMaps,
  type BulkOptimizerInventorySnapshot,
} from "@/lib/wordpress-api/inventory-match";

const basePost: SitePostInventoryRow = {
  id: 1,
  url: "https://example.com/hello/",
  slug: "hello",
  date_gmt: "2024-01-01T00:00:00",
  fields: { title: "Hello", keyword: "k1", meta: "m1" },
};

describe("overview-inventory-csv", () => {
  it("mergeOverviewInventoryRows tags posts and pages", () => {
    const page: SitePostInventoryRow = {
      id: 2,
      url: "https://example.com/about/",
      slug: "about",
      fields: { title: "About", keyword: "", meta: "" },
    };
    const merged = mergeOverviewInventoryRows([basePost], [page]);
    expect(merged.map((r) => r.collection)).toEqual(["posts", "pages"]);
    expect(merged[0].id).toBe(1);
    expect(merged[1].id).toBe(2);
  });

  it("buildOverviewInventoryCsv includes BOM and expected columns", () => {
    const csv = buildOverviewInventoryCsv(
      [
        {
          ...basePost,
          collection: "posts",
          acf: { faq: "Q?", seo_research: "{}" },
        },
      ],
      "https://example.com",
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("id,url,slug,collection");
    expect(csv).toContain("excerpt_plain");
    expect(csv).toContain("hello");
    expect(csv).toContain("posts");
    expect(csv).toContain("Q?");
  });

  it("buildInventoryBucketHarnessMarkdown excludes global page hubs from pages export", () => {
    const snapshot: BulkOptimizerInventorySnapshot = {
      postsMaps: buildInventoryLookupMaps([], "https://example.com"),
      pagesMaps: buildInventoryLookupMaps(
        [
          {
            ...basePost,
            url: "https://example.com/services/custom-drapery/",
            slug: "custom-drapery",
            fields: { title: "Custom Drapery", keyword: "", meta: "Meta line" },
          },
          {
            ...basePost,
            id: 2,
            url: "https://example.com/blog/",
            slug: "blog",
            fields: { title: "Blog", keyword: "", meta: "" },
          },
          {
            ...basePost,
            id: 3,
            url: "https://example.com/faq/",
            slug: "faq",
            fields: { title: "FAQ", keyword: "", meta: "" },
          },
          {
            ...basePost,
            id: 4,
            url: "https://example.com/service-area/",
            slug: "service-area",
            fields: { title: "Service Areas", keyword: "", meta: "" },
          },
        ],
        "https://example.com",
      ),
      customMapsByCollection: {},
    };
    const md = buildInventoryBucketHarnessMarkdown(snapshot, "https://example.com", "pages");
    expect(md).toContain("custom-drapery");
    expect(md).not.toContain("/blog/");
    expect(md).not.toContain("/faq/");
    expect(md).not.toContain("/service-area/");
  });

  it("buildOverviewSitemapUrlsInventoryCsv emits slim url/title/meta rows", () => {
    const snapshot: BulkOptimizerInventorySnapshot = {
      postsMaps: buildInventoryLookupMaps([], "https://example.com"),
      pagesMaps: buildInventoryLookupMaps(
        [
          {
            ...basePost,
            url: "https://example.com/about/",
            slug: "about",
            fields: { title: "About", keyword: "", meta: "About us" },
          },
        ],
        "https://example.com",
      ),
      customMapsByCollection: {},
    };
    const csv = buildOverviewSitemapUrlsInventoryCsv(
      ["https://example.com/about/", "https://example.com/privacy-policy/", "https://example.com/missing/"],
      "https://example.com",
      snapshot,
    );
    const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
    expect(lines[0]).toBe("url,title,meta");
    expect(lines[1]).toContain("about");
    expect(lines[1]).toContain("About us");
    expect(lines.some((line) => line.includes("privacy-policy"))).toBe(false);
    expect(lines.some((line) => line.includes("missing"))).toBe(true);
  });
});
