import { describe, expect, it } from "vitest";
import { resolveInternalLinkPlaceholdersInMarkdown } from "@/lib/content-generation/internal-link-placeholders";
import { buildPressReleaseBlueprint } from "../press-release-blueprint";
import { inventoryRowsToLinkablePosts } from "../press-release-site-inventory";
import type { PressReleaseInventoryRow } from "../press-release-anchor-from-inventory";

const inventory: PressReleaseInventoryRow[] = [
  {
    id: 1,
    slug: "home",
    date_gmt: "2026-01-01T00:00:00",
    url: "https://intheshadeflorida.com/",
    fields: { title: "In the Shade", meta: "", keyword: "In the Shade", excerpt: "" },
    collection: "pages",
  },
  {
    id: 2,
    slug: "custom-blinds",
    date_gmt: "2026-01-02T00:00:00",
    url: "https://intheshadeflorida.com/custom-blinds/",
    fields: {
      title: "Custom blinds",
      meta: "Window treatments",
      keyword: "custom blinds",
      excerpt: "Residential blinds",
    },
    collection: "pages",
  },
  {
    url: "   ",
    fields: { title: "Empty", meta: "", keyword: "" },
  },
];

describe("inventoryRowsToLinkablePosts", () => {
  it("maps inventory rows to harness linkable posts and skips empty urls", () => {
    const posts = inventoryRowsToLinkablePosts(inventory);
    expect(posts).toHaveLength(2);
    expect(posts[0]).toEqual({
      id: 1,
      slug: "home",
      title: "In the Shade",
      excerpt: "",
      link: "https://intheshadeflorida.com/",
      date_gmt: "2026-01-01T00:00:00",
    });
    expect(posts[1].link).toBe("https://intheshadeflorida.com/custom-blinds/");
    expect(posts[1].title).toBe("Custom blinds");
    expect(posts[1].excerpt).toBe("Residential blinds");
  });

  it("resolves [[LINK:]] tokens against mapped inventory", async () => {
    const posts = inventoryRowsToLinkablePosts(inventory);
    const md =
      "Homeowners compare [[LINK:custom blinds|custom blinds]] with other window treatments.";
    const out = await resolveInternalLinkPlaceholdersInMarkdown(md, {
      siteUrl: "https://intheshadeflorida.com",
      wordPressPosts: posts,
      matchQueriesToUrls: async (queries) => {
        const map = new Map<string, string>();
        for (const q of queries) {
          if (q.query.toLowerCase().includes("custom blinds")) {
            map.set(q.id, "https://intheshadeflorida.com/custom-blinds/");
          }
        }
        return map;
      },
    });
    expect(out).toContain("[custom blinds](https://intheshadeflorida.com/custom-blinds/)");
    expect(out).not.toContain("[[LINK:");
    expect(out).not.toContain("blinds.com");
  });
});

describe("buildPressReleaseBlueprint link contract", () => {
  it("adds [LINK] on every agent and does not require an external citation", () => {
    const blueprint = buildPressReleaseBlueprint({ seedKeyword: "blinds" });
    expect(blueprint.purpose).toContain("[[LINK:");
    expect(blueprint.purpose).not.toMatch(/approved external/i);
    expect(blueprint.purpose).toMatch(/Never link to competitors/i);
    expect(blueprint.agents.every((agent) => agent.features.includes("[LINK]"))).toBe(true);
  });
});
