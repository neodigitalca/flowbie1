import { describe, expect, it } from "vitest";
import { defaultAdsSectionsFromPayload, parseAdsReportingOutlineJson } from "@/lib/ads-reporting/ads-reporting-outline";

describe("defaultAdsSectionsFromPayload", () => {
  it("returns the five PPC sections", () => {
    const sections = defaultAdsSectionsFromPayload("mom");
    expect(sections.map((s) => s.kind)).toEqual([
      "executive_summary",
      "ad_performance_period",
      "key_performance_insights",
      "campaign_performance",
      "search_terms",
    ]);
    expect(sections[1]?.h2Title).toBe("Ad Performance Compared Month Over Month");
  });

  it("uses YoY heading when compare kind is yoy", () => {
    expect(defaultAdsSectionsFromPayload("yoy")[1]?.h2Title).toBe("Ad Performance Compared Year Over Year");
  });
});

describe("parseAdsReportingOutlineJson", () => {
  it("replaces model sections with the fixed list", () => {
    const outline = parseAdsReportingOutlineJson(
      JSON.stringify({
        executiveSummary: "Spend rose in August.",
        topOpportunities: [{ rank: 1, label: "Brand", why: "CPA held", metrics: "Spend +12%" }],
        sections: [{ id: "invented" }],
      }),
      "mom",
    );
    expect(outline.executiveSummary).toBe("Spend rose in August.");
    expect(outline.sections).toHaveLength(5);
    expect(outline.sections[0]?.kind).toBe("executive_summary");
  });
});
