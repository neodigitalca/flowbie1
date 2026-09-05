import { describe, expect, it } from "vitest";
import {
  DEFENSIBLE_SPECIFICITY_RULE,
  NUMERIC_DENSITY_TARGET_RULE,
  ILLUSTRATIVE_ANSWER_GROUNDING_RULE,
  formatAnswerGroundingForIllustrativePromptBlock,
  formatAnswerTopicContractForIllustrativeExtract,
} from "@/lib/content-optimization/defensible-specificity-prompt";

describe("DEFENSIBLE_SPECIFICITY_RULE", () => {
  it("requires keeping numbers when defensible with tier 1 and tier 2", () => {
    expect(DEFENSIBLE_SPECIFICITY_RULE).toContain("Keep numbers when defensible");
    expect(DEFENSIBLE_SPECIFICITY_RULE).toContain("Tier 1");
    expect(DEFENSIBLE_SPECIFICITY_RULE).toContain("Tier 2");
    expect(DEFENSIBLE_SPECIFICITY_RULE).toContain("illustrative range");
    expect(DEFENSIBLE_SPECIFICITY_RULE).toContain("contradicted");
  });

  it("forbids stale page figures and invented amounts", () => {
    expect(DEFENSIBLE_SPECIFICITY_RULE).toContain("Forbidden");
    expect(DEFENSIBLE_SPECIFICITY_RULE).toContain("Stale existing page HTML");
  });
});

describe("NUMERIC_DENSITY_TARGET_RULE", () => {
  it("requires two confirmed economic figures in cost sections when available", () => {
    expect(NUMERIC_DENSITY_TARGET_RULE).toContain("two or more confirmed economic figures");
    expect(NUMERIC_DENSITY_TARGET_RULE).toContain("CAD or USD");
  });
});

describe("ILLUSTRATIVE_ANSWER_GROUNDING_RULE", () => {
  it("requires Answer ceiling, persona scenarios, and site recommendations", () => {
    expect(ILLUSTRATIVE_ANSWER_GROUNDING_RULE).toContain("Answer is the contract");
    expect(ILLUSTRATIVE_ANSWER_GROUNDING_RULE).toContain("Forbidden in Answer");
    expect(ILLUSTRATIVE_ANSWER_GROUNDING_RULE).toContain("ILLUSTRATIVE EXAMPLE");
    expect(ILLUSTRATIVE_ANSWER_GROUNDING_RULE).toContain("decision matching Answer");
    expect(ILLUSTRATIVE_ANSWER_GROUNDING_RULE).toContain("same industry");
    expect(ILLUSTRATIVE_ANSWER_GROUNDING_RULE).toContain("Overview Real-World Example");
    expect(ILLUSTRATIVE_ANSWER_GROUNDING_RULE).toContain("Do not recap Answer");
  });
});

describe("formatAnswerGroundingForIllustrativePromptBlock", () => {
  it("includes Answer text and grounding rule when Answer is present", () => {
    const block = formatAnswerGroundingForIllustrativePromptBlock(
      "<h2>Answer</h2><p>Payback varies by usage and system size.</p>",
    );
    expect(block).toContain("ANSWER GROUNDING");
    expect(block).toContain("Payback varies by usage");
    expect(block).toContain("ILLUSTRATIVE ↔ ANSWER GROUNDING");
    expect(block).toContain("Do not recap its dates");
  });

  it("returns empty when Answer is missing", () => {
    expect(formatAnswerGroundingForIllustrativePromptBlock(undefined)).toBe("");
    expect(formatAnswerGroundingForIllustrativePromptBlock("   ")).toBe("");
  });
});

describe("formatAnswerTopicContractForIllustrativeExtract", () => {
  it("injects Answer as the scenario topic contract", () => {
    const block = formatAnswerTopicContractForIllustrativeExtract(
      "<h2>Answer</h2><p>National SEO targets country-wide queries, unlike local SEO.</p>",
    );
    expect(block).toContain("ARTICLE ANSWER");
    expect(block).toContain("National SEO targets country-wide queries");
    expect(block).toContain("different product or service vertical");
  });

  it("returns empty when Answer is missing", () => {
    expect(formatAnswerTopicContractForIllustrativeExtract(undefined)).toBe("");
    expect(formatAnswerTopicContractForIllustrativeExtract("   ")).toBe("");
  });
});
