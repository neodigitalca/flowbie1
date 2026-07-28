import { describe, expect, it } from "vitest";
import {
  canadianPostalFsaFromAddress,
  isInternalGridPlaceBucketLabel,
  placeWeaknessWeightsFromRows,
  type LocalDominatorRow,
} from "@/lib/local-dominator-csv";

function row(addr: string, rank: number, keyword = "blinds near me"): LocalDominatorRow {
  return {
    scanDate: "",
    latitude: 0,
    longitude: 0,
    keyword,
    business: "",
    address: addr,
    placeId: "",
    websiteUrl: "",
    scanSize: "",
    distance: 0,
    distanceMeasure: "",
    rank,
    primaryCategory: "",
    secondaryCategories: "",
  };
}

describe("placeWeaknessWeightsFromRows", () => {
  it("orders cities by weakness (worse average rank first)", () => {
    const rows: LocalDominatorRow[] = [
      row("123 Main St, Minneapolis, MN 55401", 5),
      row("456 Oak Ave, Minneapolis, MN 55402", 6),
      row("100 River Rd, Saint Paul, MN 55101", 18),
      row("200 River Rd, Saint Paul, MN 55102", 19),
    ];
    const out = placeWeaknessWeightsFromRows(rows);
    expect(out.length).toBe(2);
    expect(out[0]!.place).toContain("Saint Paul");
    expect(out[1]!.place).toContain("Minneapolis");
    expect(out[0]!.weight).toBeGreaterThan(out[1]!.weight);
  });

  it("includes Canadian FSA buckets with weaker areas ranked higher than stronger FSAs", () => {
    const rows: LocalDominatorRow[] = [
      row("100 Elm St, Xtown, AB A1B 2C3", 20),
      row("101 Elm St, Xtown, AB A1B 3D4", 18),
      row("200 Oak Ave, Xtown, AB B2C 4E5", 6),
      row("201 Oak Ave, Xtown, AB B2C 5F6", 8),
    ];
    const out = placeWeaknessWeightsFromRows(rows);
    const byPlace = Object.fromEntries(out.map((x) => [x.place, x.weight]));
    const fsaA = byPlace[`FSA ${canadianPostalFsaFromAddress("100 Elm St, Xtown, AB A1B 2C3")}`];
    const fsaB = byPlace[`FSA ${canadianPostalFsaFromAddress("200 Oak Ave, Xtown, AB B2C 4E5")}`];
    expect(fsaA).toBeDefined();
    expect(fsaB).toBeDefined();
    expect(fsaA!).toBeGreaterThan(fsaB!);
    expect(Object.keys(byPlace)).toContain(`FSA ${canadianPostalFsaFromAddress("100 Elm St, Xtown, AB A1B 2C3")}`);
  });

  it("extracts Canadian FSA format from address when present", () => {
    expect(canadianPostalFsaFromAddress("Unit 9, Serviceway, Middletown, SK A9Z 9K9 Canada")).toBe("A9Z");
  });
});

describe("isInternalGridPlaceBucketLabel", () => {
  it("flags FSA and pin bucket labels", () => {
    expect(isInternalGridPlaceBucketLabel("FSA T6C")).toBe(true);
    expect(isInternalGridPlaceBucketLabel("pin_53.54_-113.49")).toBe(true);
    expect(isInternalGridPlaceBucketLabel("Strathcona, Edmonton")).toBe(false);
    expect(isInternalGridPlaceBucketLabel("St. Albert, AB")).toBe(false);
  });
});
