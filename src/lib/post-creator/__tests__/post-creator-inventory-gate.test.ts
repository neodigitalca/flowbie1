import { describe, expect, it } from "vitest";
import {
  buildPostCreatorInventoryCatalog,
  deriveSlugFromText,
  lookupInventoryByUrl,
} from "@/lib/post-creator/post-creator-cannibalization-tools";
import {
  buildPostCreatorInventoryContext,
  runDeterministicPostCreatorGate,
} from "@/lib/post-creator/post-creator-inventory-gate";
import type { LoadBulkSitemapInventoryResult } from "@/lib/bulk/bulk-sitemap-inventory-session";

function postsBucketJson(urls: string[]): string {
  return JSON.stringify({
    source: "posts",
    posts: urls.map((link, i) => ({
      id: i + 1,
      slug: "",
      title: "",
      link,
    })),
  });
}

function emptyInventory(urls: string[]): LoadBulkSitemapInventoryResult {
  const json = postsBucketJson(urls);
  return {
    links: [],
    buckets: {
      pages: { json: "", rowCount: 0 },
      posts: { json, rowCount: urls.length },
      sap: { json: "", rowCount: 0 },
    },
    totalRows: urls.length,
    sources: ["posts"],
    errors: {},
  };
}

describe("post-creator inventory gate", () => {
  it("blocks row when slug matches inventory URL", () => {
    const inventory = emptyInventory(["https://example.com/blog/sheer-shades/"]);
    const context = buildPostCreatorInventoryContext(inventory);
    const results = runDeterministicPostCreatorGate(
      [{ keyword: "sheer shades", title: "Sheer Shades Guide", featuredImage: "y" }],
      context,
    );
    expect(results[0]?.status).toBe("blocked");
    expect(results[0]?.conflictingUrl).toContain("sheer-shades");
  });

  it("allows distinct keyword with no inventory overlap", () => {
    const inventory = emptyInventory(["https://example.com/blog/cellular-shades/"]);
    const context = buildPostCreatorInventoryContext(inventory);
    const results = runDeterministicPostCreatorGate(
      [{ keyword: "plantation shutters", title: "Plantation Shutters Guide", featuredImage: "y" }],
      context,
    );
    expect(results[0]?.status).toBe("ok");
  });
});

describe("post-creator cannibalization tools", () => {
  it("finds inventory row by slug path", () => {
    const catalog = buildPostCreatorInventoryCatalog([
      "https://example.com/blog/battery-powered-shades/",
    ]);
    const hits = lookupInventoryByUrl(catalog, deriveSlugFromText("battery powered shades"));
    expect(hits[0]?.url).toContain("battery-powered-shades");
  });
});
