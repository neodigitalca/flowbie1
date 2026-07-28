import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";

const getSiteInventoryBulk = vi.fn();
const parseSitemap = vi.fn();

vi.mock("@/lib/wordpress-api", () => ({
  getSiteInventoryBulk: (...args: unknown[]) => getSiteInventoryBulk(...args),
  parseSitemap: (...args: unknown[]) => parseSitemap(...args),
}));

import {
  fetchAllOverviewInventoriesParallel,
  fetchOverviewInventoryForSource,
} from "@/lib/overview/overview-parallel-inventory-fetch";
import { attachRestFieldsToEntitySitemapRows } from "@/lib/overview/overview-sap-entity-inventory";

function blindmagicLikeSite(): WordPressSite {
  return {
    id: "bm",
    name: "Blind Magic",
    siteUrl: "https://blindmagic.com",
    username: "u",
    appPassword: "p",
    connectedAt: Date.now(),
    entitySitemapUrl: "https://blindmagic.com/service-area-sitemap.xml",
    sitemaps: {
      mainSitemapUrl: "https://blindmagic.com/sitemap_index.xml",
      detectedAt: Date.now(),
      type: "index",
      childSitemaps: [
        "https://blindmagic.com/page-sitemap.xml",
        "https://blindmagic.com/post-sitemap.xml",
        "https://blindmagic.com/service-area-sitemap.xml",
      ],
    },
  } as WordPressSite;
}

describe("overview-parallel-inventory-fetch", () => {
  beforeEach(() => {
    getSiteInventoryBulk.mockReset();
    parseSitemap.mockReset();
    getSiteInventoryBulk.mockResolvedValue({ rows: [] });
    parseSitemap.mockResolvedValue({
      urls: [
        "https://blindmagic.com/service-area/blinds-hunter-douglas-blinds-mill/",
        "https://blindmagic.com/giving-back/",
      ],
    });
  });

  it("SAP uses bulk inventory rows for entity collection", async () => {
    const site = blindmagicLikeSite();
    getSiteInventoryBulk.mockResolvedValue({
      rows: [
        {
          collection: "service-area",
          id: 42,
          slug: "blinds-hunter-douglas-blinds-mill",
          url: "https://blindmagic.com/service-area/blinds-hunter-douglas-blinds-mill/",
          fields: {
            title: "Blinds Mill",
            keyword: "blinds",
            meta: "",
            content: "",
            excerpt: "Service area excerpt.",
          },
          acf: { faq: "Q: Test?\nA: Yes." },
          date_gmt: "2024-06-04T00:00:00",
        },
      ],
    });

    const result = await fetchOverviewInventoryForSource(site, "sap");
    expect(parseSitemap).not.toHaveBeenCalled();
    expect(getSiteInventoryBulk).toHaveBeenCalledTimes(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.url).toContain("/service-area/");
    expect(result.rows[0]?.id).toBe(42);
    expect(result.rows[0]?.fields.excerpt).toBe("Service area excerpt.");
  });

  it("attachRestFieldsToEntitySitemapRows keeps sitemap URL order", () => {
    const urls = [
      "https://blindmagic.com/service-area/a/",
      "https://blindmagic.com/service-area/b/",
    ];
    const merged = attachRestFieldsToEntitySitemapRows(
      "https://blindmagic.com",
      "service-area",
      urls,
      [
        {
          collection: "service-area",
          id: 2,
          slug: "b",
          url: "https://blindmagic.com/service-area/b/",
          fields: { title: "B", keyword: "", meta: "", content: "", excerpt: "b ex" },
          date_gmt: "",
        },
      ],
    );
    expect(merged.map((r) => r.url)).toEqual(urls);
    expect(merged[1]?.id).toBe(2);
    expect(merged[0]?.id).toBeUndefined();
  });

  it("fetchAllOverviewInventoriesParallel issues one bulk call for all buckets", async () => {
    const site = blindmagicLikeSite();
    await fetchAllOverviewInventoriesParallel(site);
    expect(getSiteInventoryBulk).toHaveBeenCalledTimes(1);
    expect(parseSitemap).not.toHaveBeenCalled();
    const collectionArg = (getSiteInventoryBulk.mock.calls[0]?.[3] as { collections?: string[] })
      ?.collections;
    expect(collectionArg).toContain("posts");
    expect(collectionArg).toContain("pages");
    expect(collectionArg).toContain("service-area");
  });
});
