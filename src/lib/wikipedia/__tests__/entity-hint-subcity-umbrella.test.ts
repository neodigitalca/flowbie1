import { describe, expect, it } from "vitest";
import {
  dropCityUmbrellaTitlesWhenFinerExist,
  isCityUmbrellaTitle,
  isLikelyNonPhysicalPlaceWikiTitle,
} from "@/lib/wikipedia/entity-hint-subcity";

describe("dropCityUmbrellaTitlesWhenFinerExist", () => {
  it("drops bare city title when neighbourhood titles exist", () => {
    const titles = ["Calgary", "Ramsay, Calgary", "Quarry Park, Calgary"];
    const out = dropCityUmbrellaTitlesWhenFinerExist(titles, "Calgary");
    expect(out.map((t) => t.toLowerCase())).not.toContain("calgary");
    expect(out.some((t) => t.includes("Ramsay"))).toBe(true);
  });

  it("keeps umbrella when it is the only title", () => {
    const titles = ["Calgary"];
    const out = dropCityUmbrellaTitlesWhenFinerExist(titles, "Calgary");
    expect(out).toEqual(["Calgary"]);
  });

  it("does not treat non-umbrella titles as city-only", () => {
    expect(isCityUmbrellaTitle("Calgary SE", "Calgary")).toBe(false);
  });
});

describe("isLikelyNonPhysicalPlaceWikiTitle", () => {
  it("rejects crime and tragedy event articles", () => {
    expect(isLikelyNonPhysicalPlaceWikiTitle("Murder of Curtis Klassen")).toBe(true);
    expect(isLikelyNonPhysicalPlaceWikiTitle("Death of John Smith")).toBe(true);
    expect(isLikelyNonPhysicalPlaceWikiTitle("Mass shooting in Altona")).toBe(true);
  });

  it("allows real place and building titles", () => {
    expect(isLikelyNonPhysicalPlaceWikiTitle("Millwood, Altona")).toBe(false);
    expect(isLikelyNonPhysicalPlaceWikiTitle("Millennium Exhibition Centre")).toBe(false);
    expect(isLikelyNonPhysicalPlaceWikiTitle("Confederation Park, Calgary")).toBe(false);
  });
});
