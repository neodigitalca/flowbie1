import { describe, expect, it } from "vitest";
import {
  extractRivalBrandNeedlesFromDomain,
  phraseMatchesCompetitorRivalBrand,
} from "@/lib/competitor-research/competitor-keyword-rival-brand-filter";

describe("extractRivalBrandNeedlesFromDomain", () => {
  it("derives brand core from glued SLD", () => {
    const n = extractRivalBrandNeedlesFromDomain("orchardsdental.ca");
    expect(n.some((x) => x.includes("orchards"))).toBe(true);
  });

  it("handles hyphenated domains", () => {
    const n = extractRivalBrandNeedlesFromDomain("duggan-family-dental.com");
    expect(n).toContain("duggan");
  });
});

describe("phraseMatchesCompetitorRivalBrand", () => {
  it("flags navigational brand queries for that competitor", () => {
    expect(phraseMatchesCompetitorRivalBrand("orchards dental", "orchardsdental.ca")).toBe(true);
    expect(phraseMatchesCompetitorRivalBrand("dental clinic orchards", "orchardsdental.ca")).toBe(true);
    expect(phraseMatchesCompetitorRivalBrand("saddleback dental", "saddlebackdental.ca")).toBe(true);
    expect(phraseMatchesCompetitorRivalBrand("dentist saddleback", "saddlebackdental.ca")).toBe(true);
    expect(phraseMatchesCompetitorRivalBrand("dental clinic saddleback", "saddlebackdental.ca")).toBe(true);
    expect(phraseMatchesCompetitorRivalBrand("duggan family dental", "dugganfamilydental.com")).toBe(true);
    expect(phraseMatchesCompetitorRivalBrand("family dentist duggan", "dugganfamilydental.com")).toBe(true);
    expect(phraseMatchesCompetitorRivalBrand("maya dental", "mayadentalclinic.com")).toBe(true);
    expect(phraseMatchesCompetitorRivalBrand("dental clinic maya", "mayadentalclinic.com")).toBe(true);
  });

  it("does not flag topical non-brand queries", () => {
    expect(phraseMatchesCompetitorRivalBrand("emergency dentist edmonton", "orchardsdental.ca")).toBe(false);
    expect(phraseMatchesCompetitorRivalBrand("family dentist near me", "saddlebackdental.ca")).toBe(false);
  });
});
