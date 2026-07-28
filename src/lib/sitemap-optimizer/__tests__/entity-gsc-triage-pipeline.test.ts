import { beforeEach, describe, expect, it, vi } from "vitest";
import { runEntityCompressionPipeline } from "@/lib/sitemap-optimizer/entity-compression-pipeline";
import { buildEntityCompressionProfile } from "@/lib/sitemap-optimizer/entity-compression-profile";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

vi.mock("@/lib/sitemap-optimizer/gsc-performance-triage-agent", () => ({
  runGscPerformanceTriage: vi.fn(),
}));

vi.mock("@/lib/sitemap-optimizer/entity-compress-families-agent", () => ({
  runEntityCompressFamiliesAgent: vi.fn(),
}));

vi.mock("@/lib/sitemap-optimizer/entity-transform-families-agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sitemap-optimizer/entity-transform-families-agent")>();
  return {
    ...actual,
    runEntityTransformFamiliesAgent: vi.fn(),
  };
});

import { runGscPerformanceTriage } from "@/lib/sitemap-optimizer/gsc-performance-triage-agent";
import { runEntityCompressFamiliesAgent } from "@/lib/sitemap-optimizer/entity-compress-families-agent";
import { runEntityTransformFamiliesAgent } from "@/lib/sitemap-optimizer/entity-transform-families-agent";

function entityRow(id: string, clicks: number): SitemapOptimizerPostRow {
  return {
    postId: id,
    url: `https://example.com/service-area/${id}/`,
    collection: "service-area",
    title: id,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
    gscPageClicks: clicks,
    gscPageImpressions: clicks * 10,
    publishedAtGmt: "2025-01-01T00:00:00",
  };
}

describe("entity-gsc-triage-pipeline", () => {
  const profile = buildEntityCompressionProfile({
    site: { entitySitemapUrl: "https://example.com/service-area-sitemap.xml" } as never,
    selectedCollections: new Set(["entity"]),
    trafficFilter: "all",
  });

  beforeEach(() => {
    vi.mocked(runGscPerformanceTriage).mockReset();
    vi.mocked(runEntityCompressFamiliesAgent).mockReset();
    vi.mocked(runEntityTransformFamiliesAgent).mockReset();
  });

  it("runs keep → compress → transform after triage", async () => {
    const keep = entityRow("keep-a", 20);
    const merge = entityRow("merge-b", 0);
    const rows = [keep, merge];

    vi.mocked(runGscPerformanceTriage).mockResolvedValue({
      rows: [
        { ...keep, gscDisposition: "keep", gscTriageRationale: "Top performer" },
        { ...merge, gscDisposition: "consolidate", gscTriageRationale: "Weak traffic" },
      ],
      keepRows: [{ ...keep, gscDisposition: "keep" }],
      consolidateRows: [{ ...merge, gscDisposition: "consolidate" }],
      benchmarks: {
        urlCount: 2,
        totalClicks: 20,
        totalImpressions: 200,
        medianClicks: 10,
        medianImpressions: 100,
        p25Clicks: 5,
        p75Clicks: 15,
        p25Impressions: 50,
        p75Impressions: 150,
        medianCtr: 0.1,
        medianPosition: 8,
      },
    });

    const compressFamilies = {
      families: [
        {
          familyId: "redirect-family-1",
          destinationPostId: "merge-b",
          sourcePostIds: ["merge-b"],
          rationale: "Weak traffic consolidation",
        },
      ],
    };
    vi.mocked(runEntityCompressFamiliesAgent).mockResolvedValue(compressFamilies);

    vi.mocked(runEntityTransformFamiliesAgent).mockResolvedValue({
      families: [
        {
          familyId: "redirect-family-1",
          destinationPostId: "merge-b",
          sourcePostIds: ["merge-b"],
          rationale: "Weak traffic consolidation",
          recommendedPrimaryKeyword: "area service",
          recommendedTitle: "Area Service Page",
          recommendedMeta: "Meta for merged area page.",
          sapEntity: "Example, City",
          sapModifier: "Brief grounded in legacy posts.",
          combinedOutline: ["Overview"],
          whatToKeepFromEach: [
            { url: "https://example.com/service-area/merge-b/", title: "merge-b", bullets: ["keep"] },
          ],
        },
      ],
    });

    const result = await runEntityCompressionPipeline({
      entityRows: rows,
      profile,
      apiKey: "test-key",
      blogDestination: { forceBlogPermalink: false },
      analyzedAt: "2026-06-11T00:00:00.000Z",
    });

    const keepRows = result.contentSheet.filter((r) => r.action === "keep");
    const mergeRows = result.contentSheet.filter((r) => r.action === "merge");
    expect(keepRows).toHaveLength(0);
    expect(mergeRows.length).toBeGreaterThanOrEqual(1);
    expect(result.rows.filter((r) => r.gscDisposition === "keep")).toHaveLength(1);
    expect(result.rows).toHaveLength(2);
    expect(runEntityCompressFamiliesAgent).toHaveBeenCalledTimes(1);
    expect(runEntityTransformFamiliesAgent).toHaveBeenCalledTimes(1);
    expect(mergeRows[0]?.proposedPrimaryKeyword).toBe("area service");
  });
});
