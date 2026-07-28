import { describe, it, expect } from "vitest";
import {
  buildLocalGridSummary,
  computeGridGeographicFootprint,
  defaultSeedEntityHintFromGrid,
  dominantCityFromPlaceHints,
  entityMatchesCsvPlaceHints,
  extractStreetCorridorHintsFromRows,
  extractTopPlaceHintsFromRows,
  inferGridMarketContext,
  mergeStreetAndCityPlaceHints,
  haversineDistanceMiles,
  roughCountryLabelFromCentroid,
  wikipediaSearchAugmentFromGridRows,
} from "../local-dominator-csv";
import type { LocalDominatorRow } from "../local-dominator-csv";

function baseRow(overrides: Partial<LocalDominatorRow> & Pick<LocalDominatorRow, "latitude" | "longitude" | "rank">): LocalDominatorRow {
  return {
    scanDate: "Apr 8, 2026",
    keyword: "blinds near me",
    business: "Test",
    address: overrides.address ?? "",
    placeId: "",
    websiteUrl: "",
    scanSize: "13x13",
    distance: 1,
    distanceMeasure: "mile",
    primaryCategory: "",
    secondaryCategories: "",
    ...overrides,
  };
}

describe("dominantCityFromPlaceHints", () => {
  it("returns city before ST from first matching hint", () => {
    expect(dominantCityFromPlaceHints(["123 Main St, Marietta, GA"])).toBe("Marietta");
    expect(dominantCityFromPlaceHints(["Marietta, GA"])).toBe("Marietta");
  });

  it("returns empty when no City, ST pattern", () => {
    expect(dominantCityFromPlaceHints(["no state here"])).toBe("");
  });
});

describe("defaultSeedEntityHintFromGrid", () => {
  it("returns empty when no hints and no fallbacks", () => {
    expect(defaultSeedEntityHintFromGrid([], [])).toBe("");
    expect(defaultSeedEntityHintFromGrid([], undefined)).toBe("");
  });

  it("returns first non-empty place hint", () => {
    expect(defaultSeedEntityHintFromGrid(["  Woodstock, GA  ", "Marietta, GA"], [])).toBe("Woodstock, GA");
  });

  it("skips empty strings and uses first hint", () => {
    expect(defaultSeedEntityHintFromGrid(["", "  ", "Canton, GA"], [])).toBe("Canton, GA");
  });

  it("uses fallback when place hints are empty", () => {
    expect(defaultSeedEntityHintFromGrid([], ["", "Marietta, GA"])).toBe("Marietta, GA");
  });

  it("uses first fallback in order", () => {
    expect(defaultSeedEntityHintFromGrid([], ["A", "B"])).toBe("A");
  });
});

describe("haversineDistanceMiles", () => {
  it("returns ~0 for identical points", () => {
    expect(haversineDistanceMiles(33.7, -111.92, 33.7, -111.92)).toBeLessThan(0.001);
  });

  it("returns hundreds of miles for Scottsdale vs northern Arizona", () => {
    const d = haversineDistanceMiles(33.699, -111.924, 35.58, -111.48);
    expect(d).toBeGreaterThan(120);
    expect(d).toBeLessThan(160);
  });
});

describe("computeGridGeographicFootprint", () => {
  it("computes centroid and max radius from grid pins", () => {
    const rows: LocalDominatorRow[] = [
      baseRow({ latitude: 33.7, longitude: -111.92, rank: 1 }),
      baseRow({ latitude: 33.71, longitude: -111.92, rank: 2 }),
      baseRow({ latitude: 33.7, longitude: -111.91, rank: 3 }),
    ];
    const fp = computeGridGeographicFootprint(rows);
    expect(fp.pointCount).toBe(3);
    expect(fp.centroidLat).toBeCloseTo((33.7 + 33.71 + 33.7) / 3, 5);
    expect(fp.maxRadiusMilesFromCentroid).toBeGreaterThan(0);
    expect(fp.bufferedRadiusMiles).toBeCloseTo(fp.maxRadiusMilesFromCentroid * 1.125, 5);
    expect(fp.minLat).toBe(33.7);
    expect(fp.maxLat).toBe(33.71);
  });

  it("returns pointCount 0 when no usable coordinates", () => {
    const fp = computeGridGeographicFootprint([baseRow({ latitude: 0, longitude: 0, rank: 1 })]);
    expect(fp.pointCount).toBe(0);
  });
});

describe("inferGridMarketContext / wikipediaSearchAugmentFromGridRows", () => {
  it("infers United States + state from repeated FL addresses and Stuart-like centroid", () => {
    const rows: LocalDominatorRow[] = [
      baseRow({
        latitude: 27.17,
        longitude: -80.23,
        rank: 1,
        address: "Blinds Co · 123 SE Federal Hwy, Stuart, FL · (772) 555-0100",
      }),
      baseRow({
        latitude: 27.18,
        longitude: -80.24,
        rank: 2,
        address: "Other · Palm City, FL",
      }),
    ];
    const fp = computeGridGeographicFootprint(rows);
    const inf = inferGridMarketContext(rows, fp);
    expect(inf.primaryCountryLabel).toBe("United States");
    expect(inf.dominantUsStateCodes[0]).toBe("FL");
    expect(inf.wikipediaSearchAugment).toContain("United States");
    expect(inf.wikipediaSearchAugment).toContain("Florida");
    expect(wikipediaSearchAugmentFromGridRows(rows)).toBe(inf.wikipediaSearchAugment);
  });

  it("roughCountryLabelFromCentroid matches Florida panhandle area", () => {
    expect(roughCountryLabelFromCentroid(27.17, -80.23)).toBe("United States");
  });
});

describe("buildLocalGridSummary geographic scope", () => {
  it("includes Geographic scope section with mi and bounding box", () => {
    const rows: LocalDominatorRow[] = [
      baseRow({
        latitude: 33.699,
        longitude: -111.924,
        rank: 5,
        address: "Somewhere · Phoenix, AZ · (480) 555-0100",
      }),
      baseRow({
        latitude: 33.705,
        longitude: -111.92,
        rank: 8,
        address: "Other · Scottsdale, AZ",
      }),
    ];
    const summary = buildLocalGridSummary(rows);
    expect(summary.summaryMarkdown).toContain("## Geographic scope (from this file)");
    expect(summary.summaryMarkdown).toMatch(/Furthest scan pin from centroid: \*\*[\d.]+ mi\*\*/);
    expect(summary.summaryMarkdown).toContain("Bounding box");
    expect(summary.summaryMarkdown).toContain("Nearby place names seen in this export");
    expect(summary.summaryMarkdown).toContain("Inferred market anchor");
    expect(summary.placeHints.length).toBeGreaterThan(0);
    expect(summary.placeHints.some((h) => h.includes("Phoenix"))).toBe(true);
  });
});

describe("extractTopPlaceHintsFromRows", () => {
  it("collects City, ST from address cells", () => {
    const rows = [
      baseRow({ latitude: 33.7, longitude: -111.9, rank: 1, address: "A · Phoenix, AZ · x" }),
      baseRow({ latitude: 33.7, longitude: -111.9, rank: 2, address: "B · Phoenix, AZ" }),
      baseRow({ latitude: 33.7, longitude: -111.9, rank: 3, address: "C · Mesa, AZ" }),
    ];
    const hints = extractTopPlaceHintsFromRows(rows, 10);
    expect(hints).toContain("Phoenix, AZ");
    expect(hints).toContain("Mesa, AZ");
  });
});

describe("extractStreetCorridorHintsFromRows", () => {
  it("collects street + City, ST when a street segment precedes the city", () => {
    const rows = [
      baseRow({
        latitude: 33.7,
        longitude: -84.5,
        rank: 1,
        address: "123 Main St, Smyrna, GA 30080",
      }),
      baseRow({
        latitude: 33.7,
        longitude: -84.5,
        rank: 2,
        address: "456 Oak Ave, Smyrna, GA",
      }),
    ];
    const hints = extractStreetCorridorHintsFromRows(rows);
    expect(hints.some((h) => h.includes("Main St") && h.includes("Smyrna"))).toBe(true);
  });
});

describe("mergeStreetAndCityPlaceHints", () => {
  it("lists street hints before distinct City, ST labels", () => {
    const m = mergeStreetAndCityPlaceHints(["123 Main St, Smyrna, GA"], ["Smyrna, GA", "Marietta, GA"]);
    expect(m[0]).toContain("Main St");
    expect(m).toContain("Smyrna, GA");
  });
});

describe("entityMatchesCsvPlaceHints", () => {
  it("matches entity substring to hint city", () => {
    const hints = ["Phoenix, AZ", "Scottsdale, AZ"];
    expect(entityMatchesCsvPlaceHints("Blinds in North Phoenix", hints)).toBe(true);
    expect(entityMatchesCsvPlaceHints("Old Town Scottsdale", hints)).toBe(true);
    expect(entityMatchesCsvPlaceHints("Painted Desert", hints)).toBe(false);
  });
});
