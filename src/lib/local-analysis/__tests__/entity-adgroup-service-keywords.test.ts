import { describe, expect, it } from "vitest";
import {
  composeServiceKeywordWithAdGroupEntity,
  harvestOrphanPlaceLabelsFromBases,
  harvestTrailingPlacePhrasesFromBases,
  keywordStillContainsPlaceTokens,
  sanitizeUniqueServiceKeywordsForAdGroup,
  stripAllPlaceTokensFromKeyword,
} from "@/lib/local-analysis/entity-sap-row-keyword-fill";
import {
  assignUniqueKeywordsPerAdGroup,
  serviceKeywordForEntitySlot,
} from "@/lib/local-analysis/entity-preload-suggested-keywords";

describe("stripAllPlaceTokensFromKeyword", () => {
  it("strips Sherwood Park and Edmonton from GSC phrases", () => {
    const corpus = ["Edmonton, AB", "Sherwood Park, AB", "St. Albert, AB"];
    expect(stripAllPlaceTokensFromKeyword("blinds sherwood park", corpus)).toBe("blinds");
    expect(stripAllPlaceTokensFromKeyword("blinds edmonton", corpus)).toBe("blinds");
    expect(stripAllPlaceTokensFromKeyword("blind repair edmonton", corpus)).toBe("blind repair");
  });

  it("returns empty when the entire phrase is place tokens", () => {
    expect(
      stripAllPlaceTokensFromKeyword("edmonton sherwood park", [
        "Edmonton, AB",
        "Sherwood Park, AB",
      ]),
    ).toBe("");
  });
});

describe("harvestOrphanPlaceLabelsFromBases", () => {
  it("strip alone drops sherwood when neighbourhood park is in the seed corpus", () => {
    const seed = ["Edmonton, AB", "West Meadowlark Park, Edmonton, AB"];
    expect(stripAllPlaceTokensFromKeyword("blinds sherwood park", seed)).toBe("blinds");
    const trailing = harvestTrailingPlacePhrasesFromBases(["blinds sherwood park"]);
    expect(trailing).toContain("sherwood park");
    expect(stripAllPlaceTokensFromKeyword("blinds sherwood park", [...seed, ...trailing])).toBe(
      "blinds",
    );
  });
});

describe("stripAllPlaceTokensFromKeyword orphan park head", () => {
  it("drops sherwood when park is removed via another AdGroup entity", () => {
    const corpus = [
      "Edmonton, AB",
      "St. Albert, AB",
      "Lacombe Park, St. Albert, AB",
      "Woodlands, St. Albert, AB",
    ];
    expect(stripAllPlaceTokensFromKeyword("blinds sherwood park", corpus)).toBe("blinds");
  });

  it("strips sherwood park as a harvested trailing place phrase", () => {
    const corpus = ["Edmonton, AB", "St. Albert, AB", "sherwood park"];
    expect(stripAllPlaceTokensFromKeyword("blinds sherwood park", corpus)).toBe("blinds");
    expect(stripAllPlaceTokensFromKeyword("blinds sherwood", [...corpus, "sherwood"])).toBe("blinds");
  });
});

describe("composeServiceKeywordWithAdGroupEntity", () => {
  it("appends lowercase entity with no commas", () => {
    expect(composeServiceKeywordWithAdGroupEntity("blinds", "North Glenora, Edmonton, AB")).toBe(
      "blinds north glenora edmonton",
    );
    expect(composeServiceKeywordWithAdGroupEntity("blind repair", "Canora, Edmonton, AB")).toBe(
      "blind repair canora edmonton",
    );
  });
});

describe("keywordStillContainsPlaceTokens", () => {
  it("detects foreign place words", () => {
    expect(
      keywordStillContainsPlaceTokens("blinds sherwood", ["Sherwood Park, AB", "Edmonton, AB"]),
    ).toBe(true);
    expect(keywordStillContainsPlaceTokens("blind repair", ["Edmonton, AB"])).toBe(false);
  });
});

describe("sanitizeUniqueServiceKeywordsForAdGroup", () => {
  it("returns unique keywords with AdGroup entity appended", () => {
    const out = sanitizeUniqueServiceKeywordsForAdGroup(
      ["blinds edmonton", "blind repair edmonton", "blinds edmonton", "roman shades"],
      "Edmonton, AB",
      ["Sherwood Park, AB", "Edmonton, AB"],
    );
    expect(out).toEqual([
      "blinds edmonton",
      "blind repair edmonton",
      "roman shades edmonton",
    ]);
  });
});

describe("assignUniqueKeywordsPerAdGroup", () => {
  it("assigns unique keywords within each AdGroup; may reuse across groups", () => {
    const rows = assignUniqueKeywordsPerAdGroup(
      [
        { keyword: "blinds edmonton", title: "", entity: "Edmonton, AB" },
        { keyword: "blinds sherwood park", title: "", entity: "Edmonton, AB" },
        { keyword: "", title: "", entity: "Westmount, Edmonton, AB" },
      ],
      ["Edmonton, AB", "Sherwood Park, AB", "Westmount, Edmonton, AB"],
      ["blinds", "blind repair", "roman shades", "custom blinds"],
    );
    const edmonton = rows.filter((r) => r.entity === "Edmonton, AB").map((r) => r.keyword);
    expect(new Set(edmonton.map((k) => k?.toLowerCase())).size).toBe(edmonton.length);
    expect(edmonton.every((k) => k && !/sherwood/i.test(k))).toBe(true);
    expect(edmonton.every((k) => k?.endsWith(" edmonton"))).toBe(true);
    expect(rows[2]!.keyword?.trim()).toBeTruthy();
    expect(rows[2]!.keyword?.toLowerCase()).toContain("westmount edmonton");
  });

  it("refills every later AdGroup from the same pool (no global drain)", () => {
    const pool = ["blinds", "blind repair", "roman shades"];
    const rows = assignUniqueKeywordsPerAdGroup(
      [
        { keyword: "", title: "", entity: "Lacombe Park, St. Albert, AB" },
        { keyword: "", title: "", entity: "Lacombe Park, St. Albert, AB" },
        { keyword: "", title: "", entity: "Lacombe Park, St. Albert, AB" },
        { keyword: "", title: "", entity: "Riel, St. Albert, AB" },
        { keyword: "", title: "", entity: "Riel, St. Albert, AB" },
        { keyword: "", title: "", entity: "Riel, St. Albert, AB" },
        { keyword: "", title: "", entity: "Oakmont, St. Albert, AB" },
        { keyword: "", title: "", entity: "Oakmont, St. Albert, AB" },
        { keyword: "", title: "", entity: "Oakmont, St. Albert, AB" },
      ],
      ["St. Albert, AB", "Lacombe Park, St. Albert, AB", "Riel, St. Albert, AB", "Oakmont, St. Albert, AB"],
      pool,
    );
    expect(rows.every((r) => Boolean(r.keyword?.trim()))).toBe(true);
    for (const entity of [
      "Lacombe Park, St. Albert, AB",
      "Riel, St. Albert, AB",
      "Oakmont, St. Albert, AB",
    ]) {
      const kws = rows.filter((r) => r.entity === entity).map((r) => r.keyword!.toLowerCase());
      expect(new Set(kws).size).toBe(3);
    }
  });
});

describe("serviceKeywordForEntitySlot", () => {
  it("strips cities from GSC phrases using full corpus", () => {
    expect(
      serviceKeywordForEntitySlot("blinds edmonton", "Westmount, Edmonton, AB", [
        "Edmonton, AB",
        "Sherwood Park, AB",
      ]),
    ).toBe("blinds");
    expect(
      serviceKeywordForEntitySlot("blinds sherwood park", "Canora, Edmonton, AB", [
        "Edmonton, AB",
        "Sherwood Park, AB",
      ]),
    ).toBe("blinds");
  });
});
