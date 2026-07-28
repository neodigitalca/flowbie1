import { describe, expect, it } from "vitest";
import type { LocalDominatorRow } from "@/lib/local-dominator-csv";
import {
  buildCityLocationBucketsFromRows,
  buildGridLocationBucketsFromRows,
} from "@/lib/local-analysis/grid-location-buckets";

function gridRow(address: string, rank = 10): LocalDominatorRow {
  return {
    latitude: 53.5,
    longitude: -113.5,
    rank,
    address,
    keyword: "test",
  };
}

describe("buildCityLocationBucketsFromRows", () => {
  it("groups by City, ST instead of street corridors", () => {
    const rows = [
      gridRow("100 63 Ave NW, Edmonton, AB", 8),
      gridRow("200 63 Ave NW, Edmonton, AB", 12),
      gridRow("10 Whyte Ave NW, Edmonton, AB", 15),
    ];
    const buckets = buildCityLocationBucketsFromRows(rows);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.placeLabel).toBe("Edmonton, AB");
    expect(buckets[0]!.rowCount).toBe(3);
    expect(buckets[0]!.sampleAddresses.some((a) => a.includes("63 Ave"))).toBe(true);
  });
});

describe("buildGridLocationBucketsFromRows", () => {
  it("still splits street corridors when neighbourhood focus is off", () => {
    const rows = [
      gridRow("100 63 Ave NW, Edmonton, AB", 8),
      gridRow("10 Whyte Ave NW, Edmonton, AB", 15),
    ];
    const buckets = buildGridLocationBucketsFromRows(rows);
    expect(buckets.length).toBeGreaterThanOrEqual(2);
    expect(buckets.some((b) => b.placeLabel.includes("63 Ave"))).toBe(true);
    expect(buckets.some((b) => b.placeLabel.includes("Whyte Ave"))).toBe(true);
  });
});
