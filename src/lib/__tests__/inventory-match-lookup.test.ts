import { describe, expect, it } from "vitest";
import {
  buildInventoryLookupMaps,
  lookupInventoryRowWithSource,
  type BulkOptimizerInventorySnapshot,
} from "@/lib/wordpress-api/inventory-match";
import type { SitePostInventoryRow } from "@/lib/wordpress-api/types";

const siteUrl = "https://example.com";

function row(id: number, url: string, slug: string, title: string): SitePostInventoryRow {
  return {
    id,
    url,
    slug,
    fields: { title, keyword: "", meta: "", content: "", excerpt: "" },
  };
}

describe("lookupInventoryRowWithSource", () => {
  it("prefers custom CPT link match before pages slug fallback for typeHint other", () => {
    const pageRow = row(1, "https://example.com/vignette/", "vignette", "Wrong page");
    const cptRow = row(
      99,
      "https://example.com/hunter-douglas/shades/roman-shades/vignette/",
      "vignette",
      "CPT vignette",
    );
    const snapshot: BulkOptimizerInventorySnapshot = {
      postsMaps: buildInventoryLookupMaps([], siteUrl),
      pagesMaps: buildInventoryLookupMaps([pageRow], siteUrl),
      customMapsByCollection: {
        "hunter-douglas": buildInventoryLookupMaps([cptRow], siteUrl),
      },
    };
    const hit = lookupInventoryRowWithSource(
      snapshot,
      siteUrl,
      "https://example.com/hunter-douglas/shades/roman-shades/vignette/",
      "other",
    );
    expect(hit?.source).toBe("hunter-douglas");
    expect(hit?.row.id).toBe(99);
  });

  it("matches www inventory link to non-www sitemap URL", () => {
    const pageRow = row(5, "https://www.shutterspot.com/window-coverings/", "window-coverings", "Coverings");
    const snapshot: BulkOptimizerInventorySnapshot = {
      postsMaps: buildInventoryLookupMaps([], siteUrl),
      pagesMaps: buildInventoryLookupMaps([pageRow], siteUrl),
      customMapsByCollection: {},
    };
    const hit = lookupInventoryRowWithSource(
      snapshot,
      "https://shutterspot.com",
      "https://shutterspot.com/window-coverings/",
      "other",
    );
    expect(hit?.row.id).toBe(5);
  });
});
