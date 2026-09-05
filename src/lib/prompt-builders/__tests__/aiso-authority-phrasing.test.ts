import { describe, expect, it } from "vitest";
import { AISO_AUTHORITY_PHRASING_RULE, AISO_DEPTH_RULE, AISO_SEMANTIC_BREADTH_RULE } from "@/lib/content-optimization/first-party-authority-prompt";
import {
  AUTHENTICITY_WRITER_RULE,
} from "@/lib/prompt-builders/core";
import { buildBulkHarnessSectionUserPrompt } from "@/lib/prompt-builders/system-user";

describe("AISO_AUTHORITY_PHRASING_RULE", () => {
  it("covers natural phrasing, mechanism, shading vs efficiency, low-light, qualified claims, without client names", () => {
    expect(AISO_AUTHORITY_PHRASING_RULE).toContain("Natural phrasing");
    expect(AISO_AUTHORITY_PHRASING_RULE).toContain("for more");
    expect(AISO_AUTHORITY_PHRASING_RULE).toContain("Conclusion requires mechanism");
    expect(AISO_AUTHORITY_PHRASING_RULE).toContain("Technical accuracy");
    expect(AISO_AUTHORITY_PHRASING_RULE).toContain("partial-shading");
    expect(AISO_AUTHORITY_PHRASING_RULE).toContain("low-light");
    expect(AISO_AUTHORITY_PHRASING_RULE).toContain("Comfort and energy hedging");
    expect(AISO_AUTHORITY_PHRASING_RULE).toContain("higher-efficiency panels solve shading");
    expect(AISO_AUTHORITY_PHRASING_RULE).not.toContain("Edmonton");
    expect(AISO_AUTHORITY_PHRASING_RULE).not.toContain("Ridgeline");
  });
});

describe("AISO_DEPTH_RULE", () => {
  it("covers sourced numbers, comparisons, regional facts, currency, and anti-repetition", () => {
    expect(AISO_DEPTH_RULE).toContain("Direct answer first");
    expect(AISO_DEPTH_RULE).toContain("Sourced numbers");
    expect(AISO_DEPTH_RULE).toContain("explicit currency");
    expect(AISO_DEPTH_RULE).toContain("Comparisons");
    expect(AISO_DEPTH_RULE).toContain("Regional specificity");
    expect(AISO_DEPTH_RULE).toContain("Never invent figures");
    expect(AISO_DEPTH_RULE).toContain("No concept repetition");
    expect(AISO_DEPTH_RULE).not.toContain("Edmonton");
    expect(AISO_DEPTH_RULE).not.toContain("Ridgeline");
  });
});

describe("AUTHENTICITY rules extended for AISO phrasing", () => {
  it("writer rule requires mechanism, forbids spec conflation, low-light blanket pros, and requires CAD/USD on money", () => {
    expect(AUTHENTICITY_WRITER_RULE).toContain("named mechanism");
    expect(AUTHENTICITY_WRITER_RULE).toContain("Do not conflate unrelated specs");
    expect(AUTHENTICITY_WRITER_RULE).toContain("low-light");
    expect(AUTHENTICITY_WRITER_RULE).toContain('dangling "for more"');
    expect(AUTHENTICITY_WRITER_RULE).toContain("explicit CAD or USD");
    expect(AUTHENTICITY_WRITER_RULE).toContain("Do not restate the same core concept");
    expect(AUTHENTICITY_WRITER_RULE).toContain("Answer THIS H2's job");
    expect(AUTHENTICITY_WRITER_RULE).toContain("copying Answer's dates");
  });
});

describe("AISO_SEMANTIC_BREADTH_RULE", () => {
  it("caps exact phrase and requires semantic variants", () => {
    expect(AISO_SEMANTIC_BREADTH_RULE).toContain("Article-wide cap");
    expect(AISO_SEMANTIC_BREADTH_RULE).toContain("semantic variants");
    expect(AISO_SEMANTIC_BREADTH_RULE).toContain("override checklist density");
  });
});

describe("harness prompt ordering with AISO phrasing", () => {
  it("places A+ rule then AISO phrasing then AISO depth then semantic breadth then authenticity", () => {
    const prompt = buildBulkHarnessSectionUserPrompt(
      "Solar Panel Efficiency",
      "Guide for homeowners",
      "<h2>Cost Factors</h2>\nBody",
      "outline",
      ["Climate Impact"],
      2,
      5,
      { name: "Site", siteUrl: "https://example.com" },
      undefined,
      undefined,
      true,
      "https://example.com/post/",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "Cost Factors",
      "solar efficiency",
      ["Answer", "Overview", "Cost Factors", "Climate Impact"],
    );
    const aplusIdx = prompt.indexOf("A+ HOMEOWNER ARTICLE");
    const keywordIdx = prompt.indexOf("A+ KEYWORD AUTHORITY");
    const aisoIdx = prompt.indexOf("AISO AUTHORITY PHRASING");
    const depthIdx = prompt.indexOf("AISO DEPTH");
    const breadthIdx = prompt.indexOf("AISO SEMANTIC BREADTH");
    const authIdx = prompt.indexOf("AUTHENTICITY (NON-NEGOTIABLE)");
    expect(aplusIdx).toBeGreaterThanOrEqual(0);
    expect(keywordIdx).toBeGreaterThan(aplusIdx);
    expect(aisoIdx).toBeGreaterThan(keywordIdx);
    expect(depthIdx).toBeGreaterThan(aisoIdx);
    expect(breadthIdx).toBeGreaterThan(depthIdx);
    expect(authIdx).toBeGreaterThan(breadthIdx);
    expect(prompt).toContain("INTERNAL LINK ANCHOR MATCH");
  });

  it("includes comparison and automation tier rules for vs smart blinds keyword", () => {
    const prompt = buildBulkHarnessSectionUserPrompt(
      "Smart Blinds Vs Traditional",
      "Compare options",
      "<h2>Cost</h2>\nBody",
      "outline",
      [],
      2,
      5,
      { name: "Blind Magic", siteUrl: "https://blindmagic.com" },
      undefined,
      undefined,
      true,
      "https://blindmagic.com/blog/smart-blinds/",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "Cost Factors",
      "Smart Blinds Automation Vs Traditional Blinds",
      ["Answer", "Overview", "Cost Factors"],
    );
    expect(prompt).toContain("COMPARISON ANSWER");
    expect(prompt).toContain("AUTOMATION TIER TAXONOMY");
  });
});
