import { describe, expect, it } from "vitest";
import {
  dedupeKeywordRowsForClustering,
  repairClustersToCanonicalPartition,
} from "@/lib/competitor-research/competitor-keyword-cluster-openrouter";
import type { CompetitorKeywordRow } from "@/lib/competitor-research/types";

describe("dedupeKeywordRowsForClustering", () => {
  it("merges rows that share the same normalized phrase", () => {
    const rows: CompetitorKeywordRow[] = [
      { phrase: "dental implants", volume: 100, traffic: 50, position: 5 },
      { phrase: "  Dental Implants ", volume: 50, traffic: 30, position: 3 },
    ];
    const out = dedupeKeywordRowsForClustering(rows);
    expect(out).toHaveLength(1);
    expect(out[0].phrase).toBe("dental implants");
    expect(out[0].volume).toBe(150);
    expect(out[0].traffic).toBe(80);
    expect(out[0].position).toBe(3);
  });

  it("keeps distinct phrases separate", () => {
    const rows: CompetitorKeywordRow[] = [
      { phrase: "invisalign", volume: 10, traffic: 5, position: 1 },
      { phrase: "braces", volume: 20, traffic: 8, position: 2 },
    ];
    const out = dedupeKeywordRowsForClustering(rows);
    expect(out).toHaveLength(2);
  });
});

describe("repairClustersToCanonicalPartition", () => {
  const rows: CompetitorKeywordRow[] = [
    { phrase: "dental implants edmonton", volume: 1, traffic: 1, position: 1 },
    { phrase: "invisalign cost", volume: 2, traffic: 2, position: 2 },
  ];

  it("aligns model members to canonical phrases by normalized match", () => {
    const out = repairClustersToCanonicalPartition(
      [{ label: "Implants", members: ["  DENTAL implants Edmonton  ", "invisalign cost"] }],
      rows,
    );
    expect(out).toHaveLength(1);
    expect(out[0].members.sort()).toEqual(["dental implants edmonton", "invisalign cost"].sort());
  });

  it("adds missing INPUT phrases as singleton clusters", () => {
    const out = repairClustersToCanonicalPartition([{ label: "Only", members: ["dental implants edmonton"] }], rows);
    expect(out.length).toBeGreaterThanOrEqual(2);
    const all = new Set(out.flatMap((c) => c.members));
    expect(all.has("dental implants edmonton")).toBe(true);
    expect(all.has("invisalign cost")).toBe(true);
  });

  it("covers empty model output with one cluster per phrase", () => {
    const out = repairClustersToCanonicalPartition([], rows);
    expect(out.length).toBe(2);
    expect(out.flatMap((c) => c.members).sort()).toEqual(["dental implants edmonton", "invisalign cost"].sort());
  });
});
