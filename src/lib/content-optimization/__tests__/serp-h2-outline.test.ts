import { describe, expect, it } from "vitest";
import {
  formatSerpH2OutlineBlock,
  validateSerpH2OutlineTitles,
} from "@/lib/content-optimization/serp-h2-outline";

describe("serp-h2-outline", () => {
  it("formats dynamic outline block", () => {
    const block = formatSerpH2OutlineBlock(["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]);
    expect(block).toContain("SERP H2 OUTLINE");
    expect(block).toContain("1. Alpha");
    expect(block).toContain("5. Epsilon");
  });

  it("accepts valid outline titles", () => {
    const titles = validateSerpH2OutlineTitles([
      "Smart Blinds Cost Factors",
      "Motorization Options",
      "Install Steps",
      "Local Example",
      "Our Pick",
    ]);
    expect(titles).toHaveLength(5);
  });

  it("rejects live post H2 reuse on optimize", () => {
    expect(() =>
      validateSerpH2OutlineTitles(
        ["Smart Blinds Cost Factors", "Motorization Options", "Install Steps", "Local Example", "Our Pick"],
        ["Smart Blinds Cost Factors"],
      ),
    ).toThrow(/live post H2/i);
  });
});
