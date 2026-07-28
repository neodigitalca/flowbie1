import { describe, expect, it } from "vitest";
import { buildWordPressPostsForLinkingFromInventory } from "../extra-text-inventory-links";
import { buildInventoryLookupMaps, type BulkOptimizerInventorySnapshot } from "@/lib/wordpress-api/inventory-match";

describe("buildWordPressPostsForLinkingFromInventory", () => {
  it("returns posts and pages with link + title from inventory maps", () => {
    const posts = [
      {
        id: 1,
        slug: "blog-one",
        url: "https://example.com/blog-one/",
        date_gmt: "2024-01-01",
        fields: { title: "Blog One", meta: "", keyword: "", excerpt: "Excerpt" },
      },
    ];
    const pages = [
      {
        id: 2,
        slug: "partner",
        url: "https://example.com/partner/",
        date_gmt: "2024-01-02",
        fields: { title: "Partner", meta: "", keyword: "", excerpt: "" },
      },
    ];
    const sapRows = [
      {
        id: 3,
        slug: "blinds-winnipeg",
        url: "https://example.com/blinds-winnipeg/",
        date_gmt: "2024-01-03",
        fields: { title: "Blinds Winnipeg", meta: "", keyword: "", excerpt: "SAP page" },
      },
    ];
    const snapshot: BulkOptimizerInventorySnapshot = {
      postsMaps: buildInventoryLookupMaps(posts, "https://example.com"),
      pagesMaps: buildInventoryLookupMaps(pages, "https://example.com"),
      customMapsByCollection: {
        "service-area": buildInventoryLookupMaps(sapRows, "https://example.com"),
      },
    };

    const rows = buildWordPressPostsForLinkingFromInventory(snapshot, "https://example.com");
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.link).sort()).toEqual([
      "https://example.com/blinds-winnipeg/",
      "https://example.com/blog-one/",
      "https://example.com/partner/",
    ]);
  });

  it("excludes custom CPT maps when postsPagesOnly is set", () => {
    const posts = [
      {
        id: 1,
        slug: "blog-one",
        url: "https://example.com/blog-one/",
        date_gmt: "2024-01-01",
        fields: { title: "Blog One", meta: "", keyword: "", excerpt: "Excerpt" },
      },
    ];
    const sapRows = [
      {
        id: 3,
        slug: "blinds-winnipeg",
        url: "https://example.com/blinds-winnipeg/",
        date_gmt: "2024-01-03",
        fields: { title: "Blinds Winnipeg", meta: "", keyword: "", excerpt: "SAP page" },
      },
    ];
    const snapshot: BulkOptimizerInventorySnapshot = {
      postsMaps: buildInventoryLookupMaps(posts, "https://example.com"),
      pagesMaps: buildInventoryLookupMaps([], "https://example.com"),
      customMapsByCollection: {
        "service-area": buildInventoryLookupMaps(sapRows, "https://example.com"),
      },
    };

    const rows = buildWordPressPostsForLinkingFromInventory(snapshot, "https://example.com", {
      postsPagesOnly: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.link).toBe("https://example.com/blog-one/");
  });
});
