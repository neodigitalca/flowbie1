import { describe, expect, it } from "vitest";
import {
  hasUsablePageGsc,
  hasSubstantiveSeoResearchBrief,
  mergeOptimizeResearchInputs,
  buildOptimizeSelectionsFromStoredBrief,
  parseSeoResearchBrief,
  llmAuditSummaryFromSeoResearchBrief,
} from "../seo-research-brief-for-optimize";
import { sapSelectedH2OutlineTitles } from "@/lib/prompt-builders/sap-page-template";

describe("seo-research-brief-for-optimize", () => {
  const briefJson = JSON.stringify({
    version: 1,
    focusKeyword: "blinds edmonton",
    pageUrl: "https://example.com/blinds/",
    dataforseo: {
      peopleAlsoAsk: [{ question: "How much do blinds cost?", answers: [{ description: "Varies" }] }],
      relatedSearches: ["custom blinds"],
      peopleAlsoSearchPhrases: [],
    },
    gsc: { queries: ["blinds near me"] },
  });

  it("hasUsablePageGsc requires query rows with traffic", () => {
    expect(hasUsablePageGsc({ queries: [] })).toBe(false);
    expect(
      hasUsablePageGsc({
        queries: [{ query: "kw", clicks: 0, impressions: 0 }],
      }),
    ).toBe(false);
    expect(
      hasUsablePageGsc({
        queries: [{ query: "kw", clicks: 1, impressions: 0 }],
      }),
    ).toBe(true);
  });

  it("mergeOptimizeResearchInputs combines page GSC and SERP brief", () => {
    const merged = mergeOptimizeResearchInputs({
      primaryKeyword: "blinds edmonton",
      selectedKeyword: { query: "blinds edmonton", clicks: 0, impressions: 0, ctr: 0, position: 0 },
      gscResult: {
        queries: [
          { query: "high clicks", clicks: 10, impressions: 100 },
          { query: "low clicks", clicks: 1, impressions: 5 },
        ],
      },
      seoResearchBrief: briefJson,
    });

    expect(merged.keywordData.keyword).toBe("blinds edmonton");
    expect(merged.relatedGSCKeywords[0]).toBe("high clicks");
    expect(merged.relatedGSCKeywords).toContain("custom blinds");
    expect(merged.relatedGSCKeywords).toContain("blinds near me");
    expect(merged.paaItems[0]?.question).toBe("How much do blinds cost?");
    expect(merged.useCachedResearchOnly).toBe(true);
  });

  it("SERP-only when no page GSC", () => {
    const merged = mergeOptimizeResearchInputs({
      primaryKeyword: "blinds edmonton",
      selectedKeyword: { query: "blinds edmonton", clicks: 0, impressions: 0, ctr: 0, position: 0 },
      gscResult: { queries: [] },
      seoResearchBrief: briefJson,
    });

    expect(merged.relatedGSCKeywords).toContain("custom blinds");
    expect(merged.relatedGSCKeywords).not.toContain("high clicks");
    expect(merged.paaItems.length).toBe(1);
  });

  it("parseSeoResearchBrief returns null for invalid JSON", () => {
    expect(parseSeoResearchBrief("not json")).toBeNull();
    expect(parseSeoResearchBrief(briefJson)?.focusKeyword).toBe("blinds edmonton");
  });

  it("hasSubstantiveSeoResearchBrief requires valid brief JSON", () => {
    expect(hasSubstantiveSeoResearchBrief(briefJson)).toBe(true);
    expect(hasSubstantiveSeoResearchBrief("SWOT prose markdown brief")).toBe(false);
    expect(hasSubstantiveSeoResearchBrief("{}")).toBe(false);
  });

  it("buildOptimizeSelectionsFromStoredBrief omits live page H2s for non-SAP optimize", () => {
    const out = buildOptimizeSelectionsFromStoredBrief({
      primaryKeyword: "solar panel costs",
      selectedKeyword: { query: "solar panel costs", clicks: 0, impressions: 0, ctr: 0, position: 0 },
      gscResult: { queries: [] },
      seoResearchBrief: briefJson,
    });
    expect(out.selectedH2Sections).toEqual([]);
    expect(out.selectedPeopleAlsoAsk[0]).toBe("How much do blinds cost?");
    expect(out.paaRawResponse).toBeNull();
  });

  it("buildOptimizeSelectionsFromStoredBrief uses SAP template outline when sapEntity is set", () => {
    const entity = "Virginia Park, AB";
    const out = buildOptimizeSelectionsFromStoredBrief({
      primaryKeyword: "blinds",
      selectedKeyword: { query: "blinds", clicks: 0, impressions: 0, ctr: 0, position: 0 },
      gscResult: { queries: [] },
      seoResearchBrief: briefJson,
      sapEntity: entity,
    });
    expect(out.selectedH2Sections).toEqual(sapSelectedH2OutlineTitles(entity));
    expect(out.selectedH2Sections).not.toContain("Your Guide to Blinds");
  });

  it("llmAuditSummaryFromSeoResearchBrief extracts platform facts", () => {
    const withAudit = JSON.stringify({
      version: 1,
      llmAudit: {
        siteUrl: "https://example.com",
        location: "Edmonton, AB",
        platforms: [
          {
            platform: "chat_gpt",
            label: "ChatGPT",
            model_name: "o4-mini",
            status: "ok",
            responseText: "Locals call Whyte Avenue the strip.",
          },
        ],
      },
    });
    expect(llmAuditSummaryFromSeoResearchBrief(withAudit)).toContain("the strip");
    expect(llmAuditSummaryFromSeoResearchBrief("{}")).toBe("");
  });
});
