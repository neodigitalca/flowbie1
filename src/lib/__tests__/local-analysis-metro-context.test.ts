import { describe, expect, it } from "vitest";
import { mergeWikipediaSearchAugmentParts } from "@/lib/local-analysis-metro-context";
import { orderWikipediaTitlesByGridPlaces } from "@/lib/wikipedia/extract-wikipedia-pool-titles";

describe("mergeWikipediaSearchAugmentParts", () => {
  it("dedupes and merges grid + focus + radius + primary", () => {
    const out = mergeWikipediaSearchAugmentParts({
      gridCsvAugment: "Calgary AB Canada",
      suggestFocusLocation: "Calgary, Alberta",
      radiusLocationLabel: "Okotoks, AB",
      primarySiteLabel: "Calgary Alberta",
    });
    expect(out).toBeTruthy();
    expect(out!.toLowerCase()).toContain("calgary");
    expect(out!.toLowerCase()).toContain("okotoks");
  });
});

describe("orderWikipediaTitlesByGridPlaces (pool ordering for weak areas)", () => {
  it("orders titles matching higher-weight grid places first", () => {
    const weights = [
      { place: "Airdrie, AB", weight: 95 },
      { place: "Calgary, AB", weight: 40 },
    ];
    const titles = ["Calgary", "Airdrie"];
    const ordered = orderWikipediaTitlesByGridPlaces(titles, weights);
    expect(ordered[0]).toMatch(/Airdrie/i);
  });
});
