import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import type { SiteInventoryBulkRow } from "@/lib/wordpress-api/types";
import {
  clearBulkGenerationWpInventoryCache,
  getBulkGenerationWpInventoryEntry,
  seedBulkGenerationWpInventoryFromBundle,
  setBulkGenerationWpInventoryEntry,
} from "@/lib/bulk/bulk-generation-inventory-cache-store";

const site = { id: "inv-cache-test-site" } as WordPressSite;

const sapRow: SiteInventoryBulkRow = {
  id: 12,
  url: "https://lindseyblindsetc.com/service-area/park-shore/",
  collection: "sap",
  fields: { title: "Park Shore, Naples, FL", meta: "", keyword: "" },
};

describe("seedBulkGenerationWpInventoryFromBundle", () => {
  it("keeps sitemap rows when the warm bundle later reports a GSC error", () => {
    clearBulkGenerationWpInventoryCache(site.id);
    seedBulkGenerationWpInventoryFromBundle(site, {
      bulkInventoryRows: [sapRow],
      fetchedAt: 1,
    });
    seedBulkGenerationWpInventoryFromBundle(site, {
      bulkInventoryRows: [],
      fetchedAt: 2,
      error: "Google Search Console returned no keywords for this site.",
    });
    const cached = getBulkGenerationWpInventoryEntry(site.id);
    expect(cached?.error).toBeUndefined();
    expect(cached?.rows).toHaveLength(1);
    expect(cached?.rows[0]?.url).toBe(sapRow.url);
  });

  it("writes rows from a later bundle even if an earlier GSC error was stored", () => {
    clearBulkGenerationWpInventoryCache(site.id);
    setBulkGenerationWpInventoryEntry({
      siteId: site.id,
      rows: [],
      fetchedAt: 1,
      error: "Google Search Console returned no keywords for this site.",
    });
    seedBulkGenerationWpInventoryFromBundle(site, {
      bulkInventoryRows: [sapRow],
      fetchedAt: 3,
      error: "Google Search Console returned no keywords for this site.",
    });
    const cached = getBulkGenerationWpInventoryEntry(site.id);
    expect(cached?.error).toBeUndefined();
    expect(cached?.rows).toHaveLength(1);
  });
});
