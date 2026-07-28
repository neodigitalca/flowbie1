import { COMPETITOR_BULK_CSV_TOTAL_POSTS } from "@/lib/competitor-research/competitor-bulk-content-csv";
import { describe, expect, it } from "vitest";
import {
  buildCompetitorReportWirePayload,
  buildSlimWirePayloadForStrategistSection3,
  computeTrafficPotentialPeerBenchmarks,
  REPORT_WIRE_RSN_MAX,
  type CompetitorReportWirePayload,
} from "@/lib/competitor-research/competitor-report-wire";
import type { CompetitorResearchSemrushResponse, TieredCompetitorsResult } from "@/lib/competitor-research/types";

const baseSemrush = (): CompetitorResearchSemrushResponse => ({
  seedDomain: "seed.com",
  database: "us",
  seedMetrics: {
    organicKeywords: 100,
    organicTraffic: 200,
    trafficCost: 999,
    adsKeywords: 50,
  },
  seedOverview: null,
  seedTopKeywords: [{ phrase: "a", volume: 1, traffic: 2, position: 3 }],
  rows: [
    {
      domain: "c.com",
      commonKeywords: 1,
      organicTraffic: 2,
      organicKeywords: 3,
      competitionLevel: 0.5,
      authorityScore: null,
      trafficCost: 888,
      adsKeywords: 77,
    },
  ],
  enrichmentByDomain: {
    "c.com": {
      topKeywords: [{ phrase: "kw", volume: 9, traffic: 8, position: 7 }],
    },
  },
  seedDomainOrganicCsv: "Keyword,Volume,Traffic,Position\na,1,2,3\n",
  domainOrganicCsvByDomain: {
    "c.com": "Keyword,Volume,Traffic,Position\nkw,9,8,7\n",
  },
  errors: [],
});

const baseTiers = (): TieredCompetitorsResult => ({
  summary: "s",
  tiers: [
    {
      tier: "high",
      label: "Direct",
      competitors: [
        {
          domain: "c.com",
          score: 0.9,
          rationale: "x".repeat(REPORT_WIRE_RSN_MAX + 40),
        },
      ],
    },
  ],
});

describe("buildCompetitorReportWirePayload", () => {
  it("drops paid-proxy fields from wire JSON shape (sm/sr only organic + authority)", () => {
    const w = buildCompetitorReportWirePayload({
      semrush: baseSemrush(),
      reportRows: baseSemrush().rows ?? [],
      seedTopKeywords: baseSemrush().seedTopKeywords ?? [],
      enrichmentByDomain: baseSemrush().enrichmentByDomain ?? {},
      tierAnalysis: baseTiers(),
      gscForReport: [],
      gscDateRange: null,
      clientLabel: null,
      reportCompetitorLimitNote: "limit",
      competitorKeywordSortNote: "sort",
      competitorSiteAlignmentNote: "align",
      reportLinkBudgetAssumptionFor3MonthTable: "budget",
    });
    const json = JSON.stringify(w);
    expect(json).not.toMatch(/trafficCost|adsKeywords/);
    expect(w.sm).toEqual({ OKw: 100, OTr: 200 });
    expect(w.sr[0]).toEqual(["c.com", 1, 2, 3, 0.5, null, null, null]);
    expect(w.ssc).toContain("Keyword,Volume,Traffic,Position");
    expect(w.scsv["c.com"] ?? w.scsv["c.com".toLowerCase()]).toContain("kw");
    expect(w.skM).toEqual([[]]);
    expect(w.ekrM).toEqual([[]]);
    expect(w.dm).toEqual(["c.com"]);
    expect(w.tp.kwR).toBe(2);
    expect(w.tp.sTr).toBe(10);
    expect(w.tp.sVol).toBe(10);
    expect(w.tp.Pt).toBe(COMPETITOR_BULK_CSV_TOTAL_POSTS);
    expect(w.tp.avgCompOTr).toBe(2);
    expect(w.tp.nCompOTr).toBe(1);
    expect(w.tp.seedOTr).toBe(200);
    expect(w.tp.gapTr).toBe(0);
    expect(w.tp.rM).toEqual([5, 9]);
    expect(w.tp.rS).toEqual([9, 18]);
    expect(w.tp.rD).toEqual([18, 30]);
    expect(w.tp.N.length).toBeGreaterThan(20);
  });

  it("flattens enrichment to ekr with domain index in column 0 and dm list", () => {
    const w = buildCompetitorReportWirePayload({
      semrush: baseSemrush(),
      reportRows: baseSemrush().rows ?? [],
      seedTopKeywords: [],
      enrichmentByDomain: baseSemrush().enrichmentByDomain ?? {},
      tierAnalysis: baseTiers(),
      gscForReport: [],
      gscDateRange: null,
      clientLabel: null,
      reportCompetitorLimitNote: "limit",
      competitorKeywordSortNote: "sort",
      competitorSiteAlignmentNote: "align",
      reportLinkBudgetAssumptionFor3MonthTable: "budget",
    });
    expect(w.dm).toEqual(["c.com"]);
    expect(w.ekr).toEqual([[0, "kw", 9, 8, 7]]);
    expect(w.ekc).toEqual(["Dom", "Kw", "Vol", "Tr", "Pos"]);
  });

  it("caps tier rationale length", () => {
    const w = buildCompetitorReportWirePayload({
      semrush: baseSemrush(),
      reportRows: baseSemrush().rows ?? [],
      seedTopKeywords: [],
      enrichmentByDomain: {},
      tierAnalysis: baseTiers(),
      gscForReport: [],
      gscDateRange: null,
      clientLabel: null,
      reportCompetitorLimitNote: "limit",
      competitorKeywordSortNote: "sort",
      competitorSiteAlignmentNote: "align",
      reportLinkBudgetAssumptionFor3MonthTable: "budget",
    });
    const rsn = w.ta.ti[0].Comps[0][2];
    expect(rsn.length).toBeLessThanOrEqual(REPORT_WIRE_RSN_MAX);
    expect(rsn.endsWith("…")).toBe(true);
  });
});

describe("computeTrafficPotentialPeerBenchmarks", () => {
  it("scales tier ranges from gapTr when seed is below peer average", () => {
    const sr: CompetitorReportWirePayload["sr"] = [
      ["a.com", 1, 1000, 10, 0, null, null, null],
      ["b.com", 1, 3000, 10, 0, null, null, null],
    ];
    const p = computeTrafficPotentialPeerBenchmarks({
      sr,
      seedOTr: 500,
      sTr: 100,
    });
    expect(p.avgCompOTr).toBe(2000);
    expect(p.nCompOTr).toBe(2);
    expect(p.gapTr).toBe(1500);
    expect(p.rM).toEqual([180, 330]);
    expect(p.rS).toEqual([330, 675]);
    expect(p.rD).toEqual([675, 1125]);
  });
});

describe("buildSlimWirePayloadForStrategistSection3", () => {
  it("drops ekr/ssc/scsv/n/err and keeps tp sk sr ta gq for strategist section 4 (Estimated Traffic)", () => {
    const w = buildCompetitorReportWirePayload({
      semrush: baseSemrush(),
      reportRows: baseSemrush().rows ?? [],
      seedTopKeywords: baseSemrush().seedTopKeywords ?? [],
      enrichmentByDomain: baseSemrush().enrichmentByDomain ?? {},
      tierAnalysis: baseTiers(),
      gscForReport: [],
      gscDateRange: null,
      clientLabel: null,
      reportCompetitorLimitNote: "limit",
      competitorKeywordSortNote: "sort",
      competitorSiteAlignmentNote: "align",
      reportLinkBudgetAssumptionFor3MonthTable: "budget",
    });
    const slim = buildSlimWirePayloadForStrategistSection3(w as unknown as Record<string, unknown>);
    expect(slim).not.toHaveProperty("ekr");
    expect(slim).not.toHaveProperty("ssc");
    expect(slim).not.toHaveProperty("scsv");
    expect(slim).not.toHaveProperty("n");
    expect(slim).not.toHaveProperty("err");
    expect(slim.tp).toEqual(w.tp);
    expect(slim.sk).toEqual(w.sk);
    expect(slim.sr).toEqual(w.sr);
    expect(slim.ta).toBeDefined();
  });
});
