import { describe, expect, it } from "vitest";
import { applyContentYearPolicy } from "@/lib/sitemap-optimizer/apply-content-year-policy";
import { applyGridOutputPolicies } from "@/lib/sitemap-optimizer/grid-output-policies";
import { buildDeterministicGridBriefs } from "@/lib/sitemap-optimizer/grid-deterministic-brief";
import { clusterRedirectMapForFamilies } from "@/lib/sitemap-optimizer/grid-prefilled-group-cluster";
import type { TemporalCannibalizationExemptResult } from "@/lib/sitemap-optimizer/grid-temporal-cannibalization-agent";
import {
  pickTemporalPillarDestinationUrl,
  temporalPillarOutline,
} from "@/lib/sitemap-optimizer/grid-temporal-cannibalization";
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

/** All interest-rate rows from Traffic Redirects (1).csv */
function trafficRedirectsInterestRateRows(): SitemapOptimizerPostRow[] {
  return [
    {
      id: "wp:91",
      old: "https://www.kwbllp.com/2024/04/01/canadian-interest-rates-q2-2024/",
      new: "https://www.kwbllp.com/blog/canadian-interest-rates-q2-2026/",
      title: "Canadian Interest Rates Q2 2024",
      idx: 91,
    },
    {
      id: "wp:89",
      old: "https://www.kwbllp.com/2024/05/27/canadian-interest-rates-q3-2024/",
      new: "https://www.kwbllp.com/blog/canadian-interest-rates-q3-2026/",
      title: "Canadian Interest Rates Q3 2024",
      idx: 89,
    },
    {
      id: "wp:78",
      old: "https://www.kwbllp.com/2024/09/03/canadian-interest-rates-q4-2024/",
      new: "https://www.kwbllp.com/blog/canadian-interest-rates-q4-2026/",
      title: "Canadian Interest Rates Q4 2024",
      idx: 78,
    },
    {
      id: "wp:54",
      old: "https://www.kwbllp.com/2025/04/07/canadian-interest-rates-q2-2025-april-1-2025-to-june-30-2025/",
      new: "https://www.kwbllp.com/blog/canadian-interest-rates/",
      title: "Canadian Interest Rates Q2 2025",
      idx: 54,
    },
    {
      id: "wp:45",
      old: "https://www.kwbllp.com/2025/06/16/canadian-interest-rates-q3-2025-july-1-2025-to-september-30-2025/",
      new: "https://www.kwbllp.com/blog/cra-prescribed-interest-rate-q3/",
      title: "Canadian Interest Rates Q3 2025",
      idx: 45,
    },
    {
      id: "wp:34",
      old: "https://www.kwbllp.com/2025/08/25/canadian-interest-rates-q4-2025-october-1-to-december-31-2025/",
      new: "https://www.kwbllp.com/blog/cra-prescribed-interest-rate-q4/",
      title: "Canadian Interest Rates Q4 2025",
      idx: 34,
    },
    {
      id: "wp:7",
      old: "https://www.kwbllp.com/2026/03/03/canadian-interest-rates-q2-2026-april-1-to-june-30-2026/",
      new: "https://www.kwbllp.com/blog/cra-prescribed-interest-rate/",
      title: "Canadian Interest Rates Q2 2026",
      idx: 7,
    },
  ].map((r) =>
    redirectRow({
      id: r.id,
      oldUrl: r.old,
      newUrl: r.new,
      title: r.title,
      uploadRowIndex: r.idx,
    }),
  );
}

function trafficRedirectsInterestRateTemporalExempt(
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
        temporalSectionHeaders: [
          "Q2 2024 update",
          "Q3 2024 update",
          "Q4 2024 update",
          "Q2 2025 update",
          "Q3 2025 update",
          "Q4 2025 update",
          "Q2 2026 update",
        ],
      },
    ],
    exemptPostIds: new Set(sorted.map((r) => r.postId)),
  };
}

describe("temporal interest-rate pillar", () => {
  it("merges all Traffic Redirects interest-rate quarters into one 2026 pillar", () => {
    const rows = trafficRedirectsInterestRateRows();
    const temporalExempt = trafficRedirectsInterestRateTemporalExempt(rows);
    const { clusters } = clusterRedirectMapForFamilies(rows, 5, temporalExempt);
    const temporal = clusters.clusters.filter((c) => c.clusterId.startsWith("grid-temporal-"));
    expect(temporal).toHaveLength(1);
    expect(temporal[0]?.memberPostIds).toHaveLength(7);

    const merges = buildDeterministicGridBriefs(clusters.clusters, rows);
    const policies = applyGridOutputPolicies({
      rows,
      clusters,
      merges,
      gridMaxUrlsPerPost: 5,
      analyzedAt: "2026-06-01T00:00:00.000Z",
    });
    const yearApplied = applyContentYearPolicy({
      rows: policies.rows,
      merges: policies.merges,
      contentSheet: policies.contentSheet,
      clusters: policies.clusters,
      analyzedAt: "2026-06-01T00:00:00.000Z",
    });

    expect(yearApplied.contentSheet).toHaveLength(1);
    expect(yearApplied.contentSheet[0]?.proposedTitle).toContain("2026");
    expect(yearApplied.contentSheet[0]?.proposedTitle).not.toMatch(/q[1-4]/i);

    const dest = yearApplied.merges[0]?.lockedDestinationUrl ?? "";
    expect(dest).toContain("canadian-interest-rates-2026");
    expect(dest).not.toMatch(/q[1-4]/i);
    expect(new Set(yearApplied.rows.map((r) => r.url.trim())).size).toBe(1);
    expect(yearApplied.rows.every((r) => r.url.includes("canadian-interest-rates-2026"))).toBe(
      true,
    );
  });

  it("outline uses AI section headers as quarter H2s", () => {
    const members = trafficRedirectsInterestRateRows().slice(0, 3);
    const cluster = trafficRedirectsInterestRateTemporalExempt(members).clusters[0]!;
    const outline = temporalPillarOutline(members, 2026, cluster);
    expect(outline.some((h) => /Q2 2024/i.test(h))).toBe(true);
    expect(outline.some((h) => /Q3 2024/i.test(h))).toBe(true);
    expect(outline.some((h) => /Q4 2024/i.test(h))).toBe(true);
  });

  it("pickTemporalPillarDestinationUrl uses AI slug stem and content year", () => {
    const members = trafficRedirectsInterestRateRows().slice(0, 2);
    const cluster = trafficRedirectsInterestRateTemporalExempt(members).clusters[0]!;
    const url = pickTemporalPillarDestinationUrl(members, 2026, cluster);
    expect(url).toContain("canadian-interest-rates-2026");
    expect(url).not.toMatch(/q[1-4]/i);
  });
});
