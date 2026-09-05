import { describe, expect, it } from "vitest";
import {
  A_PLUS_HOMEOWNER_ARTICLE_RULE,
  A_PLUS_KEYWORD_AUTHORITY_RULE,
} from "@/lib/content-optimization/first-party-authority-prompt";
import {
  AUTHENTICITY_CHECKLIST_RULE,
  AUTHENTICITY_WRITER_RULE,
  SYSTEM_PROMPT_CORE,
} from "@/lib/prompt-builders/core";
import { buildBulkHarnessSectionUserPrompt } from "@/lib/prompt-builders/system-user";

const HARDCODED_VERTICALS = ["111 Street", "window treatment", "Neo Digital"];

describe("A_PLUS_HOMEOWNER_ARTICLE_RULE", () => {
  it("covers all four A+ requirements without hardcoded client names", () => {
    expect(A_PLUS_HOMEOWNER_ARTICLE_RULE).toContain("Numbers that mean something");
    expect(A_PLUS_HOMEOWNER_ARTICLE_RULE).toContain("Cost/ROI/savings H2s");
    expect(A_PLUS_HOMEOWNER_ARTICLE_RULE).toContain("When ARTICLE CONTENT TYPE is cost or how_to");
    expect(A_PLUS_HOMEOWNER_ARTICLE_RULE).toContain("skip a dedicated climate H2");
    expect(A_PLUS_HOMEOWNER_ARTICLE_RULE).toContain("Worth-the-extra-cost H2");
    expect(A_PLUS_HOMEOWNER_ARTICLE_RULE).toContain("No generic filler");
    expect(A_PLUS_HOMEOWNER_ARTICLE_RULE).toContain("explicit currency");
    expect(A_PLUS_HOMEOWNER_ARTICLE_RULE).not.toContain("Edmonton");
    expect(A_PLUS_HOMEOWNER_ARTICLE_RULE).not.toContain("Ridgeline");
  });
});

describe("A_PLUS_KEYWORD_AUTHORITY_RULE", () => {
  it("covers six keyword-parameterized A+ items without hardcoded verticals", () => {
    expect(A_PLUS_KEYWORD_AUTHORITY_RULE).toContain("Place-entity density (~70% cut)");
    expect(A_PLUS_KEYWORD_AUTHORITY_RULE).toContain("Keyword-specific practitioner knowledge");
    expect(A_PLUS_KEYWORD_AUTHORITY_RULE).toContain("Concrete search-intent examples");
    expect(A_PLUS_KEYWORD_AUTHORITY_RULE).toContain("No AI / programmatic voice");
    expect(A_PLUS_KEYWORD_AUTHORITY_RULE).toContain("First-hand connected-business evidence");
    expect(A_PLUS_KEYWORD_AUTHORITY_RULE).toContain("No unsubstantiated local expertise");
    expect(A_PLUS_KEYWORD_AUTHORITY_RULE).toContain("writing keyword");
    expect(A_PLUS_KEYWORD_AUTHORITY_RULE).toContain("2-3 concrete searcher questions");
    expect(A_PLUS_KEYWORD_AUTHORITY_RULE).toContain("Never from a hardcoded vertical");
    expect(A_PLUS_KEYWORD_AUTHORITY_RULE).toContain("If no place entity is present, skip this item");
    for (const banned of HARDCODED_VERTICALS) {
      expect(A_PLUS_KEYWORD_AUTHORITY_RULE).not.toContain(banned);
    }
  });
});

describe("AUTHENTICITY rules extended for A+", () => {
  it("checklist requires regional climate, worth-extra-cost tradeoff, and [NUMBERS] slots", () => {
    expect(AUTHENTICITY_CHECKLIST_RULE).toContain("connected service area's climate");
    expect(AUTHENTICITY_CHECKLIST_RULE).toContain("worth the extra cost");
    expect(AUTHENTICITY_CHECKLIST_RULE).toContain("[NUMBERS]");
    expect(AUTHENTICITY_CHECKLIST_RULE).toContain("peopleAlsoAsk");
    expect(AUTHENTICITY_CHECKLIST_RULE).toContain("For guide, what_is, and vs");
    expect(AUTHENTICITY_CHECKLIST_RULE).toContain("SAP PAGE TEMPLATE");
    expect(AUTHENTICITY_CHECKLIST_RULE).toContain("Product | Best for | Budget | Reason");
  });

  it("writer rule uses section budget for sourced detail", () => {
    expect(AUTHENTICITY_WRITER_RULE).toContain("reader decision path");
    expect(AUTHENTICITY_WRITER_RULE).toContain("encyclopedia filler");
    expect(AUTHENTICITY_WRITER_RULE).toContain("sourced detail");
    expect(AUTHENTICITY_WRITER_RULE).toContain("A+ KEYWORD AUTHORITY");
    expect(AUTHENTICITY_WRITER_RULE).toContain("SAP PAGE TEMPLATE");
    expect(AUTHENTICITY_WRITER_RULE).toContain("Product | Best for | Budget | Reason");
  });
});

describe("SYSTEM_PROMPT_CORE SPO as planning aid", () => {
  it("qualifies SPO so output stays natural, not labeled triples", () => {
    expect(SYSTEM_PROMPT_CORE).toContain("planning aid");
    expect(SYSTEM_PROMPT_CORE).toContain("natural practitioner prose");
    expect(SYSTEM_PROMPT_CORE).not.toContain("Every sentence in the final output MUST be derived");
  });
});

describe("harness prompt ordering", () => {
  it("places expertise gate then A+ rule then keyword authority then AISO phrasing then AISO depth then semantic breadth then authenticity", () => {
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
    const gateIdx = prompt.indexOf("INSTALLER EXPERTISE GATE");
    const aplusIdx = prompt.indexOf("A+ HOMEOWNER ARTICLE");
    const keywordIdx = prompt.indexOf("A+ KEYWORD AUTHORITY");
    const aisoIdx = prompt.indexOf("AISO AUTHORITY PHRASING");
    const depthIdx = prompt.indexOf("AISO DEPTH");
    const breadthIdx = prompt.indexOf("AISO SEMANTIC BREADTH");
    const authIdx = prompt.indexOf("AUTHENTICITY (NON-NEGOTIABLE)");
    expect(gateIdx).toBeGreaterThanOrEqual(0);
    expect(aplusIdx).toBeGreaterThan(gateIdx);
    expect(keywordIdx).toBeGreaterThan(aplusIdx);
    expect(aisoIdx).toBeGreaterThan(keywordIdx);
    expect(depthIdx).toBeGreaterThan(aisoIdx);
    expect(breadthIdx).toBeGreaterThan(depthIdx);
    expect(authIdx).toBeGreaterThan(breadthIdx);
  });
});
