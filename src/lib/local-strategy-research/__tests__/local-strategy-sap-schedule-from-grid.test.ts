import { describe, expect, it } from "vitest";
import {
  buildLocalStrategyCompetitorGridSummaryMarkdown,
  buildLocalStrategySapKeywordTargets,
  buildLocalStrategySapKeywordTargetsFromProposalMatrix,
  buildWeightedKeywordPoolForSap,
  LOCAL_STRATEGY_SAP_SCHEDULE_TOTAL_ROWS,
  matchGridWeightForSapKeyword,
} from "@/lib/local-strategy-research/local-strategy-sap-schedule-from-grid";
import type {
  CompetitorResearchSemrushResponse,
  TieredCompetitorsResult,
} from "@/lib/competitor-research/types";

function minimalSemrush(overrides: Partial<CompetitorResearchSemrushResponse> = {}): CompetitorResearchSemrushResponse {
  return {
    seedDomain: "example.com",
    database: "dfs",
    dataSource: "dfs",
    rows: [
      {
        domain: "competitor.com",
        competitionLevel: 0,
        commonKeywords: 1,
        organicTraffic: 100,
        trafficCost: 1,
        organicKeywords: 50,
        adsKeywords: 0,
      },
    ],
    seedTopKeywords: [{ phrase: "window blinds", volume: 10, traffic: 1, position: 1 }],
    enrichmentByDomain: {
      "competitor.com": {
        topKeywords: [
          { phrase: "roller shades", volume: 5, traffic: 1, position: 2 },
          { phrase: "window blinds", volume: 5, traffic: 1, position: 3 },
        ],
      },
    },
    ...overrides,
  };
}

function minimalTiers(): TieredCompetitorsResult {
  return {
    summary: "test",
    tiers: [
      {
        tier: "high",
        label: "Direct competitors",
        competitors: [{ domain: "competitor.com", score: 90, rationale: "x" }],
      },
    ],
  };
}

describe("local-strategy-sap-schedule-from-grid", () => {
  it("buildLocalStrategyCompetitorGridSummaryMarkdown includes seed and tier", () => {
    const md = buildLocalStrategyCompetitorGridSummaryMarkdown({
      semrush: minimalSemrush(),
      tiers: minimalTiers(),
      geoLabel: "Georgia, United States",
    });
    expect(md).toContain("example.com");
    expect(md).toContain("Georgia");
    expect(md).toContain("competitor.com");
  });

  it("buildWeightedKeywordPoolForSap merges and sorts by weight", () => {
    const pool = buildWeightedKeywordPoolForSap({
      semrush: minimalSemrush(),
      tiers: minimalTiers(),
      selectedDomainKeys: new Set(["competitor.com"]),
    });
    expect(pool.length).toBeGreaterThan(0);
    expect(pool[0]!.weight).toBeGreaterThanOrEqual(pool[pool.length - 1]!.weight);
  });

  it("buildLocalStrategySapKeywordTargets sums to 45 SAP rows", () => {
    const targets = buildLocalStrategySapKeywordTargets({
      semrush: minimalSemrush(),
      tiers: minimalTiers(),
      selectedDomainKeys: new Set(["competitor.com"]),
      entityHint: "Test City, ST",
    });
    const sum = targets.reduce((s, t) => s + t.sapPages, 0);
    expect(sum).toBe(LOCAL_STRATEGY_SAP_SCHEDULE_TOTAL_ROWS);
    expect(targets.every((t) => t.sapPages >= 1)).toBe(true);
  });

  it("buildLocalStrategySapKeywordTargets respects custom targetTotal", () => {
    const customTotal = 30;
    const targets = buildLocalStrategySapKeywordTargets({
      semrush: minimalSemrush(),
      tiers: minimalTiers(),
      selectedDomainKeys: new Set(["competitor.com"]),
      entityHint: "Test City, ST",
      targetTotal: customTotal,
    });
    const sum = targets.reduce((s, t) => s + t.sapPages, 0);
    expect(sum).toBe(customTotal);
  });

  const MATRIX_SAMPLE = `### **Content Opportunity Matrix**

| Month | What to Produce | Anchor Demand | Why This Wins |
| --- | --- | --- | --- |
| M1 | Guide | emergency dental care, follow-up | a |
| M2 | Guide | teeth whitening | b |
| M3 | Guide | dental implants info | c |
`;

  it("buildLocalStrategySapKeywordTargetsFromProposalMatrix dedupes matrix keywords and sums to 45", () => {
    const targets = buildLocalStrategySapKeywordTargetsFromProposalMatrix({
      competitorReportMd: MATRIX_SAMPLE,
      gridKeywordWeights: [],
      placeHints: [],
      geoLabel: null,
      entityLocation: null,
    });
    const sum = targets.reduce((s, t) => s + t.sapPages, 0);
    expect(sum).toBe(LOCAL_STRATEGY_SAP_SCHEDULE_TOTAL_ROWS);
    const kws = [...new Set(targets.map((t) => t.keyword))];
    expect(kws.length).toBeGreaterThanOrEqual(2);
    expect(kws).toContain("emergency dental care");
  });

  it("matchGridWeightForSapKeyword boosts weight when grid phrase matches matrix keyword", () => {
    expect(
      matchGridWeightForSapKeyword("emergency dental care", [{ keyword: "emergency dental", weight: 8 }]),
    ).toBe(8);
    expect(matchGridWeightForSapKeyword("teeth whitening", [{ keyword: "unrelated service", weight: 5 }])).toBe(1);
  });

  it("buildLocalStrategySapKeywordTargetsFromProposalMatrix allocates more rows to higher grid weight", () => {
    const targets = buildLocalStrategySapKeywordTargetsFromProposalMatrix({
      competitorReportMd: MATRIX_SAMPLE,
      gridKeywordWeights: [{ keyword: "emergency dental", weight: 10 }],
      placeHints: [],
      geoLabel: null,
      entityLocation: null,
    });
    const byKw = Object.fromEntries(targets.map((t) => [t.keyword, t.sapPages] as const));
    const emergency = byKw["emergency dental care"] ?? 0;
    const teeth = byKw["teeth whitening"] ?? 0;
    expect(emergency + teeth).toBeLessThanOrEqual(LOCAL_STRATEGY_SAP_SCHEDULE_TOTAL_ROWS);
    expect(emergency).toBeGreaterThan(teeth);
  });

  it("buildLocalStrategySapKeywordTargetsFromProposalMatrix throws when matrix section is empty", () => {
    expect(() =>
      buildLocalStrategySapKeywordTargetsFromProposalMatrix({
        competitorReportMd: "## No matrix here\n\nHello.",
        gridKeywordWeights: [],
        placeHints: [],
        geoLabel: null,
        entityLocation: null,
      }),
    ).toThrow(/Content Opportunity Matrix/);
  });
});
