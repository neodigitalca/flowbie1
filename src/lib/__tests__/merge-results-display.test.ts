import { describe, expect, it } from "vitest";
import {
  displayPostTitle,
  mergeGroupTintClass,
  sortMergesByPriority,
} from "@/lib/sitemap-optimizer/merge-results-display";
import type { SitemapOptimizerMergeRecommendation } from "@/lib/sitemap-optimizer/types";

describe("merge-results-display", () => {
  it("decodes common HTML entities in titles", () => {
    expect(displayPostTitle("Foo &#038; Bar")).toBe("Foo & Bar");
    expect(displayPostTitle("A &amp; B")).toBe("A & B");
  });

  it("strips compression part suffixes but keeps 4-digit years", () => {
    expect(displayPostTitle("Tax Myths (10)")).toBe("Tax Myths");
    expect(displayPostTitle("KWB has moved (6)")).toBe("KWB has moved");
    expect(displayPostTitle("Alberta Budget 2024")).toBe("Alberta Budget 2024");
    expect(displayPostTitle("Federal Budget (2024)")).toBe("Federal Budget (2024)");
  });

  it("rotates tint classes", () => {
    expect(mergeGroupTintClass(0)).not.toBe(mergeGroupTintClass(1));
    expect(mergeGroupTintClass(3)).toBe(mergeGroupTintClass(0));
  });

  it("sorts merges high before low", () => {
    const merges: SitemapOptimizerMergeRecommendation[] = [
      {
        clusterId: "a",
        recommendedTitle: "Low",
        recommendedPrimaryKeyword: "",
        recommendedMeta: "",
        combinedOutline: [],
        whatToKeepFromEach: [],
        redirectOrCanonicalNote: "",
        priority: "low",
        confidence: "low",
        rationale: "",
      },
      {
        clusterId: "b",
        recommendedTitle: "High",
        recommendedPrimaryKeyword: "",
        recommendedMeta: "",
        combinedOutline: [],
        whatToKeepFromEach: [],
        redirectOrCanonicalNote: "",
        priority: "high",
        confidence: "high",
        rationale: "",
      },
    ];
    expect(sortMergesByPriority(merges)[0]?.priority).toBe("high");
  });
});
