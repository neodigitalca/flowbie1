import { describe, expect, it } from "vitest";
import {
  buildPeerMarketPromptRows,
  parseSameMarketSiteIds,
  peerMarketSelectionCacheKey,
} from "@/lib/overview/sap-peer-market-select";
import type { WordPressSite } from "@/components/integrations/types";

function mockSite(partial: Partial<WordPressSite> & Pick<WordPressSite, "id" | "name" | "siteUrl">): WordPressSite {
  return {
    username: "u",
    appPassword: "p",
    entitySitemapUrl: `${partial.siteUrl}/service-area-sitemap.xml`,
    enabled: false,
    ...partial,
  } as WordPressSite;
}

describe("sap-peer-market-select helpers", () => {
  it("builds NAP cities for Phoenix Painting Edmonton vs Florida", () => {
    const phoenix = mockSite({
      id: "phoenix",
      name: "Phoenix Finishing Touch Painting",
      siteUrl: "https://phoenixpainting.ca",
      napInfo: {
        locations: [
          {
            id: "1",
            name: "P",
            address: "123 Main St",
            city: "Edmonton",
            state: "AB",
            zip: "",
            phone: "",
            isDefault: true,
          },
        ],
      },
    });
    const florida = mockSite({
      id: "fl",
      name: "In the Shade Florida",
      siteUrl: "https://intheshadeflorida.com",
      napInfo: {
        locations: [
          {
            id: "1",
            name: "F",
            address: "",
            city: "Sarasota",
            state: "FL",
            zip: "",
            phone: "",
            isDefault: true,
          },
        ],
      },
    });
    const rows = buildPeerMarketPromptRows([phoenix, florida]);
    expect(rows.find((r) => r.id === "phoenix")?.napCities).toEqual(["Edmonton"]);
    expect(rows.find((r) => r.id === "fl")?.napCities).toEqual(["Sarasota"]);
  });

  it("parseSameMarketSiteIds only returns allowed peer ids", () => {
    const allowed = new Set(["heritage", "phoenix"]);
    expect(
      parseSameMarketSiteIds(
        { siteIds: ["phoenix", "florida", "heritage"] },
        allowed,
      ),
    ).toEqual(["phoenix", "heritage"]);
  });

  it("parseSameMarketSiteIds keeps every allowed matching id (no cap)", () => {
    const allowed = new Set(["a", "b", "c", "d", "e"]);
    expect(
      parseSameMarketSiteIds(
        { siteIds: ["a", "b", "c", "d", "e"] },
        allowed,
      ),
    ).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("peersMatchingPlaceEntityByNapCity includes Edmonton NAP Phoenix for City Centre entity", async () => {
    const { peersMatchingPlaceEntityByNapCity } = await import(
      "@/lib/overview/sap-peer-market-select"
    );
    const phoenix = mockSite({
      id: "phoenix",
      name: "Phoenix Finishing Touch Painting",
      siteUrl: "https://phoenixpainting.ca",
      napInfo: {
        locations: [
          {
            id: "1",
            name: "P",
            address: "123 Main",
            city: "Edmonton",
            state: "AB",
            zip: "",
            phone: "",
            isDefault: true,
          },
        ],
      },
    });
    const florida = mockSite({
      id: "fl",
      name: "In the Shade Florida",
      siteUrl: "https://intheshadeflorida.com",
      napInfo: {
        locations: [
          {
            id: "1",
            name: "F",
            address: "",
            city: "Sarasota",
            state: "FL",
            zip: "",
            phone: "",
            isDefault: true,
          },
        ],
      },
    });
    const matched = peersMatchingPlaceEntityByNapCity("Edmonton City Centre", [
      phoenix,
      florida,
    ]);
    expect(matched.map((p) => p.id)).toEqual(["phoenix"]);
  });

  it("marketCityFromWriteSiteHints picks Edmonton from City Centre entity", async () => {
    const { marketCityFromWriteSiteHints } = await import(
      "@/lib/overview/sap-peer-market-select"
    );
    expect(marketCityFromWriteSiteHints("Edmonton City Centre", ["Edmonton"])).toBe(
      "Edmonton",
    );
    expect(marketCityFromWriteSiteHints("Walterdale Bridge", ["Edmonton"])).toBe("");
  });

  it("peersMatchingMarketCity matches NAP and name/url city tokens", async () => {
    const { peersMatchingMarketCity } = await import(
      "@/lib/overview/sap-peer-market-select"
    );
    const heritage = mockSite({
      id: "heritage",
      name: "Heritage Dental Centre",
      siteUrl: "https://heritagedentaledmonton.ca",
    });
    const manitoba = mockSite({
      id: "mb",
      name: "Advance Blinds Manitoba",
      siteUrl: "https://advanceblinds.ca",
    });
    const phoenix = mockSite({
      id: "phoenix",
      name: "Phoenix Painting",
      siteUrl: "https://phoenixpainting.ca",
      napInfo: {
        locations: [
          {
            id: "1",
            name: "P",
            address: "",
            city: "Edmonton",
            state: "AB",
            zip: "",
            phone: "",
            isDefault: true,
          },
        ],
      },
    });
    const matched = peersMatchingMarketCity("Edmonton", [heritage, manitoba, phoenix]);
    expect(matched.map((p) => p.id).sort()).toEqual(["heritage", "phoenix"]);
  });

  it("cache key is stable for peer id order", () => {
    const a = mockSite({ id: "a", name: "A", siteUrl: "https://a.example" });
    const b = mockSite({ id: "b", name: "B", siteUrl: "https://b.example" });
    expect(peerMarketSelectionCacheKey("Edmonton City Centre", [a, b])).toBe(
      peerMarketSelectionCacheKey("Edmonton City Centre", [b, a]),
    );
  });
});
