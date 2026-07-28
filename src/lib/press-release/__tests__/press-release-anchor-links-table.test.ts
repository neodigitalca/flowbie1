import { describe, expect, it } from "vitest";
import {
  isLikelyBlogInventoryUrl,
  isMoneyPageInventoryRow,
  pickPressReleaseAnchorsFromInventory,
} from "../press-release-anchor-from-inventory";
import { buildAutoPressReleaseAnchorLinks } from "../press-release-anchor-links-table";

const inventory = [
  {
    collection: "pages" as const,
    url: "https://interiorsbylaura.com/",
    fields: { title: "Home", meta: "", keyword: "Interiors by Laura" },
  },
  {
    collection: "pages" as const,
    url: "https://interiorsbylaura.com/interior-design-near-me/",
    fields: { title: "Interior design near me", meta: "", keyword: "interior design near me" },
  },
  {
    collection: "pages" as const,
    url: "https://interiorsbylaura.com/custom-blinds/",
    fields: { title: "Custom blinds", meta: "", keyword: "custom blinds" },
  },
  {
    collection: "posts" as const,
    url: "https://interiorsbylaura.com/blog/spring-trends/",
    fields: { title: "Spring trends", meta: "", keyword: "spring trends blog" },
  },
];

describe("press release anchor inventory filters", () => {
  it("treats wp posts collection and blog paths as non-money", () => {
    expect(isMoneyPageInventoryRow(inventory[3])).toBe(false);
    expect(isLikelyBlogInventoryUrl("https://example.com/blog/hello/")).toBe(true);
    expect(isMoneyPageInventoryRow(inventory[2])).toBe(true);
  });
});

describe("buildAutoPressReleaseAnchorLinks", () => {
  it("returns homepage plus two money pages, never blog posts", () => {
    const links = buildAutoPressReleaseAnchorLinks({
      primaryKeyword: "interior design near me",
      siteName: "Interiors by Laura",
      siteUrl: "https://interiorsbylaura.com",
      headline: "Interior design",
      releaseMarkdown: "## Blinds\n\n[blog](https://interiorsbylaura.com/blog/spring-trends/)",
      inventoryRows: inventory,
    });

    expect(links).toHaveLength(3);
    expect(links[0].url.replace(/\/+$/, "")).toMatch(/interiorsbylaura\.com$/);
    expect(links.some((l) => l.url.includes("/blog/"))).toBe(false);
    const urls = links.map((r) => r.url.replace(/\/+$/, ""));
    expect(new Set(urls).size).toBe(3);
  });
});

describe("pickPressReleaseAnchorsFromInventory", () => {
  it("orders homepage first then keyword-matching pages", () => {
    const picked = pickPressReleaseAnchorsFromInventory(
      inventory,
      "interior design near me",
      "https://interiorsbylaura.com",
      "Interiors by Laura",
    );
    expect(picked).toHaveLength(3);
    expect(picked[0].url.replace(/\/+$/, "")).toMatch(/interiorsbylaura\.com$/);
    expect(picked[1].url).toContain("interior-design-near-me");
    expect(picked.every((p) => !p.url.includes("/blog/"))).toBe(true);
  });
});
