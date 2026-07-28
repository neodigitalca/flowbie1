import { describe, expect, it } from "vitest";
import {
  GSC_CSV_TABLE_DISPLAY_MAX_ROWS,
  mergeDedupeGscQueriesByMaxImpressions,
  parseCsvGridForDisplay,
  parseGscCtr,
  parseGscQueriesCsv,
} from "@/lib/gsc-export-csv-parse";

describe("parseGscCtr", () => {
  it("parses decimal 0–1", () => {
    expect(parseGscCtr(0.052)).toBeCloseTo(0.052);
  });
  it("parses percent string", () => {
    expect(parseGscCtr("5.2%")).toBeCloseTo(0.052);
  });
  it("parses whole percent number", () => {
    expect(parseGscCtr(5.2)).toBeCloseTo(0.052);
  });
});

describe("parseGscQueriesCsv", () => {
  it("parses standard GSC Queries export with comment line", () => {
    const csv = `# Google Search Console
Query,Clicks,Impressions,CTR,Position
widget repair,10,500,2%,3.5
blue widgets,5,200,2.5%,8.1
`;
    const r = parseGscQueriesCsv(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].query).toBe("widget repair");
    expect(r.rows[0].clicks).toBe(10);
    expect(r.rows[0].impressions).toBe(500);
    expect(r.rows[0].ctr).toBeCloseTo(0.02);
    expect(r.rows[0].position).toBeCloseTo(3.5);
  });

  it("fails without Query column", () => {
    const r = parseGscQueriesCsv("Foo,Bar\n1,2");
    expect(r.ok).toBe(false);
  });

  it("parses Queries-MoM export using period A columns for clustering (First | Last | Change per metric)", () => {
    const csv = `Query,Clicks (Mar 2026),Clicks (Feb 2026),Clicks Δ%,Impressions (Mar 2026),Impressions (Feb 2026),Impr Δ%,CTR (Mar 2026),CTR (Feb 2026),CTR Δ%,Position (Mar 2026),Position (Feb 2026),Pos Δ%
foo,10,8,+25.0%,100,80,+25.0%,10.00%,8.00%,+25.0%,2.50,3.00,-16.7%
`;
    const r = parseGscQueriesCsv(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].query).toBe("foo");
    expect(r.rows[0].clicks).toBe(10);
    expect(r.rows[0].impressions).toBe(100);
    expect(r.rows[0].ctr).toBeCloseTo(0.1);
    expect(r.rows[0].position).toBeCloseTo(2.5);
  });

  it("still accepts legacy MoM column names with (primary) suffix", () => {
    const csv = `Query,Clicks (primary),Clicks (compare),Clicks Δ%,Impressions (primary),Impressions (compare),Impr Δ%,CTR (primary),CTR (compare),CTR Δ%,Position (primary),Position (compare),Pos Δ%
foo,10,8,+25.0%,100,80,+25.0%,10.00%,8.00%,+25.0%,2.50,3.00,+20.0%
`;
    const r = parseGscQueriesCsv(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0].clicks).toBe(10);
  });
});

describe("parseCsvGridForDisplay", () => {
  it("strips leading # lines and parses header + rows", () => {
    const csv = `# export
Query,Clicks
a,1
b,2
`;
    const r = parseCsvGridForDisplay(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.headers).toEqual(["Query", "Clicks"]);
    expect(r.rows).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
    expect(r.totalDataRows).toBe(2);
    expect(r.truncated).toBe(false);
  });

  it("strips UTF-8 BOM", () => {
    const csv = "\uFEFFOne,Two\nx,y\n";
    const r = parseCsvGridForDisplay(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.headers[0]).toBe("One");
    expect(r.rows[0]).toEqual(["x", "y"]);
  });

  it("marks truncated when row count exceeds display cap", () => {
    const header = "A,B\n";
    const row = "0,0\n";
    const n = GSC_CSV_TABLE_DISPLAY_MAX_ROWS + 50;
    const body = header + row.repeat(n);
    const r = parseCsvGridForDisplay(body);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totalDataRows).toBe(n);
    expect(r.truncated).toBe(true);
    expect(r.rows).toHaveLength(GSC_CSV_TABLE_DISPLAY_MAX_ROWS);
  });
});

describe("mergeDedupeGscQueriesByMaxImpressions", () => {
  it("keeps higher impressions", () => {
    const merged = mergeDedupeGscQueriesByMaxImpressions([
      { query: "a", clicks: 1, impressions: 10, ctr: 0.1, position: 5, date: "" },
      { query: "A", clicks: 2, impressions: 50, ctr: 0.1, position: 4, date: "" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].impressions).toBe(50);
  });
});
