import { describe, expect, it } from "vitest";
import {
  buildEntityCompressionProfile,
  isEntityInventoryRow,
  shouldSkipQueryEnrichmentForTrafficFilter,
} from "@/lib/sitemap-optimizer/entity-compression-profile";
import { partitionEntityAndEditorialRows } from "@/lib/sitemap-optimizer/entity-compression-partition";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function row(collection: string): SitemapOptimizerPostRow {
  return {
    postId: `wp:${collection}`,
    url: `https://example.com/${collection}/`,
    collection,
    title: collection,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: false,
  };
}

describe("entity-compression-profile", () => {
  it("activates when entity collection is selected and site has entity sitemap", () => {
    const profile = buildEntityCompressionProfile({
      site: { entitySitemapUrl: "https://example.com/service-area-sitemap.xml" } as never,
      selectedCollections: new Set(["entity"]),
      trafficFilter: "all",
    });
    expect(profile.active).toBe(true);
    expect(profile.entityEndpoint).toBe("service-area");
    expect(profile.entityOnly).toBe(true);
    expect(profile.skipCompanyPartition).toBe(true);
  });

  it("partitions entity rows from editorial rows", () => {
    const rows = [row("service-area"), row("posts"), row("pages")];
    const part = partitionEntityAndEditorialRows(rows, "service-area");
    expect(part.entityRows).toHaveLength(1);
    expect(part.editorialRows).toHaveLength(2);
  });

  it("matches entity inventory by endpoint", () => {
    expect(isEntityInventoryRow(row("service-area"), "service-area")).toBe(true);
    expect(isEntityInventoryRow(row("posts"), "service-area")).toBe(false);
  });

  it("skips query enrichment for all and no_impressions filters", () => {
    expect(shouldSkipQueryEnrichmentForTrafficFilter("all")).toBe(true);
    expect(shouldSkipQueryEnrichmentForTrafficFilter("no_impressions")).toBe(true);
    expect(shouldSkipQueryEnrichmentForTrafficFilter("traffic")).toBe(false);
  });
});
