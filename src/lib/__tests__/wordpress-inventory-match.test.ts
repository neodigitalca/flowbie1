import { describe, expect, it } from "vitest";
import {
  normalizeMatch,
  slugKeyFromTargetUrl,
  buildInventoryLookupMaps,
  lookupInventoryRow,
  lookupInventoryRowWithSource,
  inventoryRowHasUsablePrefetchData,
  type BulkOptimizerInventorySnapshot,
} from "@/lib/wordpress-api/inventory-match";
import type { SitePostInventoryRow } from "@/lib/wordpress-api/types";

describe("wordpress-inventory-match", () => {
  const site = "https://example.com";

  it("normalizeMatch agrees for absolute link and path-only target", () => {
    const a = normalizeMatch(site, "https://example.com/blog/my-post");
    const b = normalizeMatch(site, "/blog/my-post");
    expect(a).toBe(b);
    expect(a.endsWith("/blog/my-post")).toBe(true);
  });

  it("slugKeyFromTargetUrl extracts last segment", () => {
    expect(slugKeyFromTargetUrl(site, "https://example.com/foo/bar/hello-world")).toBe("hello-world");
    expect(slugKeyFromTargetUrl(site, "/foo/hello-world")).toBe("hello-world");
  });

  it("lookupInventoryRow matches by link then slug", () => {
    const rows: SitePostInventoryRow[] = [
      {
        id: 1,
        slug: "alpha",
        url: "https://example.com/a/alpha",
        fields: { title: "A", meta: "", keyword: "kw" },
      },
    ];
    const snapshot: BulkOptimizerInventorySnapshot = {
      postsMaps: buildInventoryLookupMaps(rows, site),
      pagesMaps: { bySlug: new Map(), byLink: new Map() },
    };
    expect(lookupInventoryRow(snapshot, site, "https://example.com/a/alpha", "post")?.id).toBe(1);
    expect(lookupInventoryRow(snapshot, site, "/a/alpha", "post")?.id).toBe(1);
  });

  it("lookupInventoryRowWithSource prefers pages when typeHint is page", () => {
    const postRow: SitePostInventoryRow = {
      id: 1,
      slug: "same",
      url: "https://example.com/same",
      fields: { title: "Post", meta: "", keyword: "" },
    };
    const pageRow: SitePostInventoryRow = {
      id: 2,
      slug: "same",
      url: "https://example.com/same",
      fields: { title: "Page", meta: "", keyword: "" },
    };
    const snapshot: BulkOptimizerInventorySnapshot = {
      postsMaps: buildInventoryLookupMaps([postRow], site),
      pagesMaps: buildInventoryLookupMaps([pageRow], site),
    };
    const hitPage = lookupInventoryRowWithSource(snapshot, site, "https://example.com/same", "page");
    expect(hitPage?.source).toBe("pages");
    expect(hitPage?.row.id).toBe(2);
    const hitPost = lookupInventoryRowWithSource(snapshot, site, "https://example.com/same", "post");
    expect(hitPost?.source).toBe("posts");
    expect(hitPost?.row.id).toBe(1);
  });

  it("lookupInventoryRowWithSource matches custom entity CPT maps", () => {
    const entityRow: SitePostInventoryRow = {
      id: 99,
      slug: "government-solar-loans-edmonton-ab",
      url: "https://ridgelinesolar.ca/service-area/government-solar-loans-edmonton-ab/",
      fields: { title: "Gov loans", meta: "", keyword: "" },
    };
    const snapshot: BulkOptimizerInventorySnapshot = {
      postsMaps: { bySlug: new Map(), byLink: new Map() },
      pagesMaps: { bySlug: new Map(), byLink: new Map() },
      customMapsByCollection: {
        "service-area": buildInventoryLookupMaps([entityRow], "https://ridgelinesolar.ca"),
      },
    };
    const hit = lookupInventoryRowWithSource(
      snapshot,
      "https://ridgelinesolar.ca",
      "https://ridgelinesolar.ca/service-area/government-solar-loans-edmonton-ab/",
      "other",
    );
    expect(hit?.source).toBe("service-area");
    expect(hit?.row.id).toBe(99);
  });

  it("inventoryRowHasUsablePrefetchData is true for title-only entity row", () => {
    const row: SitePostInventoryRow = {
      id: 1,
      slug: "thin",
      url: "https://example.com/thin/",
      fields: { title: "Thin page", meta: "", keyword: "", content: "", excerpt: "" },
    };
    expect(inventoryRowHasUsablePrefetchData(row)).toBe(true);
    expect(inventoryRowHasUsablePrefetchData({ ...row, fields: { ...row.fields, title: "" } })).toBe(
      true,
    );
  });
});
