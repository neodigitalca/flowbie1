import { describe, expect, it } from "vitest";
import { filterInventoryByGscPages } from "@/lib/sitemap-optimizer/filter-inventory-by-gsc-pages";
import type { GscParsedPageRow } from "@/lib/sitemap-optimizer/parse-gsc-pages-csv";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function invRow(url: string, postId: string): SitemapOptimizerPostRow {
  return {
    postId,
    url,
    collection: "posts",
    title: postId,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: false,
  };
}

describe("filterInventoryByGscPages", () => {
  const upload: GscParsedPageRow[] = [
    {
      page: "https://www.example.com/blog/post-a",
      clicks: 0,
      impressions: 30,
      ctr: 0,
      position: 10,
    },
  ];

  it("matches trailing slash variants", () => {
    const inventory = [invRow("https://www.example.com/blog/post-a/", "wp:1")];
    const result = filterInventoryByGscPages(inventory, upload);
    expect(result.matchedCount).toBe(1);
    expect(result.rows[0]?.gscPageImpressions).toBe(30);
    expect(result.unmatchedUploadCount).toBe(0);
  });

  it("returns zero rows when nothing matches", () => {
    const inventory = [invRow("https://other.com/x/", "wp:9")];
    const result = filterInventoryByGscPages(inventory, upload);
    expect(result.rows).toHaveLength(0);
    expect(result.matchedCount).toBe(0);
    expect(result.unmatchedUploadCount).toBe(1);
  });
});
