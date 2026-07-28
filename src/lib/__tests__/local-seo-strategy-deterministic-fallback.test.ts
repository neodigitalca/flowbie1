import { describe, expect, it } from "vitest";
import {
  assertDistinctSapKeywordEntityPairs,
  buildDeterministicSapRowsFromKeywordTargets,
  normalizeSapKeywordFromModelOutput,
  sapKeywordFromModelPhrase,
  stripGeographyTokensFromSapKeyword,
} from "@/lib/local-seo-strategy-from-grid";

describe("buildDeterministicSapRowsFromKeywordTargets", () => {
  it("produces exact row count with empty titles (Gemini title agent fills later)", () => {
    const rows = buildDeterministicSapRowsFromKeywordTargets({
      keywordTargets: [
        { keyword: "window blinds", sapPages: 30 },
        { keyword: "roller shades", sapPages: 15 },
      ],
      targetTotal: 45,
      entityLocation: "Tampa, FL, United States",
    });
    expect(rows).toHaveLength(45);
    for (const r of rows) {
      expect(r.title).toBe("");
      expect(r.entity.split(",").length).toBeGreaterThanOrEqual(3);
      expect(r.featuredImage).toBe("google-maps");
    }
  });

  it("uses province from market label for Edmonton (not US as third segment)", () => {
    const rows = buildDeterministicSapRowsFromKeywordTargets({
      keywordTargets: [{ keyword: "window blinds", sapPages: 3 }],
      targetTotal: 3,
      entityLocation: "Edmonton, AB",
    });
    expect(rows[0]?.entity).toMatch(/,\s*Edmonton,\s*AB\s*$/i);
    expect(rows[0]?.entity).not.toMatch(/,\s*US\s*$/);
  });

  it("infers BC from city name when market has no region segment (plain lookup, not regex)", () => {
    const rows = buildDeterministicSapRowsFromKeywordTargets({
      keywordTargets: [{ keyword: "plumber", sapPages: 1 }],
      targetTotal: 1,
      entityLocation: "Vancouver",
    });
    expect(rows[0]?.entity).toMatch(/,\s*Vancouver,\s*BC\s*$/i);
  });

  it("uses distinct keyword strings within a multi-row cluster (not three copies of the anchor)", () => {
    const rows = buildDeterministicSapRowsFromKeywordTargets({
      keywordTargets: [{ keyword: "solar panel installation Edmonton", sapPages: 3 }],
      targetTotal: 3,
      entityLocation: "Edmonton, AB",
    });
    const kws = rows.map((r) => r.keyword.trim().toLowerCase());
    expect(new Set(kws).size).toBe(3);
    for (const r of rows) {
      expect(r.title).toBe("");
    }
  });

  it("strips city/region tokens from the anchor when sapPages is 1", () => {
    const rows = buildDeterministicSapRowsFromKeywordTargets({
      keywordTargets: [{ keyword: "solar panel installation Edmonton", sapPages: 1 }],
      targetTotal: 1,
      entityLocation: "Edmonton, AB",
    });
    expect(rows[0]?.keyword).toBe("solar panel installation");
    expect(rows[0]?.keyword.toLowerCase()).not.toContain("edmonton");
  });

  it("stripGeographyTokensFromSapKeyword removes entity and market tokens (Installation Central Edmonton)", () => {
    const kw = stripGeographyTokensFromSapKeyword(
      "Installation Central Edmonton",
      "Central Edmonton, Edmonton, AB",
      "Edmonton, AB",
    );
    expect(kw).toBe("Installation");
  });

  it("stripGeographyTokensFromSapKeyword removes Alberta when not in entity string", () => {
    const kw = stripGeographyTokensFromSapKeyword(
      "MURB solar Alberta ROI",
      "Acheson, Edmonton, AB",
      "Edmonton, AB",
    );
    expect(kw).toBe("MURB solar ROI");
  });

  it("stripGeographyTokensFromSapKeyword drops tokens that appear as whole words in entity text", () => {
    const kw = stripGeographyTokensFromSapKeyword(
      "Palisades heat pump incentives",
      "The Palisades, Edmonton, AB",
      "Edmonton, AB",
    );
    expect(kw.toLowerCase()).not.toContain("palisades");
    expect(kw.length).toBeGreaterThan(0);
  });

  it("stripGeographyTokensFromSapKeyword removes numeric civic street phrases from keyword", () => {
    const kw = stripGeographyTokensFromSapKeyword(
      "heat pump repair 127 Street NW",
      "Rundle Heights, Edmonton, AB",
      "Edmonton, AB",
    );
    expect(kw.toLowerCase()).not.toMatch(/\b127\b/);
    expect(kw.toLowerCase()).not.toContain("street");
  });

  it("stripGeographyTokensFromSapKeyword abbreviates Clean Energy Improvement Program to CEIP", () => {
    const kw = stripGeographyTokensFromSapKeyword(
      "Clean Energy Improvement Program rebates solar",
      "Downtown, Edmonton, AB",
      "Edmonton, AB",
    );
    expect(kw).toMatch(/CEIP/i);
    expect(kw.toLowerCase()).not.toContain("clean energy");
  });

  it("normalizeSapKeywordFromModelOutput keeps model wording (no entity-based strip)", () => {
    expect(normalizeSapKeywordFromModelOutput("the Strip, Las Vegas")).toBe("the Strip, Las Vegas");
  });

  it("sapKeywordFromModelPhrase passes through the model phrase unchanged (no server strip/trim)", () => {
    expect(
      sapKeywordFromModelPhrase(
        "event tent rental Dallas",
        "Arts District, Dallas, TX",
        "Dallas, TX",
      ),
    ).toBe("event tent rental Dallas");
    expect(sapKeywordFromModelPhrase("  x  y  ")).toBe("  x  y  ");
  });

  it("assertDistinctSapKeywordEntityPairs throws on duplicate keyword+entity", () => {
    expect(() =>
      assertDistinctSapKeywordEntityPairs(
        [
          { keyword: "solar", entity: "A, B, C", title: "t", modifier: "", featuredImage: "google-maps" },
          { keyword: "solar", entity: "A, B, C", title: "t2", modifier: "", featuredImage: "google-maps" },
        ],
        "test",
      ),
    ).toThrow(/duplicate keyword\+entity/);
  });

  it("assertDistinctSapKeywordEntityPairs allows same keyword with different entities", () => {
    expect(() =>
      assertDistinctSapKeywordEntityPairs(
        [
          { keyword: "solar", entity: "Area One, Edmonton, AB", title: "t", modifier: "", featuredImage: "google-maps" },
          { keyword: "solar", entity: "Area Two, Edmonton, AB", title: "t2", modifier: "", featuredImage: "google-maps" },
        ],
        "test",
      ),
    ).not.toThrow();
  });
});
