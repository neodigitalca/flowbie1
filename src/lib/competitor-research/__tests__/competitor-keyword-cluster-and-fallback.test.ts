import { describe, expect, it } from "vitest";
import {
  isSemrushClusteredForReportDomains,
  validateClusterPicksAgainstInput,
} from "@/lib/competitor-research/competitor-keyword-cluster-openrouter";
import {
  diversifyKeywordsGreedy,
  keywordPhraseJaccard,
  MAX_CLUSTER_REPRESENTATIVES,
} from "@/lib/competitor-research/competitor-keyword-diversify-fallback";
import type { CompetitorKeywordRow, CompetitorResearchSemrushResponse } from "@/lib/competitor-research/types";

describe("keywordPhraseJaccard", () => {
  it("returns 1 for identical token sets", () => {
    expect(keywordPhraseJaccard("a b", "b a")).toBe(1);
  });
  it("returns 0 for disjoint sets", () => {
    expect(keywordPhraseJaccard("a b", "c d")).toBe(0);
  });
});

describe("diversifyKeywordsGreedy", () => {
  const rows: CompetitorKeywordRow[] = [
    { phrase: "how to fix bit lip", volume: 100, traffic: 50, position: 1 },
    { phrase: "how to fix a bitten lip", volume: 90, traffic: 45, position: 2 },
    { phrase: "dental implants cost", volume: 200, traffic: 30, position: 3 },
  ];

  it("keeps output within max representatives and only uses input phrases", () => {
    const out = diversifyKeywordsGreedy(rows, 10);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.length).toBeLessThanOrEqual(MAX_CLUSTER_REPRESENTATIVES);
    const phrases = new Set(rows.map((r) => r.phrase));
    for (const r of out) {
      expect(phrases.has(r.phrase)).toBe(true);
    }
  });

  it("skips near-duplicate high-traffic rows when a distinct intent exists", () => {
    const dup: CompetitorKeywordRow[] = [
      { phrase: "bit lip healing", volume: 500, traffic: 100, position: 1 },
      { phrase: "bit lip heal", volume: 400, traffic: 90, position: 2 },
      { phrase: "tooth extraction aftercare", volume: 50, traffic: 5, position: 10 },
    ];
    const out = diversifyKeywordsGreedy(dup, 3, 0.55);
    const ph = out.map((r) => r.phrase);
    expect(ph).toContain("bit lip healing");
    expect(ph).toContain("tooth extraction aftercare");
  });

  it("prefers a Semrush row that does not overlap excludePhrases (e.g. GSC coverage)", () => {
    const rows: CompetitorKeywordRow[] = [
      { phrase: "emergency dental repair", volume: 500, traffic: 100, position: 1 },
      { phrase: "best ceramic veneers pricing", volume: 400, traffic: 90, position: 2 },
    ];
    const out = diversifyKeywordsGreedy(rows, 1, 0.55, ["emergency dental"]);
    expect(out).toHaveLength(1);
    expect(out[0].phrase).toBe("best ceramic veneers pricing");
  });
});

describe("validateClusterPicksAgainstInput", () => {
  const allowed: CompetitorKeywordRow[] = [
    { phrase: "foo bar", volume: 1, traffic: 2, position: 3 },
  ];

  it("uses canonical metrics from allowed", () => {
    const picks: CompetitorKeywordRow[] = [{ phrase: "foo bar", volume: 99, traffic: 99, position: 99 }];
    expect(validateClusterPicksAgainstInput(picks, allowed, 10)).toEqual([allowed[0]]);
  });

  it("drops phrases not in allowed", () => {
    expect(
      validateClusterPicksAgainstInput(
        [{ phrase: "nope", volume: 1, traffic: 1, position: 1 }],
        allowed,
        10,
      ),
    ).toEqual([]);
  });
});

describe("isSemrushClusteredForReportDomains", () => {
  const base = (): CompetitorResearchSemrushResponse => ({
    seedDomain: "a.com",
    database: "us",
    rows: [{ domain: "b.com", competitionLevel: null, commonKeywords: null, organicTraffic: null, trafficCost: null, organicKeywords: null, adsKeywords: null }],
    seedTopKeywords: [{ phrase: "x", volume: 1, traffic: 1, position: 1, clusterMembers: ["x"] }],
    enrichmentByDomain: {
      "b.com": {
        topKeywords: [{ phrase: "y", volume: 1, traffic: 1, position: 1, clusterMembers: ["y"] }],
      },
    },
  });

  it("returns true when seed and selected competitors have clusterMembers on all rows", () => {
    const s = base();
    expect(isSemrushClusteredForReportDomains(s, new Set(["b.com"]))).toBe(true);
  });

  it("returns false when seed rows lack clusterMembers", () => {
    const s = base();
    s.seedTopKeywords = [{ phrase: "x", volume: 1, traffic: 1, position: 1 }];
    expect(isSemrushClusteredForReportDomains(s, new Set(["b.com"]))).toBe(false);
  });
});
