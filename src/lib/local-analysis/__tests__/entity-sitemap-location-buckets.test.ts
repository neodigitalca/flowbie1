import { describe, expect, it } from "vitest";
import type { SiteInventoryBulkRow } from "@/lib/wordpress-api/types";
import {
  buildSitemapLocationBucketsFromInventory,
  sitemapLocationLabelsFromBuckets,
  withMetroHintForSitemapPlace,
} from "@/lib/local-analysis/entity-sitemap-location-buckets";

function sapRow(url: string, title?: string): SiteInventoryBulkRow {
  return {
    collection: "service-area",
    url,
    fields: { title: title ?? "", keyword: title?.toLowerCase() ?? "" },
  } as SiteInventoryBulkRow;
}

describe("withMetroHintForSitemapPlace", () => {
  it("appends metro when place does not include city", () => {
    expect(withMetroHintForSitemapPlace("Citrus West", "Orlando, FL")).toBe("Citrus West, Orlando, FL");
  });

  it("skips duplicate metro head", () => {
    expect(withMetroHintForSitemapPlace("Orlando Heights", "Orlando, FL")).toBe("Orlando Heights");
  });
});

describe("buildSitemapLocationBucketsFromInventory", () => {
  it("groups service-area URLs by leading place slug", () => {
    const rows = [
      sapRow("https://example.com/service-area/citrus-west-blinds/"),
      sapRow("https://example.com/service-area/citrus-west-shades/"),
      sapRow("https://example.com/service-area/winter-garden/"),
    ];
    const buckets = buildSitemapLocationBucketsFromInventory(rows, "Orlando, FL");
    expect(buckets).toHaveLength(2);
    expect(buckets[0]?.placeLabel).toBe("Citrus West, Orlando, FL");
    expect(buckets[0]?.rowCount).toBe(2);
    expect(sitemapLocationLabelsFromBuckets(buckets)).toEqual([
      "Citrus West, Orlando, FL",
      "Winter Garden, Orlando, FL",
    ]);
  });
});
