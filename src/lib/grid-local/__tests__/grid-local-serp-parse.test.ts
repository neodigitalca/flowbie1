import { describe, expect, it } from "vitest";
import {
  findBusinessRankInMapsSerp,
  normalizeGridLocalTargetIds,
  parseMapsSerpItems,
} from "../grid-local";
import type { WordPressSite } from "@/components/integrations/types";

const site = {
  id: "s1",
  name: "Advance Blinds: Blinds, Shades & Drapery In Manitoba",
  siteUrl: "https://example.com",
  username: "",
  appPassword: "",
  connectedAt: 0,
} as WordPressSite;

describe("parseMapsSerpItems", () => {
  it("reads maps_search rows from DataForSEO shape", () => {
    const json = {
      tasks: [
        {
          result: [
            {
              items: [
                {
                  type: "maps_search",
                  rank_group: 1,
                  title: "Advance Blinds & Drapery",
                  place_id: "ChIJtest",
                  cid: 123,
                },
                { type: "maps_search", rank_group: 2, title: "Other Blinds Co" },
              ],
            },
          ],
        },
      ],
    };
    expect(parseMapsSerpItems(json)).toEqual([
      { rank: 1, title: "Advance Blinds & Drapery", placeId: "ChIJtest", cid: "123" },
      { rank: 2, title: "Other Blinds Co", placeId: null, cid: null },
    ]);
  });

  it("includes local_pack listing types with title and rank", () => {
    const json = {
      tasks: [
        {
          result: [
            {
              items: [
                {
                  type: "local_pack",
                  rank_group: 1,
                  title: "Linh's Window Fashions",
                  cid: "10028458900841593451",
                },
                {
                  type: "local_pack",
                  rank_group: 17,
                  title: "Blind Magic Window Coverings",
                  cid: "16764889337278783722",
                },
              ],
            },
          ],
        },
      ],
    };
    expect(parseMapsSerpItems(json)).toEqual([
      {
        rank: 1,
        title: "Linh's Window Fashions",
        placeId: null,
        cid: "10028458900841593451",
      },
      {
        rank: 17,
        title: "Blind Magic Window Coverings",
        placeId: null,
        cid: "16764889337278783722",
      },
    ]);
  });
});

describe("normalizeGridLocalTargetIds", () => {
  it("treats numeric place_id as cid (Local Dominator style)", () => {
    expect(normalizeGridLocalTargetIds({ placeId: "16764889337278783722", cid: null })).toEqual({
      placeId: null,
      cid: "16764889337278783722",
    });
  });
});

describe("findBusinessRankInMapsSerp", () => {
  it("matches GBP file name when site title is long SEO string", () => {
    const json = {
      tasks: [
        {
          result: [
            {
              items: [
                { type: "maps_search", rank_group: 3, title: "Advance Blinds & Drapery" },
              ],
            },
          ],
        },
      ],
    };
    const { rank, serp } = findBusinessRankInMapsSerp(
      json,
      site,
      "Advance Blinds: Blinds, Shades & Drapery In Manitoba",
      {},
      "Advance Blinds & Drapery",
    );
    expect(rank).toBe(3);
    expect(serp).toHaveLength(1);
  });

  it("matches by cid before name", () => {
    const json = {
      tasks: [
        {
          result: [
            {
              items: [
                { type: "maps_search", rank_group: 1, title: "Other Shop", cid: 999 },
                {
                  type: "maps_search",
                  rank_group: 17,
                  title: "Blind Magic Window Coverings",
                  cid: "16764889337278783722",
                },
              ],
            },
          ],
        },
      ],
    };
    const { rank } = findBusinessRankInMapsSerp(json, site, "Blind Magic Window Coverings", {
      placeId: "16764889337278783722",
      cid: null,
    });
    expect(rank).toBe(17);
  });

  it("LD parity: edge-pin blinds pack ranks Blind Magic by cid at rank 17", () => {
    const json = {
      tasks: [
        {
          result: [
            {
              items: [
                { type: "local_pack", rank_group: 1, title: "Linh's Window Fashions", cid: "10028458900841593451" },
                { type: "local_pack", rank_group: 2, title: "The Blind Side Mfg", cid: "9051169068710149620" },
                {
                  type: "local_pack",
                  rank_group: 17,
                  title: "Blind Magic Window Coverings",
                  cid: "16764889337278783722",
                },
              ],
            },
          ],
        },
      ],
    };
    const { rank, serp } = findBusinessRankInMapsSerp(json, site, "Blind Magic", {
      cid: "16764889337278783722",
    });
    expect(rank).toBe(17);
    expect(serp.some((r) => r.cid === "16764889337278783722")).toBe(true);
  });

  it("does not name-match satellite listings when target cid is set", () => {
    const json = {
      tasks: [
        {
          result: [
            {
              items: [
                {
                  type: "local_pack",
                  rank_group: 5,
                  title: "Blind Magic Window Coverings - St. Albert",
                  cid: "8579220141293902913",
                },
              ],
            },
          ],
        },
      ],
    };
    const { rank } = findBusinessRankInMapsSerp(json, site, "Blind Magic Window Coverings", {
      cid: "16764889337278783722",
    });
    expect(rank).toBeNull();
  });
});

describe("gridLocalResultsToCsv", () => {
  it("includes target_place_id, target_cid, place_id, cid columns", async () => {
    const { gridLocalResultsToCsv } = await import("../grid-local");
    const scan = {
      v: 1 as const,
      siteId: "s1",
      businessName: "Blind Magic",
      keyword: "blinds near me",
      center: { lat: 53.55, lng: -113.61 },
      radiusKm: 5,
      scannedAt: "2026-07-07T00:00:00.000Z",
      stats: { avgRank: 17, tarp: 17, distribution: { high: 0, med: 0, low: 100, out: 0 } },
      targetPlaceId: null,
      targetCid: "16764889337278783722",
      pins: [
        {
          lat: 53.5163563,
          lng: -113.6460956,
          rank: 17,
          locationCoordinate: "53.5163563,-113.6460956,17z",
          serp: [
            {
              rank: 17,
              title: "Blind Magic Window Coverings",
              placeId: null,
              cid: "16764889337278783722",
            },
          ],
        },
      ],
    };
    const csv = gridLocalResultsToCsv(scan);
    expect(csv.split("\n")[0]).toContain("target_place_id");
    expect(csv).toContain("16764889337278783722");
    expect(csv).toContain("17z");
    expect(csv).toContain(",yes,");
  });
});
