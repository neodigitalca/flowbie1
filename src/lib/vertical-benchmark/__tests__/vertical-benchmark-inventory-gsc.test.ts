import { describe, expect, it } from "vitest";
import {
  buildInventoryUrlSet,
  gscOutputPagesExcludingPublishedInventory,
  normalizeInventoryUrl,
} from "../vertical-benchmark-inventory-gsc";
import type { GscTop10RagPage } from "../vertical-benchmark-gsc-rag";

function page(rank: number, url: string): GscTop10RagPage {
  return { rank, url, clicks: 10, impressions: 100, position: 3, content_kind: "post" };
}

describe("normalizeInventoryUrl", () => {
  it("strips trailing slash and lowercases", () => {
    expect(normalizeInventoryUrl("https://Example.com/blog/post/")).toBe("https://example.com/blog/post");
  });
});

describe("gscOutputPagesExcludingPublishedInventory", () => {
  const inventory = JSON.stringify({
    posts: [
      {
        url: "https://blindmagic.com/blog/hunter-douglas-vs-alta/",
        fields: { title: "Hunter Douglas Vs Alta", keyword: "hunter douglas vs alta", meta: "" },
      },
    ],
  });

  it("swaps published GSC URL for next GSC page not in inventory", () => {
    const output = [page(3, "https://blindmagic.com/blog/hunter-douglas-vs-alta/")];
    const pool = [
      page(3, "https://blindmagic.com/blog/hunter-douglas-vs-alta/"),
      page(11, "https://blindmagic.com/blog/battery-wand-guide/"),
    ];
    const { pages, swapped, droppedPublishedUrls } = gscOutputPagesExcludingPublishedInventory(
      output,
      pool,
      inventory,
    );
    expect(droppedPublishedUrls).toContain("https://blindmagic.com/blog/hunter-douglas-vs-alta/");
    expect(swapped).toHaveLength(1);
    expect(pages[0]?.url).toBe("https://blindmagic.com/blog/battery-wand-guide/");
  });

  it("keeps GSC page when URL is not in inventory", () => {
    const output = [page(1, "https://blindmagic.com/blog/new-topic/")];
    const { pages, swapped } = gscOutputPagesExcludingPublishedInventory(output, output, inventory);
    expect(swapped).toHaveLength(0);
    expect(pages[0]?.url).toBe("https://blindmagic.com/blog/new-topic/");
  });

  it("buildInventoryUrlSet includes published url", () => {
    const set = buildInventoryUrlSet(inventory);
    expect(set.has(normalizeInventoryUrl("https://blindmagic.com/blog/hunter-douglas-vs-alta/"))).toBe(true);
  });
});
