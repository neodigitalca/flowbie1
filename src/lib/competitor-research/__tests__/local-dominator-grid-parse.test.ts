import { describe, expect, it } from "vitest";
import { parseCompetitorGridTopPlaces } from "@/lib/competitor-research/local-dominator-grid-parse";

describe("parseCompetitorGridTopPlaces", () => {
  it("accepts rows with Place ID but no Rank column", () => {
    const csv = [
      "Business,Place ID,Website URL",
      "Acme Dental,ChIJxxxxxxxxxxxxxxx,https://example.com",
    ].join("\n");
    const { places, error } = parseCompetitorGridTopPlaces(csv);
    expect(error).toBeUndefined();
    expect(places).toHaveLength(1);
    expect(places[0]?.dfsKeyword.startsWith("place_id:")).toBe(true);
    expect(places[0]?.rank).toBe(999);
  });

  it("strips BOM from first header cell", () => {
    const csv = "\uFEFFBusiness,Place ID\nTest,ChIJabcdefghijklmno";
    const { places, error } = parseCompetitorGridTopPlaces(csv);
    expect(error).toBeUndefined();
    expect(places).toHaveLength(1);
  });

  it("reads Rank from alternate headers", () => {
    const csv = [
      "Business,Position,Place ID",
      "Foo,1,ChIJxxxxxxxxxxxxxxx",
    ].join("\n");
    const { places } = parseCompetitorGridTopPlaces(csv);
    expect(places[0]?.rank).toBe(1);
  });
});
