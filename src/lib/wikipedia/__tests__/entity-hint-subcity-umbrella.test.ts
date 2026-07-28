import { describe, expect, it } from "vitest";
import {
  dropCityUmbrellaTitlesWhenFinerExist,
  isCityUmbrellaTitle,
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
