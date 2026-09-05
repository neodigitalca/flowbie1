import { describe, expect, it } from "vitest";
import { cityLabelsForEntity } from "@/lib/content-generation/google-maps-image-api";

describe("cityLabelsForEntity", () => {
  it("extracts city from POI + region labels", () => {
    expect(cityLabelsForEntity("Altona Community Centre, MB")).toEqual(["Altona, MB", "Altona"]);
  });

  it("extracts city from neighborhood + city + region labels", () => {
    expect(cityLabelsForEntity("Millwood, Altona, MB")).toEqual(["Altona, MB"]);
  });

  it("extracts bare city from region + city labels", () => {
    expect(cityLabelsForEntity("Pembina Valley Region, Altona")).toEqual([
      "Pembina Valley Region, Altona",
      "Altona",
    ]);
  });
});
