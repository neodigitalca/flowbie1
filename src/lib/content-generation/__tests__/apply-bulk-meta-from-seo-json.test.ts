import { describe, it, expect } from "vitest";
import { buildOptimizedMetaFromKeywordResearch } from "@/lib/content-generation/apply-bulk-meta-from-seo-json";

describe("buildOptimizedMetaFromKeywordResearch entity SAP titles", () => {
  it("keeps Near post title when focus keyword embeds place tokens", () => {
    const postTitle = "Advanced Window Coverings Near Plum Coulee, MB";
    const meta = buildOptimizedMetaFromKeywordResearch(
      { seoTitle: "Advanced Window Coverings Plum Coulee: Guide", focusKeyword: "advanced window coverings plum coulee" },
      postTitle,
      "Meta description for the page.",
      "advanced window coverings plum coulee",
      "https://example.com/plum-coulee/",
      "https://example.com",
    );
    expect(meta.rank_math_title).toBe(postTitle);
    expect(meta.rank_math_title).not.toContain(":");
  });
});
