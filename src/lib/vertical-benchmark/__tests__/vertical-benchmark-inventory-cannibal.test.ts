import { describe, expect, it } from "vitest";
import {
  buildInventoryKeywordSet,
  conflictsWithInventoryKeyword,
} from "../vertical-benchmark-inventory-cannibal";

function inventoryJson(
  posts: Array<{ url: string; keyword?: string; title?: string; keyword_focus?: string }>,
): string {
  return JSON.stringify({
    site: { url: "https://example.com" },
    generatedAt: new Date().toISOString(),
    posts: posts.map((p) => ({
      url: p.url,
      fields: {
        title: p.title ?? "",
        meta: "",
        keyword: p.keyword ?? "",
      },
      acf: p.keyword_focus ? { keyword_focus: p.keyword_focus } : undefined,
    })),
  });
}

describe("buildInventoryKeywordSet", () => {
  it("collects keyword, keyword_focus, and title without duplicates", () => {
    const set = buildInventoryKeywordSet(
      inventoryJson([
        {
          url: "https://example.com/motorized-shades",
          keyword: "motorized shades",
          title: "Motorized Shades Guide",
          keyword_focus: "motorized shades",
        },
        {
          url: "https://example.com/cellular-shades",
          keyword: "cellular shades",
          title: "Cellular Shades Benefits",
        },
      ]),
    );
    expect(set.phrases).toContain("motorized shades");
    expect(set.phrases).toContain("Motorized Shades Guide");
    expect(set.phrases).toContain("cellular shades");
    expect(set.phrases.filter((p) => p.toLowerCase().includes("motorized"))).toHaveLength(2);
  });
});

describe("conflictsWithInventoryKeyword", () => {
  const inventory = buildInventoryKeywordSet(
    inventoryJson([
      { url: "https://example.com/a", keyword: "motorized shades", title: "Motorized Shades Guide" },
      { url: "https://example.com/b", keyword: "hunter douglas blinds", title: "Hunter Douglas Blinds" },
    ]),
  );

  it("flags exact normalized match", () => {
    const hit = conflictsWithInventoryKeyword("Motorized Shades", inventory);
    expect(hit.conflicts).toBe(true);
    if (hit.conflicts) expect(hit.matched.toLowerCase()).toContain("motorized");
  });

  it("flags substring grep when inventory phrase is contained", () => {
    const hit = conflictsWithInventoryKeyword("best motorized shades tips", inventory);
    expect(hit.conflicts).toBe(true);
  });

  it("flags near-synonym reordering", () => {
    const hit = conflictsWithInventoryKeyword("shades motorized", inventory);
    expect(hit.conflicts).toBe(true);
  });

  it("allows unrelated topics", () => {
    const hit = conflictsWithInventoryKeyword("plantation shutters", inventory);
    expect(hit.conflicts).toBe(false);
  });
});
