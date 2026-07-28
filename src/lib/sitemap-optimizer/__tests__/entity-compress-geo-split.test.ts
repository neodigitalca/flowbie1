import { describe, expect, it } from "vitest";
import { packPostIdsIntoCompressFamilies } from "@/lib/sitemap-optimizer/entity-compress-coverage";
import {
  entityCompressPlaceKey,
  splitMixedGeoCompressFamilies,
} from "@/lib/sitemap-optimizer/entity-compress-geo-split";
import { fillFamilyStrategyFromPillar } from "@/lib/sitemap-optimizer/entity-transform-families-agent";
import type { EntityRedirectPlan } from "@/lib/sitemap-optimizer/entity-redirect-plan-parse";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function row(postId: string, url: string, opts: Partial<SitemapOptimizerPostRow> = {}): SitemapOptimizerPostRow {
  return {
    postId,
    url,
    collection: "entity",
    title: postId,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscPageClicks: 0,
    gscPageImpressions: 0,
    gscQueries: [],
    gscFetched: true,
    ...opts,
  };
}

describe("entity compress geo safety", () => {
  it("uses distinct place keys for Boca vs Bradenton", () => {
    expect(
      entityCompressPlaceKey("https://example.com/service-area/blinds-boca-raton/"),
    ).not.toBe(
      entityCompressPlaceKey("https://example.com/service-area/blinds-bradenton/"),
    );
  });

  it("keeps numbered clone with its place key", () => {
    expect(
      entityCompressPlaceKey(
        "https://example.com/service-area/window-shades-altamonte-springs-2/",
      ),
    ).toBe(
      entityCompressPlaceKey(
        "https://example.com/service-area/window-shades-altamonte-springs/",
      ),
    );
  });

  it("splits a mixed-geo family into one family per place", () => {
    const rows = [
      row("boca", "https://example.com/service-area/blinds-boca-raton/", { gscPageClicks: 2 }),
      row("brad", "https://example.com/service-area/blinds-bradenton/", { gscPageClicks: 5 }),
    ];
    const rowById = new Map(rows.map((r) => [r.postId, r]));
    const plan: EntityRedirectPlan = {
      families: [
        {
          familyId: "hub",
          destinationPostId: "brad",
          sourcePostIds: ["boca", "brad"],
          rationale: "Bad long-haul hub",
        },
      ],
    };
    const split = splitMixedGeoCompressFamilies(plan, rowById);
    expect(split.families.length).toBe(2);
    const places = split.families.map((f) => f.sourcePostIds.sort().join(",")).sort();
    expect(places).toEqual(["boca", "brad"]);
  });

  it("packs missing Boca and Bradenton into separate families", () => {
    const rows = [
      row("boca", "https://example.com/service-area/blinds-boca-raton/"),
      row("brad", "https://example.com/service-area/blinds-bradenton/"),
    ];
    const rowById = new Map(rows.map((r) => [r.postId, r]));
    const packed = packPostIdsIntoCompressFamilies(["boca", "brad"], rowById, "fill");
    expect(packed).toHaveLength(2);
    expect(packed.every((f) => f.sourcePostIds.length === 1)).toBe(true);
  });

  it("fills Transform strategy with Also covers place mentions", () => {
    const rows = [
      row("a", "https://example.com/service-area/blinds-bushnell/", {
        title: "Blinds Bushnell",
        keyword: "blinds",
      }),
      row("b", "https://example.com/service-area/blinds-bushnell-fl/", {
        title: "Blinds Bushnell FL",
      }),
    ];
    const rowById = new Map(rows.map((r) => [r.postId, r]));
    const filled = fillFamilyStrategyFromPillar(
      {
        familyId: "f1",
        destinationPostId: "a",
        sourcePostIds: ["a", "b"],
        rationale: "",
      },
      rowById,
    );
    expect(filled.sapModifier).toMatch(/Also covers:/i);
    expect(filled.combinedOutline?.some((line) => /Also covers:/i.test(line))).toBe(true);
    expect(filled.whatToKeepFromEach?.length).toBe(2);
  });
});
