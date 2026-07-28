import { describe, expect, it } from "vitest";
import { buildDemandQueriesFromSeedKeywords, SEED_DEMAND_AS_GQ_DEFAULT_LIMIT } from "@/lib/competitor-research/competitor-seed-demand-as-gq";
import type { CompetitorKeywordRow } from "@/lib/competitor-research/types";

function row(partial: Partial<CompetitorKeywordRow> & { phrase: string }): CompetitorKeywordRow {
  return {
    phrase: partial.phrase,
    volume: partial.volume ?? null,
    traffic: partial.traffic ?? null,
    position: partial.position ?? null,
    ...partial,
  };
}

describe("buildDemandQueriesFromSeedKeywords", () => {
  it("maps phrase, volume, traffic, position into GscSiteQueryRow shape", () => {
    const out = buildDemandQueriesFromSeedKeywords([
      row({ phrase: "plumber austin", volume: 1000, traffic: 50, position: 12.3 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.query).toBe("plumber austin");
    expect(out[0]!.impressions).toBe(1000);
    expect(out[0]!.clicks).toBe(50);
    expect(out[0]!.ctr).toBeCloseTo(0.05, 5);
    expect(out[0]!.position).toBe(12.3);
  });

  it("sorts by traffic then volume then phrase (stable)", () => {
    const out = buildDemandQueriesFromSeedKeywords([
      row({ phrase: "b", volume: 100, traffic: 10 }),
      row({ phrase: "a", volume: 200, traffic: 5 }),
      row({ phrase: "c", volume: 50, traffic: 10 }),
    ]);
    expect(out.map((r) => r.query)).toEqual(["b", "c", "a"]);
  });

  it("respects limit", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      row({ phrase: `k${i}`, volume: i, traffic: i }),
    );
    const out = buildDemandQueriesFromSeedKeywords(rows, { limit: 5 });
    expect(out).toHaveLength(5);
  });

  it("caps at SEED_DEMAND_AS_GQ_DEFAULT_LIMIT by default", () => {
    const rows = Array.from({ length: SEED_DEMAND_AS_GQ_DEFAULT_LIMIT + 20 }, (_, i) =>
      row({ phrase: `k${i}`, volume: i + 1, traffic: i + 1 }),
    );
    const out = buildDemandQueriesFromSeedKeywords(rows);
    expect(out.length).toBe(SEED_DEMAND_AS_GQ_DEFAULT_LIMIT);
  });
});
