import { describe, expect, it } from "vitest";
import {
  allocatePagesAcrossNeighbourhoodPicks,
  isDirectionalCompassPlaceLabel,
} from "@/lib/local-analysis/entity-grid-location-wiki-agent";

describe("isDirectionalCompassPlaceLabel", () => {
  it("flags synthetic quadrant labels", () => {
    expect(isDirectionalCompassPlaceLabel("South West Altona, MB")).toBe(true);
    expect(isDirectionalCompassPlaceLabel("North East Altona, MB")).toBe(true);
  });

  it("allows real neighbourhood names", () => {
    expect(isDirectionalCompassPlaceLabel("Millwood, Altona, MB")).toBe(false);
    expect(isDirectionalCompassPlaceLabel("Southland Mall, Winkler, MB")).toBe(false);
  });
});

describe("allocatePagesAcrossNeighbourhoodPicks", () => {
  it("collapses 3 picks into one entity when ad budget is 3", () => {
    const alloc = allocatePagesAcrossNeighbourhoodPicks(
      [
        { name: "Plum Coulee, Altona, MB", posWeight: 1 },
        { name: "Parkview, Altona, MB", posWeight: 1 },
        { name: "Millwood, Altona, MB", posWeight: 1 },
      ],
      3,
    );
    expect(alloc).toHaveLength(1);
    expect(alloc[0]?.pages).toBe(3);
    expect(alloc[0]?.entity).toBe("Plum Coulee, Altona, MB");
  });

  it("keeps multiple neighbourhoods when budget exceeds min per cluster", () => {
    const alloc = allocatePagesAcrossNeighbourhoodPicks(
      [
        { name: "Mill Woods, Edmonton, AB", posWeight: 30 },
        { name: "Oliver, Edmonton, AB", posWeight: 10 },
        { name: "Westmount, Edmonton, AB", posWeight: 5 },
      ],
      7,
    );
    expect(alloc.length).toBeGreaterThan(1);
    expect(alloc.reduce((s, a) => s + a.pages, 0)).toBe(7);
  });
});

describe("explicit layout ad slots", () => {
  it("expects one entity per slot (3 slots = 3 distinct entities, not allocatePages merge)", () => {
    const picks = [
      { name: "Plum Coulee, Altona, MB", posWeight: 1 },
      { name: "Parkview, Altona, MB", posWeight: 1 },
      { name: "Millwood, Altona, MB", posWeight: 1 },
    ];
    const merged = allocatePagesAcrossNeighbourhoodPicks(picks, 3);
    expect(merged).toHaveLength(1);
    const perSlot = picks.slice(0, 3).map((p) => p.name);
    expect(new Set(perSlot).size).toBe(3);
    expect(perSlot).not.toEqual([merged[0]?.entity, merged[0]?.entity, merged[0]?.entity]);
  });
});
