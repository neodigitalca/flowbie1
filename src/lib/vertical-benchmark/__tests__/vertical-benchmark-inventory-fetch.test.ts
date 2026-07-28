import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import { benchmarkCurateInventoryCollections } from "@/lib/vertical-benchmark/vertical-benchmark-inventory-fetch";

const site = {
  id: "s1",
  name: "Test",
  siteUrl: "https://example.com",
  entitySitemapUrl: "https://example.com/service-area-sitemap.xml",
} as WordPressSite;

describe("benchmarkCurateInventoryCollections", () => {
  it("uses posts and pages only for post-only curate", () => {
    expect(benchmarkCurateInventoryCollections(site, ["post"])).toEqual(["posts", "pages"]);
  });

  it("includes entity REST collections when entity rows are curated", () => {
    const cols = benchmarkCurateInventoryCollections(site, ["post", "entity"]);
    expect(cols).toContain("posts");
    expect(cols).toContain("pages");
    expect(cols.length).toBeGreaterThan(2);
  });
});
