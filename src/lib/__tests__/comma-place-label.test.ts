import { describe, expect, it } from "vitest";
import {
  dedupeRepeatedCommaPlaceSegments,
  mergePlaceHintWithGeoSuffix,
  normalizeEntityHintCommaLabel,
  stripRedundantCityFromCommaPlaceLabel,
} from "@/lib/comma-place-label";

describe("dedupeRepeatedCommaPlaceSegments", () => {
  it("removes consecutive duplicate place names", () => {
    expect(dedupeRepeatedCommaPlaceSegments("Stuart, Stuart, FL")).toBe("Stuart, FL");
  });

  it("removes non-adjacent duplicate segments (same city twice)", () => {
    expect(dedupeRepeatedCommaPlaceSegments("Stuart, Martin County, Stuart, FL")).toBe(
      "Stuart, Martin County, FL",
    );
  });

  it("preserves distinct segments", () => {
    expect(dedupeRepeatedCommaPlaceSegments("Palm City, Stuart, FL")).toBe("Palm City, Stuart, FL");
  });

  it("collapses duplicate city before province (Edmonton, Edmonton, AB)", () => {
    expect(dedupeRepeatedCommaPlaceSegments("Edmonton, Edmonton, AB")).toBe("Edmonton, AB");
  });

  it("collapses duplicate city before province (Toronto, Toronto, ON)", () => {
    expect(dedupeRepeatedCommaPlaceSegments("Toronto, Toronto, ON")).toBe("Toronto, ON");
  });
});

describe("stripRedundantCityFromCommaPlaceLabel", () => {
  it("drops city when neighbourhood already contains it", () => {
    expect(stripRedundantCityFromCommaPlaceLabel("West Edmonton, Edmonton, AB")).toBe("West Edmonton, AB");
  });

  it("keeps city when neighbourhood is distinct", () => {
    expect(stripRedundantCityFromCommaPlaceLabel("Downtown, Edmonton, AB")).toBe("Downtown, Edmonton, AB");
  });
});

describe("normalizeEntityHintCommaLabel", () => {
  it("trims and dedupes (SAP entity field)", () => {
    expect(normalizeEntityHintCommaLabel("  Toronto, Toronto, ON  ")).toBe("Toronto, ON");
  });

  it("strips embedded city from neighbourhood labels", () => {
    expect(normalizeEntityHintCommaLabel("West Edmonton, Edmonton, AB")).toBe("West Edmonton, AB");
  });
});

describe("mergePlaceHintWithGeoSuffix", () => {
  it("does not duplicate when the suffix already starts with the hint", () => {
    expect(mergePlaceHintWithGeoSuffix("Stuart", "Stuart, FL")).toBe("Stuart, FL");
  });

  it("keeps full suffix when hint is a full prefix of the suffix", () => {
    expect(mergePlaceHintWithGeoSuffix("Stuart", "Stuart, Martin County, FL")).toBe("Stuart, Martin County, FL");
  });

  it("joins distinct hint and suffix", () => {
    expect(mergePlaceHintWithGeoSuffix("Downtown", "Calgary, AB")).toBe("Downtown, Calgary, AB");
  });
});
