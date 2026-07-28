import { describe, expect, it } from "vitest";
import { fillFamilyStrategyFromPillar } from "@/lib/sitemap-optimizer/entity-transform-families-agent";
import {
  isPlaceholderKeyword,
  isPlaceholderSapEntity,
  isPlaceholderStrategyField,
} from "@/lib/sitemap-optimizer/entity-strategy-placeholders";
import { familyHasCompleteAiStrategy } from "@/lib/sitemap-optimizer/entity-redirect-plan-parse";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function row(postId: string, url: string, opts: Partial<SitemapOptimizerPostRow> = {}): SitemapOptimizerPostRow {
  return {
    postId,
    url,
    collection: "entity",
    title: postId,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscPageClicks: 0,
    gscPageImpressions: 0,
    gscQueries: [],
    gscFetched: true,
    ...opts,
  };
}

describe("entity strategy placeholders", () => {
  it("flags Hyperlocal Place, City and instructional fields", () => {
    expect(isPlaceholderSapEntity("Hyperlocal Place, City")).toBe(true);
    expect(isPlaceholderSapEntity("Boynton Beach, Florida")).toBe(false);
    expect(isPlaceholderKeyword("geography-free phrase from legacy content")).toBe(true);
    expect(isPlaceholderKeyword("blinds boynton beach")).toBe(false);
    expect(isPlaceholderStrategyField("writer brief grounded in legacy posts")).toBe(true);
  });

  it("replaces placeholder sapEntity and keyword from pillar place", () => {
    const rows = [
      row("a", "https://example.com/service-area/blinds-boynton-beach/", {
        title: "Blinds Boynton Beach",
        keyword: "blinds boynton beach",
      }),
    ];
    const rowById = new Map(rows.map((r) => [r.postId, r]));
    const filled = fillFamilyStrategyFromPillar(
      {
        familyId: "f1",
        destinationPostId: "a",
        sourcePostIds: ["a"],
        rationale: "why this replacement works",
        recommendedPrimaryKeyword: "geography-free phrase from legacy content",
        recommendedTitle: "headline with keyword substring + local place phrasing",
        recommendedMeta: "120-160 char meta from legacy themes",
        sapEntity: "Hyperlocal Place, City",
        sapModifier: "writer brief grounded in legacy posts",
        combinedOutline: ["H2 one", "H2 two"],
        whatToKeepFromEach: [
          { url: rows[0]!.url, title: "Blinds Boynton Beach", bullets: ["keep"] },
        ],
      },
      rowById,
    );
    expect(isPlaceholderSapEntity(filled.sapEntity)).toBe(false);
    expect(filled.sapEntity?.toLowerCase()).toMatch(/boynton/);
    expect(isPlaceholderKeyword(filled.recommendedPrimaryKeyword)).toBe(false);
    expect(filled.recommendedPrimaryKeyword?.toLowerCase()).toMatch(/blinds|boynton/);
    expect(isPlaceholderStrategyField(filled.sapModifier)).toBe(false);
    expect(familyHasCompleteAiStrategy(filled)).toBe(true);
  });

  it("leaves a real sapEntity unchanged", () => {
    const rows = [
      row("a", "https://example.com/service-area/blinds-pahokee/", {
        title: "Blinds Pahokee",
        keyword: "blinds pahokee",
      }),
    ];
    const rowById = new Map(rows.map((r) => [r.postId, r]));
    const filled = fillFamilyStrategyFromPillar(
      {
        familyId: "f1",
        destinationPostId: "a",
        sourcePostIds: ["a"],
        rationale: "Same-place consolidation for Pahokee.",
        recommendedPrimaryKeyword: "blinds pahokee florida",
        recommendedTitle: "Blinds in Pahokee, Florida",
        recommendedMeta: "Local blinds install in Pahokee, Florida.",
        sapEntity: "Pahokee, Florida",
        sapModifier: "Consolidate legacy Pahokee URLs. Also covers: Pahokee.",
        combinedOutline: ["Overview", "Also covers: Pahokee", "Next steps"],
        whatToKeepFromEach: [
          { url: rows[0]!.url, title: "Blinds Pahokee", bullets: ["Local angle for Pahokee"] },
        ],
      },
      rowById,
    );
    expect(filled.sapEntity).toBe("Pahokee, Florida");
    expect(filled.recommendedPrimaryKeyword).toBe("blinds pahokee florida");
  });
});
