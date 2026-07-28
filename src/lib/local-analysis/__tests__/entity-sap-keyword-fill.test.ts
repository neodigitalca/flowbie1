import { describe, expect, it } from "vitest";
import {
  collapseRepeatedPlaceSegmentsInKeyword,
  keywordPlaceSuffixFromEntity,
  normalizeSapKeywordWithPlaceSuffix,
  sapKeywordFromShortBaseAndEntity,
} from "@/lib/local-analysis/entity-sap-row-keyword-fill";

describe("collapseRepeatedPlaceSegmentsInKeyword", () => {
  it("collapses adjacent duplicate comma segments", () => {
    expect(collapseRepeatedPlaceSegmentsInKeyword("posh outdoors Fort Saskatchewan, Fort Saskatchewan, AB")).toBe(
      "posh outdoors Fort Saskatchewan, AB",
    );
  });
});

describe("keywordPlaceSuffixFromEntity", () => {
  it("drops trailing region code and joins with spaces", () => {
    expect(keywordPlaceSuffixFromEntity("Ritchie, Edmonton, AB")).toBe("Ritchie Edmonton");
    expect(keywordPlaceSuffixFromEntity("Edmonton, AB")).toBe("Edmonton");
    expect(keywordPlaceSuffixFromEntity("Parkland County, AB")).toBe("Parkland County");
  });

  it("dedupes identical adjacent place segments", () => {
    expect(keywordPlaceSuffixFromEntity("Fort Saskatchewan, Fort Saskatchewan, AB")).toBe(
      "Fort Saskatchewan",
    );
  });
});

describe("sapKeywordFromShortBaseAndEntity", () => {
  it("strips foreign places and appends AdGroup entity lowercase", () => {
    expect(sapKeywordFromShortBaseAndEntity("posh glamping", "Parkland County, AB")).toBe(
      "posh glamping parkland county",
    );
    expect(sapKeywordFromShortBaseAndEntity("forensic accounting", "Ritchie, Edmonton, AB")).toBe(
      "forensic accounting ritchie edmonton",
    );
    expect(
      sapKeywordFromShortBaseAndEntity("posh outdoors", "Fort Saskatchewan, Fort Saskatchewan, AB"),
    ).toBe("posh outdoors fort saskatchewan");
  });

  it("strips place tokens already present in the GSC base then appends entity", () => {
    expect(
      sapKeywordFromShortBaseAndEntity("accountant Ritchie Edmonton", "Ritchie, Edmonton, AB"),
    ).toBe("accountant ritchie edmonton");
    expect(
      sapKeywordFromShortBaseAndEntity(
        "blinds edmonton",
        "West Meadowlark Park, Edmonton, AB",
        ["Edmonton, AB"],
      ),
    ).toBe("blinds west meadowlark park edmonton");
    expect(
      sapKeywordFromShortBaseAndEntity("blinds edmonton", "Westmount, Edmonton, AB", ["Edmonton, AB"]),
    ).toBe("blinds westmount edmonton");
    expect(
      sapKeywordFromShortBaseAndEntity(
        "blinds sherwood park",
        "North Glenora, Edmonton, AB",
        ["Edmonton, AB", "Sherwood Park, AB"],
      ),
    ).toBe("blinds north glenora edmonton");
  });
});

describe("normalizeSapKeywordWithPlaceSuffix", () => {
  it("strips place tokens then appends AdGroup entity", () => {
    expect(normalizeSapKeywordWithPlaceSuffix("accounting services Ritchie", "Ritchie, Edmonton, AB")).toBe(
      "accounting services ritchie edmonton",
    );
    expect(
      normalizeSapKeywordWithPlaceSuffix("tax preparation Ritchie, Edmonton", "Ritchie, Edmonton, AB"),
    ).toBe("tax preparation ritchie edmonton");
  });
});
