import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsImageLabelCandidates,
  cityLabelsForEntity,
  startGoogleMapsImageForRow,
  startGoogleMapsImagesForRows,
} from "@/lib/content-generation/google-maps-image-api";

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

  it("builds entity-first label list with city fallback", () => {
    expect(
      buildGoogleMapsImageLabelCandidates("East Cobb, Marietta, GA", "East Cobb, Marietta, GA"),
    ).toEqual(["East Cobb, Marietta, GA", "Marietta, GA"]);
  });

  it("dedupes repeated labels", () => {
    expect(buildGoogleMapsImageLabelCandidates("Altona, MB", "Altona, MB")).toEqual(["Altona, MB"]);
  });

  it("starts Google Image fetches without awaiting", () => {
    expect(() =>
      startGoogleMapsImagesForRows(
        [{ entity: "Aldergrove", featuredImage: "google-maps" }],
        "google-maps",
      ),
    ).not.toThrow();
    expect(() =>
      startGoogleMapsImageForRow({ entity: "N/A", featuredImage: "google-maps" }),
    ).not.toThrow();
  });
});
