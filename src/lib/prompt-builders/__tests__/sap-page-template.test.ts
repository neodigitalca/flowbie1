import { describe, expect, it } from "vitest";
import {
  formatSapChecklistExample,
  formatSapPageChecklistBlock,
  formatSapPageWriterBlock,
  sapLocalRecommendationHeading,
  sapPageTemplateIsActive,
  SAP_DEFAULT_COMBINED_OUTLINE,
  SAP_FORBIDDEN_UNSUBSTANTIATED_LOCAL_EXPERTISE,
  SAP_LOCAL_RECOMMENDATION_TABLE_RULE,
  SAP_LOCAL_CONDITIONS_H2,
  SAP_OPTIONS_FIT_H2,
  SAP_PROBLEM_H2,
  SAP_NEXT_STEPS_H2,
  SAP_WHAT_WE_OFFER_H2,
} from "@/lib/prompt-builders/sap-page-template";
import { ILLUSTRATIVE_DEFAULT_H2 } from "@/lib/content-optimization/first-party-authority-prompt";

const HARDCODED_VERTICALS = [
  "111 Street",
  "window treatment",
  "Neo Digital",
  "Cellular",
  "Roller",
  "PowerView",
  "Blackout",
  "Silhouette",
];

function assertNoHardcodedVerticals(text: string) {
  for (const banned of HARDCODED_VERTICALS) {
    expect(text).not.toContain(banned);
  }
}

describe("sap-page-template", () => {
  it("checklist spine pins all seven mandatory H2 titles", () => {
    const block = formatSapPageChecklistBlock("Ben Hill, Atlanta");
    expect(block).toContain("SAP PAGE TEMPLATE");
    expect(block).toContain("Do NOT emit ARTICLE CONTENT TYPE");
    expect(block).toContain(SAP_PROBLEM_H2);
    expect(block).toContain(SAP_LOCAL_CONDITIONS_H2);
    expect(block).toContain(SAP_OPTIONS_FIT_H2);
    expect(block).toContain(ILLUSTRATIVE_DEFAULT_H2);
    expect(block).toContain(SAP_WHAT_WE_OFFER_H2);
    expect(block).toContain(SAP_NEXT_STEPS_H2);
    expect(block).toContain(sapLocalRecommendationHeading("Ben Hill, Atlanta"));
    expect(block).toContain("Product | Best for | Budget | Reason");
    expect(block).toContain("UNIFIED COPY FORMATTING");
    expect(block).not.toContain("The problem here —");
    expect(block).not.toContain("local market knowledge and how we serve businesses");
    assertNoHardcodedVerticals(SAP_LOCAL_RECOMMENDATION_TABLE_RULE);
    assertNoHardcodedVerticals(SAP_FORBIDDEN_UNSUBSTANTIATED_LOCAL_EXPERTISE);
  });

  it("recommendation table rule is vertical-agnostic and forbids invented prices", () => {
    expect(SAP_LOCAL_RECOMMENDATION_TABLE_RULE).toContain("Product | Best for | Budget | Reason");
    expect(SAP_LOCAL_RECOMMENDATION_TABLE_RULE).toContain("Quote; varies with");
    expect(SAP_LOCAL_RECOMMENDATION_TABLE_RULE).toContain("Forbidden: invented dollar ranges");
    expect(SAP_LOCAL_RECOMMENDATION_TABLE_RULE).toContain("Forbidden: hardcoded product lists from another trade");
    assertNoHardcodedVerticals(SAP_LOCAL_RECOMMENDATION_TABLE_RULE);
  });

  it("writer block and expertise ban do not hardcode a vertical", () => {
    const writer = formatSapPageWriterBlock("Sherwood Park, AB");
    expect(sapPageTemplateIsActive(writer)).toBe(true);
    expect(writer).toContain("UNIFIED COPY FORMATTING");
    expect(writer).toContain("1-2 short paragraphs plus the four-column table");
    expect(SAP_FORBIDDEN_UNSUBSTANTIATED_LOCAL_EXPERTISE).toContain("we understand");
    assertNoHardcodedVerticals(SAP_FORBIDDEN_UNSUBSTANTIATED_LOCAL_EXPERTISE);
    assertNoHardcodedVerticals(SAP_LOCAL_RECOMMENDATION_TABLE_RULE);
  });

  it("checklist example uses pinned titles and four columns", () => {
    const example = formatSapChecklistExample("Oldsmar", "Shades near Oldsmar");
    expect(example).toContain(ILLUSTRATIVE_DEFAULT_H2);
    expect(example).toContain(SAP_PROBLEM_H2);
    expect(example).toContain("scenario in body");
    expect(example).not.toContain("A realistic local situation");
    expect(example).not.toMatch(/The problem Oldsmar creates/i);
  });

  it("default optimizer outline matches pinned spine", () => {
    expect([...SAP_DEFAULT_COMBINED_OUTLINE]).toEqual([
      SAP_PROBLEM_H2,
      SAP_LOCAL_CONDITIONS_H2,
      SAP_OPTIONS_FIT_H2,
      ILLUSTRATIVE_DEFAULT_H2,
      SAP_WHAT_WE_OFFER_H2,
      "Our Recommendation for Homeowners in this area",
      SAP_NEXT_STEPS_H2,
    ]);
  });
});
