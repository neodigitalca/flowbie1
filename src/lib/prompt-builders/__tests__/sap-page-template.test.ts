import { describe, expect, it } from "vitest";
import {
  formatSapChecklistExample,
  formatSapPageChecklistBlock,
  formatSapPageWriterBlock,
  sapPageTemplateIsActive,
  SAP_FORBIDDEN_UNSUBSTANTIATED_LOCAL_EXPERTISE,
  SAP_LOCAL_RECOMMENDATION_TABLE_RULE,
} from "@/lib/prompt-builders/sap-page-template";

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

const PINNED_TITLES = [
  "Sunlight And Privacy Challenges",
  "Local Conditions That Change The Job",
  "Options That Fit Local Conditions",
  "Our Recommendation for Homeowners",
];

function assertNoHardcodedVerticals(text: string) {
  for (const banned of HARDCODED_VERTICALS) {
    expect(text).not.toContain(banned);
  }
}

describe("sap-page-template", () => {
  it("checklist spine describes seven jobs without pinning H2 titles", () => {
    const block = formatSapPageChecklistBlock("Ben Hill, Atlanta");
    expect(block).toContain("SAP PAGE TEMPLATE");
    expect(block).toContain("Do NOT emit encyclopedia how-it-works");
    expect(block).toContain("Do not pin any H2");
    expect(block).toContain("UNIQUE DYNAMIC BODY H2s");
    expect(block).toContain("Product | Best for | Budget | Reason");
    expect(block).toContain("UNIFIED COPY FORMATTING");
    expect(block).toContain("Ben Hill, Atlanta");
    expect(block).not.toContain("The problem here —");
    expect(block).not.toContain("local market knowledge and how we serve businesses");
    expect(block).not.toContain("MANDATORY exact H2 title");
    expect(block).not.toContain("The only forced body title is A Local Homeowner Example");
    for (const pinned of PINNED_TITLES) {
      expect(block).not.toContain(pinned);
    }
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

  it("checklist example names jobs, not pinned titles", () => {
    const example = formatSapChecklistExample("Oldsmar", "Shades near Oldsmar");
    expect(example).toContain("Local problem for this trade in Oldsmar");
    expect(example).toContain("Unique topical H2 for the one worked example");
    expect(example).toContain("scenario in body");
    expect(example).not.toContain("A realistic local situation");
    expect(example).not.toContain("Sunlight And Privacy Challenges");
    expect(example).not.toMatch(/The problem Oldsmar creates/i);
  });
});
