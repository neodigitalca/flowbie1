import { describe, expect, it } from "vitest";
import {
  extractArticleTitlesFromGranularPoolMarkdown,
  orderWikipediaTitlesByGridPlaces,
  snapAllEntityHintsToWikipediaPoolTitles,
  snapEntityHintToWikipediaArticleTitle,
  wikipediaTitleGranularityScore,
} from "@/lib/wikipedia/extract-wikipedia-pool-titles";

describe("extractArticleTitlesFromGranularPoolMarkdown", () => {
  it("parses ### headings", () => {
    const md = `Intro line\n\n### Aster, Edmonton\n- foo\n### Athlone, Edmonton\n`;
    expect(extractArticleTitlesFromGranularPoolMarkdown(md)).toEqual(["Aster, Edmonton", "Athlone, Edmonton"]);
  });
});

describe("snapEntityHintToWikipediaArticleTitle", () => {
  const titles = ["Aster, Edmonton", "St. Albert", "Mistatim Industrial, Edmonton"];

  it("matches exact title", () => {
    expect(snapEntityHintToWikipediaArticleTitle("aster, edmonton", titles, 0)).toBe("Aster, Edmonton");
  });

  it("strips postal junk and matches", () => {
    expect(snapEntityHintToWikipediaArticleTitle("St. Albert, AB T8N 0E5", titles, 0)).toBe("St. Albert");
  });

  it("falls back by row index", () => {
    expect(snapEntityHintToWikipediaArticleTitle("totally unknown place", titles, 2)).toBe("Mistatim Industrial, Edmonton");
  });
});

describe("orderWikipediaTitlesByGridPlaces", () => {
  it("puts titles matching higher-weight places first", () => {
    const titles = ["Quiet Suburb, Minneapolis", "Downtown Core, Saint Paul", "Industrial, Minneapolis"];
    const ordered = orderWikipediaTitlesByGridPlaces(titles, [
      { place: "Saint Paul, MN", weight: 40 },
      { place: "Minneapolis, MN", weight: 10 },
    ]);
    expect(ordered[0]).toContain("Saint Paul");
  });

  it("with no place weights, prefers sub-metro titles over bare City, ST", () => {
    const titles = ["Smyrna, GA", "Historic District, Smyrna, Georgia", "Main Street, Smyrna, GA"];
    const ordered = orderWikipediaTitlesByGridPlaces(titles, []);
    expect(ordered[0]).not.toMatch(/^Smyrna, GA$/);
  });

  it("boosts wiki titles that token-overlap row-derived evidence", () => {
    const titles = ["Unrelated Place Alpha", "Industrial Quarter (Sample City)"];
    const evidence = "industrial quarter sample business corridor address line";
    const ordered = orderWikipediaTitlesByGridPlaces(titles, [{ place: "Samplecity, ST", weight: 10 }], evidence);
    expect(ordered[0]).toContain("Industrial");
  });
});

describe("wikipediaTitleGranularityScore", () => {
  it("scores neighbourhood / district above bare City, ST", () => {
    expect(wikipediaTitleGranularityScore("Downtown, Smyrna, GA")).toBeGreaterThan(
      wikipediaTitleGranularityScore("Smyrna, GA"),
    );
  });
});

describe("snapAllEntityHintsToWikipediaPoolTitles", () => {
  it("dedupes to unused titles when possible", () => {
    const titles = ["A", "B", "C"];
    const rows = [
      { keyword: "k1", sapPages: 1, entityHint: "A" },
      { keyword: "k2", sapPages: 1, entityHint: "A" },
      { keyword: "k3", sapPages: 1, entityHint: "B" },
    ];
    const out = snapAllEntityHintsToWikipediaPoolTitles(rows, titles);
    expect(out[0]!.entityHint).toBe("A");
    expect(out[1]!.entityHint).not.toBe("A");
    expect(new Set(out.map((r) => r.entityHint)).size).toBeGreaterThanOrEqual(2);
  });
});
