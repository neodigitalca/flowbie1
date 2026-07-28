import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  clearSapPeerEntityIndexCache,
  extractPreferredBodyImageFromHtml,
  formatSapPeerLibraryCsv,
  htmlHasLocalInContentImage,
  normalizePlaceKey,
  peerInventoryFuzzyMatchesCity,
  placeKeyFromPageUrl,
  placeKeyFromSlug,
  prewarmSapPeerSiteInventories,
  sapPageMatchesPlaceEntity,
  searchSapCrossSiteInContentImage,
  siteEnabledForSapSearch,
  stripPreferredBodyImageFromHtml,
} from "@/lib/overview/sap-cross-site-image-search";
import {
  clearSapPeerMarketSelectCache,
  parseSameMarketSiteIds,
} from "@/lib/overview/sap-peer-market-select";
import type { WordPressSite } from "@/components/integrations/types";

vi.mock("@/lib/local-analysis/entity-site-warm-cache", () => ({
  getEntitySiteWarmCacheIfReady: vi.fn(() => null),
}));

vi.mock("@/lib/overview/overview-sap-entity-inventory", () => ({
  fetchOverviewSapInventoryFromEntitySitemap: vi.fn(),
}));

vi.mock("@/lib/wordpress-api", () => ({
  getSiteInventoryBulk: vi.fn(),
}));

vi.mock("@/lib/overview/sap-peer-market-select", async () => {
  const actual = await vi.importActual<typeof import("@/lib/overview/sap-peer-market-select")>(
    "@/lib/overview/sap-peer-market-select",
  );
  return {
    ...actual,
    resolveMarketCityForPlaceEntity: vi.fn(),
  };
});

import { getEntitySiteWarmCacheIfReady } from "@/lib/local-analysis/entity-site-warm-cache";
import { fetchOverviewSapInventoryFromEntitySitemap } from "@/lib/overview/overview-sap-entity-inventory";
import { getSiteInventoryBulk } from "@/lib/wordpress-api";
import { resolveMarketCityForPlaceEntity } from "@/lib/overview/sap-peer-market-select";

function mockSite(partial: Partial<WordPressSite> & Pick<WordPressSite, "id" | "name" | "siteUrl">): WordPressSite {
  return {
    username: "u",
    appPassword: "p",
    entitySitemapUrl: `${partial.siteUrl}/service-area-sitemap.xml`,
    enabled: true,
    ...partial,
  } as WordPressSite;
}

describe("normalizePlaceKey / placeKeyFromSlug / placeKeyFromPageUrl", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizePlaceKey("  Stadium   Station Edmonton ")).toBe(
      "stadium station edmonton",
    );
  });

  it("maps slug hyphens to spaces", () => {
    expect(placeKeyFromSlug("stadium-station-edmonton")).toBe(
      "stadium station edmonton",
    );
  });

  it("maps page path segments to place key", () => {
    expect(
      placeKeyFromPageUrl("https://heritagedentaledmonton.ca/service-areas/edmonton-city-centre/"),
    ).toBe("service areas edmonton city centre");
  });
});

describe("sapPageMatchesPlaceEntity", () => {
  it("scores exact slug equality highest", () => {
    const m = sapPageMatchesPlaceEntity({
      placeEntity: "Stadium Station Edmonton",
      title: "Best blinds near Stadium Station Edmonton",
      slug: "stadium-station-edmonton",
      keyword: "blinds stadium station",
    });
    expect(m.match).toBe(true);
    expect(m.score).toBe(3);
  });

  it("scores title equality as exact", () => {
    const m = sapPageMatchesPlaceEntity({
      placeEntity: "Canora Edmonton",
      title: "Canora Edmonton",
      slug: "other-slug",
    });
    expect(m.match).toBe(true);
    expect(m.score).toBe(3);
  });

  it("matches when entity is contained in title", () => {
    const m = sapPageMatchesPlaceEntity({
      placeEntity: "Canora Edmonton",
      title: "Hunter Douglas Blinds Canora Edmonton",
      slug: "hunter-douglas-blinds-canora-edmonton",
    });
    expect(m.match).toBe(true);
    expect(m.score).toBeGreaterThanOrEqual(2);
  });

  it("fuzzy-matches Edmonton City Centre via pageUrl tokens (centre/center)", () => {
    const viaUrl = sapPageMatchesPlaceEntity({
      placeEntity: "Edmonton City Centre",
      title: "Service Area",
      slug: "service-area",
      pageUrl: "https://peer.example/edmonton-city-center/",
    });
    expect(viaUrl.match).toBe(true);
    expect(viaUrl.score).toBeGreaterThanOrEqual(1);

    const viaSlug = sapPageMatchesPlaceEntity({
      placeEntity: "Edmonton City Centre",
      title: "Local blinds",
      slug: "edmonton-city-centre",
      pageUrl: "https://peer.example/edmonton-city-centre/",
    });
    expect(viaSlug.match).toBe(true);
    expect(viaSlug.score).toBe(3);
  });

  it("rejects city-only pages that miss entity tokens", () => {
    const m = sapPageMatchesPlaceEntity({
      placeEntity: "Edmonton City Centre",
      title: "Downtown Edmonton",
      slug: "downtown-edmonton",
      pageUrl: "https://peer.example/downtown-edmonton/",
    });
    expect(m.match).toBe(false);
    expect(m.score).toBe(0);
  });

  it("rejects unrelated pages", () => {
    const m = sapPageMatchesPlaceEntity({
      placeEntity: "Stadium Station Edmonton",
      title: "Blinds Downtown St. Albert",
      slug: "blinds-downtown-st-albert",
      keyword: "blinds downtown",
    });
    expect(m.match).toBe(false);
    expect(m.score).toBe(0);
  });
});

describe("extractPreferredBodyImageFromHtml", () => {
  it("ignores non-http and empty src", () => {
    expect(
      extractPreferredBodyImageFromHtml(
        `<p><img src="" alt="x"/><img src="data:image/png;base64,aaa" alt="y"/></p>`,
      ),
    ).toBeNull();
  });

  it("prefers wp-image over earlier plain img", () => {
    const html = `
      <p><img src="https://cdn.example.com/plain.jpg" alt="plain"/></p>
      <figure class="wp-block-image">
        <img class="wp-image-99" src="https://cdn.example.com/local.jpg" alt="local place"/>
      </figure>
    `;
    const hit = extractPreferredBodyImageFromHtml(html);
    expect(hit?.url).toBe("https://cdn.example.com/local.jpg");
    expect(hit?.alt).toBe("local place");
  });

  it("falls back to first http img when no figure/wp-image", () => {
    const hit = extractPreferredBodyImageFromHtml(
      `<p><img src="https://cdn.example.com/a.jpg" alt="a"/><img src="https://cdn.example.com/b.jpg"/></p>`,
    );
    expect(hit?.url).toBe("https://cdn.example.com/a.jpg");
    expect(hit?.alt).toBe("a");
  });
});

describe("htmlHasLocalInContentImage", () => {
  it("is true for figure / wp-image body html", () => {
    expect(
      htmlHasLocalInContentImage(`
        <h2>Overview</h2>
        <figure class="wp-block-image">
          <img class="wp-image-12" src="https://cdn.example.com/local.jpg" alt="place"/>
        </figure>
      `),
    ).toBe(true);
  });

  it("is true for plain http body img", () => {
    expect(
      htmlHasLocalInContentImage(`<p><img src="https://cdn.example.com/a.jpg" alt="a"/></p>`),
    ).toBe(true);
  });

  it("is false when no usable body image", () => {
    expect(htmlHasLocalInContentImage(`<h2>Overview</h2><p>No image here.</p>`)).toBe(
      false,
    );
    expect(
      htmlHasLocalInContentImage(`<img src="data:image/png;base64,aaa" alt="x"/>`),
    ).toBe(false);
  });
});

describe("stripPreferredBodyImageFromHtml", () => {
  it("removes preferred figure and leaves surrounding content", () => {
    const html = `<h2>Overview</h2>
<figure class="wp-block-image"><img class="wp-image-12" src="https://cdn.example.com/local.jpg" alt="place"/></figure>
<p>After</p>`;
    const next = stripPreferredBodyImageFromHtml(html);
    expect(next).toContain("<h2>Overview</h2>");
    expect(next).toContain("<p>After</p>");
    expect(next).not.toContain("cdn.example.com/local.jpg");
    expect(next).not.toContain("<figure");
  });

  it("removes plain http body img when that is the preferred hit", () => {
    const html = `<p>Before</p><img src="https://cdn.example.com/a.jpg" alt="a"/><p>After</p>`;
    const next = stripPreferredBodyImageFromHtml(html);
    expect(next).toContain("<p>Before</p>");
    expect(next).toContain("<p>After</p>");
    expect(next).not.toContain("<img");
  });

  it("returns html unchanged when there is no usable body image", () => {
    const html = `<h2>Overview</h2><p>No image here.</p>`;
    expect(stripPreferredBodyImageFromHtml(html)).toBe(html);
  });
});

describe("parseSameMarketSiteIds", () => {
  it("keeps allowed ids only and drops current-site-style unknown ids", () => {
    const allowed = new Set(["heritage", "phoenix"]);
    expect(
      parseSameMarketSiteIds(
        { siteIds: ["phoenix", "bm", "heritage", "phoenix", ""] },
        allowed,
      ),
    ).toEqual(["phoenix", "heritage"]);
  });
});

describe("sequential same-market peer search", () => {
  beforeEach(() => {
    clearSapPeerEntityIndexCache();
    clearSapPeerMarketSelectCache();
    vi.mocked(getEntitySiteWarmCacheIfReady).mockReturnValue(null);
    vi.mocked(fetchOverviewSapInventoryFromEntitySitemap).mockReset();
    vi.mocked(getSiteInventoryBulk).mockReset();
    vi.mocked(resolveMarketCityForPlaceEntity).mockReset();
    vi.mocked(resolveMarketCityForPlaceEntity).mockResolvedValue("Edmonton");
  });

  afterEach(() => {
    clearSapPeerEntityIndexCache();
    clearSapPeerMarketSelectCache();
  });

  it("requires entity sitemap + creds (ignores Integrations enabled flag)", () => {
    expect(
      siteEnabledForSapSearch(
        mockSite({
          id: "1",
          name: "A",
          siteUrl: "https://a.example",
          entitySitemapUrl: "",
        }),
      ),
    ).toBe(false);
    expect(
      siteEnabledForSapSearch(
        mockSite({
          id: "heritage",
          name: "Heritage Dental Centre",
          siteUrl: "https://heritagedentaledmonton.ca",
          enabled: false,
        }),
      ),
    ).toBe(true);
  });

  it("never searches the excluded current site", async () => {
    const blindMagic = mockSite({
      id: "bm",
      name: "Blind Magic",
      siteUrl: "https://blindmagic.com/",
    });
    const heritage = mockSite({
      id: "heritage",
      name: "Heritage Dental",
      siteUrl: "https://heritagedentaledmonton.ca",
      enabled: false,
      napInfo: {
        locations: [
          {
            id: "1",
            name: "H",
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

    vi.mocked(resolveMarketCityForPlaceEntity).mockResolvedValue("Edmonton");
    vi.mocked(fetchOverviewSapInventoryFromEntitySitemap).mockImplementation(async (site) => {
      if (String(site.siteUrl).includes("blindmagic")) {
        throw new Error("must not fetch current site inventory");
      }
      return {
        rows: [
          {
            id: 11,
            url: "https://heritagedentaledmonton.ca/edmonton-city-centre/",
            slug: "edmonton-city-centre",
            collection: "service-area",
            fields: { title: "Edmonton City Centre" },
          },
        ],
        errors: {},
      } as never;
    });
    vi.mocked(getSiteInventoryBulk).mockResolvedValue({
      rows: [
        {
          id: 11,
          url: "https://heritagedentaledmonton.ca/edmonton-city-centre/",
          slug: "edmonton-city-centre",
          collection: "service-area",
          fields: {
            title: "Edmonton City Centre",
            content:
              '<figure><img class="wp-image-1" src="https://cdn.example.com/heritage.jpg" alt="x"/></figure>',
          },
        },
      ],
      errors: {},
    } as never);

    const result = await searchSapCrossSiteInContentImage({
      sites: [blindMagic, heritage],
      placeEntity: "Edmonton City Centre",
      apiKey: "test-key",
      excludeSite: blindMagic,
    });
    expect(result.hit?.sourceSiteName).toBe("Heritage Dental");
    expect(result.peerCsvFiles).toHaveLength(1);
    expect(result.peerCsvFiles[0]?.name).toBe("peer-local-images.csv");
    expect(result.peerCsvFiles[0]?.content).toContain("edmonton-city-centre");
    expect(vi.mocked(resolveMarketCityForPlaceEntity).mock.calls[0]![0].placeEntity).toBe(
      "Edmonton City Centre",
    );
  });

  it("peerInventoryFuzzyMatchesCity requires city token in inventory urls", () => {
    expect(
      peerInventoryFuzzyMatchesCity("Edmonton", [
        { pageUrl: "https://x.example/edmonton-city-centre/", slug: "edmonton-city-centre" },
      ]).matched,
    ).toBe(true);
    expect(
      peerInventoryFuzzyMatchesCity("Edmonton", [
        { pageUrl: "https://x.example/winnipeg-downtown/", slug: "winnipeg-downtown" },
      ]).matched,
    ).toBe(false);
  });

  it("builds CSV for peers whose sitemap urls contain the city; skips others", async () => {
    const miss = mockSite({
      id: "miss",
      name: "Miss Site",
      siteUrl: "https://miss.example",
      napInfo: {
        locations: [
          {
            id: "1",
            name: "M",
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
    const hitSite = mockSite({
      id: "phoenix",
      name: "Phoenix Finishing Touch Painting",
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
    const third = mockSite({
      id: "third",
      name: "Third Peer Dental",
      siteUrl: "https://third.example",
      napInfo: {
        locations: [
          {
            id: "1",
            name: "T",
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

    vi.mocked(resolveMarketCityForPlaceEntity).mockResolvedValue("Edmonton");

    vi.mocked(fetchOverviewSapInventoryFromEntitySitemap).mockImplementation(async (site) => {
      if (site.id === "miss") {
        return {
          rows: [
            {
              id: 1,
              url: "https://miss.example/edmonton-city-centre/",
              slug: "edmonton-city-centre",
              collection: "service-area",
              fields: { title: "Edmonton City Centre" },
            },
          ],
          errors: {},
        } as never;
      }
      if (site.id === "phoenix") {
        return {
          rows: [
            {
              id: 2,
              url: "https://phoenixpainting.ca/edmonton-city-centre/",
              slug: "edmonton-city-centre",
              collection: "service-area",
              fields: { title: "Edmonton City Centre" },
            },
          ],
          errors: {},
        } as never;
      }
      return {
        rows: [
          {
            id: 3,
            url: "https://third.example/other-place/",
            slug: "other-place",
            collection: "service-area",
            fields: { title: "Other Place" },
          },
        ],
        errors: {},
      } as never;
    });

    vi.mocked(getSiteInventoryBulk).mockImplementation(async (_url, _u, _p, opts) => {
      const id = Array.isArray(opts?.includeIds) ? Number(opts.includeIds[0]) : 0;
      if (id === 1) {
        return {
          rows: [
            {
              id: 1,
              url: "https://miss.example/edmonton-city-centre/",
              slug: "edmonton-city-centre",
              collection: "service-area",
              fields: { title: "Edmonton City Centre", content: "<p>No image</p>" },
            },
          ],
          errors: {},
        } as never;
      }
      return {
        rows: [
          {
            id: 2,
            url: "https://phoenixpainting.ca/edmonton-city-centre/",
            slug: "edmonton-city-centre",
            collection: "service-area",
            fields: {
              title: "Edmonton City Centre",
              content:
                '<figure><img class="wp-image-9" src="https://cdn.example.com/phoenix-local.jpg" alt="place"/></figure>',
            },
          },
        ],
        errors: {},
      } as never;
    });

    const progress: string[] = [];
    const planSnapshots: string[][] = [];
    const result = await searchSapCrossSiteInContentImage({
      sites: [miss, hitSite, third],
      placeEntity: "Edmonton City Centre",
      apiKey: "test-key",
      onPeerProgress: ({ peerIndex, siteName }) => {
        progress.push(`${peerIndex}:${siteName}`);
      },
      onPeerPlanReady: (peers) => {
        planSnapshots.push(peers.map((p) => p.name));
      },
    });

    expect(result.hit?.sourceSiteName).toBe("Phoenix Finishing Touch Painting");
    expect(result.hit?.imageUrl).toContain("phoenix-local.jpg");
    // third has no edmonton in sitemap urls → skipped
    expect(result.peerCsvFiles).toHaveLength(1);
    expect(result.peerCsvFiles[0]?.name).toBe("peer-local-images.csv");
    expect(result.peerCsvFiles[0]?.content).toContain("Miss Site");
    expect(result.peerCsvFiles[0]?.content).toContain("Phoenix Finishing Touch Painting");
    expect(result.peerCsvFiles[0]?.content).not.toContain("Third Peer Dental");
    // Full city-matched plan published once before image hydrate (not drip).
    expect(planSnapshots).toHaveLength(1);
    expect(planSnapshots[0]).toEqual([
      "Miss Site",
      "Phoenix Finishing Touch Painting",
    ]);
    expect(fetchOverviewSapInventoryFromEntitySitemap).toHaveBeenCalledTimes(3);
    expect(
      new Set(
        vi.mocked(fetchOverviewSapInventoryFromEntitySitemap).mock.calls.map((c) => c[0].id),
      ),
    ).toEqual(new Set(["miss", "phoenix", "third"]));
    // Plan + phase2 progress (order of completion may vary within a phase).
    expect(progress).toContain("0:Miss Site");
    expect(progress).toContain("1:Phoenix Finishing Touch Painting");
    expect(progress).toContain("2:Third Peer Dental");
    expect(progress.filter((p) => p === "0:Miss Site").length).toBeGreaterThanOrEqual(2);
  });

  it("publishes full city-matched plan before any peer image hydrate", async () => {
    const heritage = mockSite({
      id: "heritage",
      name: "Heritage Dental",
      siteUrl: "https://heritagedentaledmonton.ca",
    });
    const events: string[] = [];
    vi.mocked(resolveMarketCityForPlaceEntity).mockResolvedValue("Edmonton");
    vi.mocked(fetchOverviewSapInventoryFromEntitySitemap).mockResolvedValue({
      rows: [
        {
          id: 11,
          url: "https://heritagedentaledmonton.ca/edmonton-city-centre/",
          slug: "edmonton-city-centre",
          collection: "service-area",
          fields: { title: "Edmonton City Centre" },
        },
      ],
      errors: {},
    } as never);
    vi.mocked(getSiteInventoryBulk).mockImplementation(async () => {
      events.push("hydrate");
      return {
        rows: [
          {
            id: 11,
            url: "https://heritagedentaledmonton.ca/edmonton-city-centre/",
            slug: "edmonton-city-centre",
            collection: "service-area",
            fields: {
              title: "Edmonton City Centre",
              content:
                '<figure><img class="wp-image-1" src="https://cdn.example.com/h.jpg" alt="x"/></figure>',
            },
          },
        ],
        errors: {},
      } as never;
    });

    await searchSapCrossSiteInContentImage({
      sites: [heritage],
      placeEntity: "Edmonton City Centre",
      apiKey: "test-key",
      onPeerPlanReady: () => {
        events.push("plan");
      },
      onPeerCsvReady: () => {
        events.push("csv");
      },
    });

    expect(events[0]).toBe("plan");
    expect(events.indexOf("plan")).toBeLessThan(events.indexOf("hydrate"));
  });

  it("city-matched peer with only city pages (no entity page) yields no hit", async () => {
    const heritage = mockSite({
      id: "heritage",
      name: "Heritage Dental",
      siteUrl: "https://heritagedentaledmonton.ca",
    });
    vi.mocked(resolveMarketCityForPlaceEntity).mockResolvedValue("Edmonton");
    vi.mocked(fetchOverviewSapInventoryFromEntitySitemap).mockResolvedValue({
      rows: [
        {
          id: 1,
          url: "https://heritagedentaledmonton.ca/downtown-edmonton/",
          slug: "downtown-edmonton",
          collection: "service-area",
          fields: { title: "Downtown Edmonton" },
        },
        {
          id: 2,
          url: "https://heritagedentaledmonton.ca/west-edmonton/",
          slug: "west-edmonton",
          collection: "service-area",
          fields: { title: "West Edmonton" },
        },
      ],
      errors: {},
    } as never);

    const result = await searchSapCrossSiteInContentImage({
      sites: [heritage],
      placeEntity: "Edmonton City Centre",
      apiKey: "test-key",
    });

    expect(result.peerCsvFiles).toHaveLength(1);
    expect(result.hit).toBeNull();
    expect(getSiteInventoryBulk).not.toHaveBeenCalled();
  });

  it("hydrates past empty entity pages until a body image is found", async () => {
    const heritage = mockSite({
      id: "heritage",
      name: "Heritage Dental",
      siteUrl: "https://heritagedentaledmonton.ca",
    });
    vi.mocked(resolveMarketCityForPlaceEntity).mockResolvedValue("Edmonton");
    vi.mocked(fetchOverviewSapInventoryFromEntitySitemap).mockResolvedValue({
      rows: [
        {
          id: 1,
          url: "https://heritagedentaledmonton.ca/edmonton-city-centre/",
          slug: "edmonton-city-centre",
          collection: "service-area",
          fields: { title: "Edmonton City Centre" },
        },
        {
          id: 2,
          url: "https://heritagedentaledmonton.ca/edmonton-city-centre-guide/",
          slug: "edmonton-city-centre-guide",
          collection: "service-area",
          fields: { title: "Edmonton City Centre Guide" },
        },
        {
          id: 3,
          url: "https://heritagedentaledmonton.ca/about-edmonton-city-centre/",
          slug: "about-edmonton-city-centre",
          collection: "service-area",
          fields: { title: "About Edmonton City Centre" },
        },
        {
          id: 4,
          url: "https://heritagedentaledmonton.ca/visit-edmonton-city-centre/",
          slug: "visit-edmonton-city-centre",
          collection: "service-area",
          fields: { title: "Visit Edmonton City Centre" },
        },
      ],
      errors: {},
    } as never);

    const hydrateOrder: number[] = [];
    vi.mocked(getSiteInventoryBulk).mockImplementation(async (_url, _u, _p, opts) => {
      const id = Array.isArray(opts?.includeIds) ? Number(opts.includeIds[0]) : 0;
      hydrateOrder.push(id);
      if (id === 4) {
        return {
          rows: [
            {
              id: 4,
              url: "https://heritagedentaledmonton.ca/visit-edmonton-city-centre/",
              slug: "visit-edmonton-city-centre",
              collection: "service-area",
              fields: {
                title: "Visit Edmonton City Centre",
                content:
                  '<figure><img class="wp-image-4" src="https://cdn.example.com/city-centre.jpg" alt="centre"/></figure>',
              },
            },
          ],
          errors: {},
        } as never;
      }
      return {
        rows: [
          {
            id,
            url: `https://heritagedentaledmonton.ca/page-${id}/`,
            slug: `page-${id}`,
            collection: "service-area",
            fields: { title: "Edmonton City Centre", content: "<p>No image</p>" },
          },
        ],
        errors: {},
      } as never;
    });

    const result = await searchSapCrossSiteInContentImage({
      sites: [heritage],
      placeEntity: "Edmonton City Centre",
      apiKey: "test-key",
    });

    expect(result.hit?.imageUrl).toContain("city-centre.jpg");
    expect(result.hit?.sourcePageUrl).toContain("visit-edmonton-city-centre");
    // Exact match (id 1) first, then other entity matches until image (id 4).
    expect(hydrateOrder).toEqual([1, 2, 3, 4]);
    expect(getSiteInventoryBulk).toHaveBeenCalledTimes(4);
  });

  it("reuses peer inventory across keywords (one sitemap fetch per peer)", async () => {
    const heritage = mockSite({
      id: "heritage",
      name: "Heritage Dental",
      siteUrl: "https://heritagedentaledmonton.ca",
    });
    vi.mocked(resolveMarketCityForPlaceEntity).mockResolvedValue("Edmonton");
    vi.mocked(fetchOverviewSapInventoryFromEntitySitemap).mockResolvedValue({
      rows: [
        {
          id: 11,
          url: "https://heritagedentaledmonton.ca/edmonton-city-centre/",
          slug: "edmonton-city-centre",
          collection: "service-area",
          fields: { title: "Edmonton City Centre" },
        },
        {
          id: 12,
          url: "https://heritagedentaledmonton.ca/downtown-edmonton/",
          slug: "downtown-edmonton",
          collection: "service-area",
          fields: { title: "Downtown Edmonton" },
        },
      ],
      errors: {},
    } as never);
    vi.mocked(getSiteInventoryBulk).mockResolvedValue({
      rows: [
        {
          id: 11,
          url: "https://heritagedentaledmonton.ca/edmonton-city-centre/",
          slug: "edmonton-city-centre",
          collection: "service-area",
          fields: {
            title: "Edmonton City Centre",
            content:
              '<figure><img class="wp-image-1" src="https://cdn.example.com/centre.jpg" alt="x"/></figure>',
          },
        },
      ],
      errors: {},
    } as never);

    await searchSapCrossSiteInContentImage({
      sites: [heritage],
      placeEntity: "Edmonton City Centre",
      apiKey: "test-key",
    });
    await searchSapCrossSiteInContentImage({
      sites: [heritage],
      placeEntity: "Downtown Edmonton",
      apiKey: "test-key",
    });

    expect(fetchOverviewSapInventoryFromEntitySitemap).toHaveBeenCalledTimes(1);
  });

  it("prewarm then search does not refetch peer inventory", async () => {
    const heritage = mockSite({
      id: "heritage",
      name: "Heritage Dental",
      siteUrl: "https://heritagedentaledmonton.ca",
    });
    vi.mocked(resolveMarketCityForPlaceEntity).mockResolvedValue("Edmonton");
    vi.mocked(fetchOverviewSapInventoryFromEntitySitemap).mockResolvedValue({
      rows: [
        {
          id: 11,
          url: "https://heritagedentaledmonton.ca/edmonton-city-centre/",
          slug: "edmonton-city-centre",
          collection: "service-area",
          fields: { title: "Edmonton City Centre" },
        },
      ],
      errors: {},
    } as never);
    vi.mocked(getSiteInventoryBulk).mockResolvedValue({
      rows: [
        {
          id: 11,
          url: "https://heritagedentaledmonton.ca/edmonton-city-centre/",
          slug: "edmonton-city-centre",
          collection: "service-area",
          fields: {
            title: "Edmonton City Centre",
            content:
              '<figure><img class="wp-image-1" src="https://cdn.example.com/h.jpg" alt="x"/></figure>',
          },
        },
      ],
      errors: {},
    } as never);

    await prewarmSapPeerSiteInventories([heritage]);
    expect(fetchOverviewSapInventoryFromEntitySitemap).toHaveBeenCalledTimes(1);

    await searchSapCrossSiteInContentImage({
      sites: [heritage],
      placeEntity: "Edmonton City Centre",
      apiKey: "test-key",
    });
    expect(fetchOverviewSapInventoryFromEntitySitemap).toHaveBeenCalledTimes(1);
  });
});
