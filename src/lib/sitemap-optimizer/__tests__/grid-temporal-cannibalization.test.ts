import { describe, expect, it } from "vitest";
import type { TemporalCannibalizationExemptResult } from "@/lib/sitemap-optimizer/grid-temporal-cannibalization-agent";
import { parseGridTemporalCannibalizationJson } from "@/lib/sitemap-optimizer/grid-temporal-cannibalization-parse";
import { clusterRedirectMapForFamilies } from "@/lib/sitemap-optimizer/grid-prefilled-group-cluster";
import { buildDeterministicGridBriefs } from "@/lib/sitemap-optimizer/grid-deterministic-brief";
import { applyGridOutputPolicies } from "@/lib/sitemap-optimizer/grid-output-policies";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function redirectRow(args: {
  id: string;
  oldUrl: string;
  newUrl: string;
  title: string;
  uploadRowIndex: number;
}): SitemapOptimizerPostRow {
  return {
    postId: args.id,
    url: args.newUrl,
    gridRedirectFromUrl: args.oldUrl,
    uploadRowIndex: args.uploadRowIndex,
    collection: "posts",
    title: args.title,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
  };
}

function interestRateTemporalExempt(
  rows: readonly SitemapOptimizerPostRow[],
): TemporalCannibalizationExemptResult {
  const sorted = [...rows].sort((a, b) => (a.uploadRowIndex ?? 0) - (b.uploadRowIndex ?? 0));
  return {
    clusters: [
      {
        clusterId: "grid-temporal-1",
        label: "Canadian interest rates",
        intent: "mixed",
        memberPostIds: sorted.map((r) => r.postId),
        confidence: "high",
        rationale: "7 time-sliced URLs — one live pillar (temporal cannibalization exempt).",
        temporalPillarSlugStem: "canadian-interest-rates",
        temporalSectionHeaders: sorted.map((r) => r.title ?? "Period update"),
      },
    ],
    exemptPostIds: new Set(sorted.map((r) => r.postId)),
  };
}

describe("temporal cannibalization (AI-driven groups)", () => {
  it("returns empty groups when model response has no JSON", () => {
    expect(parseGridTemporalCannibalizationJson("")).toEqual([]);
    expect(parseGridTemporalCannibalizationJson("Sorry, I cannot help.")).toEqual([]);
    expect(parseGridTemporalCannibalizationJson("{not valid json")).toEqual([]);
  });

  it("parses Gemini temporal group JSON", () => {
    const parsed = parseGridTemporalCannibalizationJson(
      JSON.stringify({
        temporalGroups: [
          {
            groupId: "interest_rates",
            label: "Canadian interest rates",
            memberPostIds: ["wp:1", "wp:2"],
            pillarSlugStem: "canadian-interest-rates",
            sectionHeaders: ["Q2 2024 update", "Q3 2024 update"],
          },
        ],
      }),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.pillarSlugStem).toBe("canadian-interest-rates");
    expect(parsed[0]?.memberPostIds).toEqual(["wp:1", "wp:2"]);
  });

  it("merges quarterly interest URLs into one cluster when AI groups them", () => {
    const rows = [1, 2, 3, 4].map((q) =>
      redirectRow({
        id: `wp:q${q}`,
        oldUrl: `https://www.kwbllp.com/2026/0${q}/canadian-interest-rates-q${q}-2026/`,
        newUrl: `https://www.kwbllp.com/blog/cra-prescribed-interest-rate${q === 1 ? "-q1" : q === 2 ? "" : `-q${q}`}/`,
        title: `Canadian Interest Rates Q${q} 2026`,
        uploadRowIndex: q,
      }),
    );

    const { clusters } = clusterRedirectMapForFamilies(rows, 5, interestRateTemporalExempt(rows));
    const interestClusters = clusters.clusters.filter((c) =>
      c.clusterId.startsWith("grid-temporal-"),
    );
    expect(interestClusters).toHaveLength(1);
    expect(interestClusters[0]?.memberPostIds).toHaveLength(4);
  });

  it("produces one content sheet row for temporal pillar after policies", () => {
    const rows = [
      redirectRow({
        id: "wp:1",
        oldUrl: "https://www.kwbllp.com/2026/03/03/canadian-interest-rates-q2-2026/",
        newUrl: "https://www.kwbllp.com/blog/cra-prescribed-interest-rate/",
        title: "Canadian Interest Rates Q2 2026",
        uploadRowIndex: 1,
      }),
      redirectRow({
        id: "wp:2",
        oldUrl: "https://www.kwbllp.com/2025/11/27/canadian-interest-rates-q1-2026/",
        newUrl: "https://www.kwbllp.com/blog/cra-prescribed-interest-rate-q1/",
        title: "Canadian Interest Rates Q1 2026",
        uploadRowIndex: 2,
      }),
    ];

    const temporalExempt = interestRateTemporalExempt(rows);
    const { clusters, rows: clusteredRows } = clusterRedirectMapForFamilies(
      rows,
      5,
      temporalExempt,
    );
    const merges = buildDeterministicGridBriefs(clusters.clusters, clusteredRows);
    const policies = applyGridOutputPolicies({
      rows: clusteredRows,
      clusters,
      merges,
      gridMaxUrlsPerPost: 5,
      analyzedAt: "2026-06-01T00:00:00.000Z",
    });

    expect(policies.clusters.clusters).toHaveLength(1);
    expect(policies.contentSheet).toHaveLength(1);
    expect(new Set(policies.rows.map((r) => r.url.trim())).size).toBe(1);
    expect(policies.merges[0]?.lockedDestinationUrl).toContain("canadian-interest-rates-2026");
  });

  it("1:1 Basic keeps temporal cluster and unified pillar destination", () => {
    const rows = [1, 2, 3, 4].map((q) =>
      redirectRow({
        id: `wp:q${q}`,
        oldUrl: `https://www.kwbllp.com/2026/0${q}/canadian-interest-rates-q${q}-2026/`,
        newUrl: `https://www.kwbllp.com/blog/cra-prescribed-interest-rate${q === 1 ? "-q1" : q === 2 ? "" : `-q${q}`}/`,
        title: `Canadian Interest Rates Q${q} 2026`,
        uploadRowIndex: q,
      }),
    );

    const temporalExempt = interestRateTemporalExempt(rows);
    const { clusters, rows: clusteredRows } = clusterRedirectMapForFamilies(
      rows,
      1,
      temporalExempt,
    );
    expect(clusters.clusters.filter((c) => c.clusterId.startsWith("grid-temporal-"))).toHaveLength(
      1,
    );

    const merges = buildDeterministicGridBriefs(clusters.clusters, clusteredRows);
    const policies = applyGridOutputPolicies({
      rows: clusteredRows,
      clusters,
      merges,
      gridMaxUrlsPerPost: 1,
      analyzedAt: "2026-06-01T00:00:00.000Z",
    });

    expect(policies.clusters.clusters).toHaveLength(1);
    expect(new Set(policies.rows.map((r) => r.url.trim())).size).toBe(1);
    expect(policies.merges[0]?.lockedDestinationUrl).toContain("canadian-interest-rates-2026");
  });
});
