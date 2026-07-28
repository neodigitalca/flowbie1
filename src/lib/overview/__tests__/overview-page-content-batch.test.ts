import { describe, expect, it } from "vitest";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import { createEmptyOverviewRow } from "@/lib/overview/overview-row-helpers";
import {
  collectPageContentIncludeIds,
  mergeInventoryContentRows,
  sliceOverviewRowsByPage,
} from "@/lib/overview/overview-page-content-batch";
import type { OverviewInventoryRow } from "@/lib/overview/overview-inventory-csv";

const site = {
  id: "wp-test",
  name: "Test",
  siteUrl: "https://example.com",
  username: "u",
  appPassword: "p",
} as WordPressSite;

describe("sliceOverviewRowsByPage", () => {
  it("slices into pages of 100", () => {
    const rows = Array.from({ length: 250 }, (_, i) => i);
    const pages = sliceOverviewRowsByPage(rows, 100);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toHaveLength(100);
    expect(pages[1]).toHaveLength(100);
    expect(pages[2]).toHaveLength(50);
  });
});

describe("collectPageContentIncludeIds", () => {
  it("collects post ids that lack full body content", () => {
    const rows: OverviewRow[] = [
      { ...createEmptyOverviewRow("https://example.com/a/"), postId: 1 },
      { ...createEmptyOverviewRow("https://example.com/b/"), postId: 2 },
      { ...createEmptyOverviewRow("https://example.com/c/"), postId: 3 },
    ];
    const bindings = {
      "https://example.com/a/": { postId: 1, subtype: "post" },
      "https://example.com/b/": { postId: 2, subtype: "post" },
      "https://example.com/c/": { postId: 3, subtype: "post" },
    };
    const ids = collectPageContentIncludeIds(
      rows,
      bindings,
      (_site, url) => {
        if (url.includes("/b/")) {
          return {
            row: {
              id: 2,
              url,
              slug: "b",
              fields: {
                title: "B",
                meta: "",
                keyword: "",
                content: "<p>" + "x".repeat(200) + "</p>",
              },
            },
            subtype: "post",
          };
        }
        if (url.includes("/a/")) {
          return {
            row: { id: 1, url, slug: "a", fields: { title: "A", meta: "", keyword: "" } },
            subtype: "post",
          };
        }
        return {
          row: { id: 3, url, slug: "c", fields: { title: "C", meta: "", keyword: "", excerpt: "short" } },
          subtype: "post",
        };
      },
      site,
    );
    expect(ids.sort((a, b) => a - b)).toEqual([1, 3]);
  });
});

describe("mergeInventoryContentRows", () => {
  it("merges content fields onto matching rows by id", () => {
    const existing: OverviewInventoryRow[] = [
      {
        id: 10,
        url: "https://example.com/post/",
        collection: "posts",
        slug: "post",
        fields: { title: "Post", meta: "", keyword: "", excerpt: "Meta" },
      },
    ];
    const contentRows: OverviewInventoryRow[] = [
      {
        id: 10,
        url: "https://example.com/post/",
        collection: "posts",
        slug: "post",
        fields: {
          title: "Post",
          meta: "",
          keyword: "",
          excerpt: "Meta",
          content: "<h2>Hello</h2><p>Body</p>",
        },
      },
    ];
    const merged = mergeInventoryContentRows(existing, contentRows);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.fields?.content).toContain("<h2>Hello</h2>");
    expect(merged[0]?.fields?.title).toBe("Post");
  });
});
