import { describe, expect, it } from "vitest";
import {
  buildQueryClustersMarkdownForPipeline,
  computeGscQueryClusterTotals,
  GSC_QUERY_CLUSTER_MAX_QUERIES_IN_MARKDOWN,
  parseClusterJsonFromModelContent,
} from "@/lib/gsc-reporting/gsc-query-cluster-ai";
import type { GscParsedQueryRow } from "@/lib/gsc-export-csv-parse";

function row(partial: Partial<GscParsedQueryRow> & Pick<GscParsedQueryRow, "query">): GscParsedQueryRow {
  return {
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
    date: "",
    ...partial,
  };
}

describe("computeGscQueryClusterTotals", () => {
  it("sums clicks and impressions and derives CTR", () => {
    const t = computeGscQueryClusterTotals([
      row({ query: "a", clicks: 10, impressions: 100, ctr: 0.1, position: 5 }),
      row({ query: "b", clicks: 5, impressions: 50, ctr: 0.1, position: 8 }),
    ]);
    expect(t.clicks).toBe(15);
    expect(t.impressions).toBe(150);
    expect(t.ctr).toBeCloseTo(15 / 150);
  });

  it("weights position by impressions", () => {
    const t = computeGscQueryClusterTotals([
      row({ query: "a", clicks: 0, impressions: 10, ctr: 0, position: 2 }),
      row({ query: "b", clicks: 0, impressions: 90, ctr: 0, position: 4 }),
    ]);
    expect(t.positionWeighted).toBeCloseTo((2 * 10 + 4 * 90) / 100);
  });
});

describe("parseClusterJsonFromModelContent", () => {
  it("parses fenced JSON", () => {
    const raw = 'Here you go:\n```json\n{"clusters":[{"name":"A","indices":[0]}]}\n```';
    const j = parseClusterJsonFromModelContent(raw) as { clusters?: unknown };
    expect(j.clusters).toHaveLength(1);
  });

  it("parses prose before first balanced object", () => {
    const raw = 'Sure! {"clusters":[{"name":"Brand","indices":[0,1]},]}';
    const j = parseClusterJsonFromModelContent(raw) as { clusters?: unknown };
    expect(Array.isArray(j.clusters)).toBe(true);
    expect((j.clusters as { name: string }[])[0]!.name).toBe("Brand");
  });

  it("returns null for non-JSON", () => {
    expect(parseClusterJsonFromModelContent("no braces")).toBeNull();
  });
});

describe("buildQueryClustersMarkdownForPipeline", () => {
  it("lists at most GSC_QUERY_CLUSTER_MAX_QUERIES_IN_MARKDOWN queries per cluster", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      row({ query: `q${i}`, impressions: i + 1, position: 10 }),
    );
    const totals = computeGscQueryClusterTotals(many);
    const md = buildQueryClustersMarkdownForPipeline([{ name: "Test cluster", rows: many, totals }]);
    expect(md).toMatch(/plus \d+ more queries/);
    const line = md.split("\n").find((l) => l.includes("Top queries in cluster"));
    expect(line).toBeDefined();
    const listed = (line!.match(/q\d+/g) ?? []).length;
    expect(listed).toBeLessThanOrEqual(GSC_QUERY_CLUSTER_MAX_QUERIES_IN_MARKDOWN);
  });
});
