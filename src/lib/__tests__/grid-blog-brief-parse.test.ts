import { describe, expect, it } from "vitest";
import { parseGridBlogBriefBatchJson } from "@/lib/sitemap-optimizer/grid-blog-brief-parse";

describe("parseGridBlogBriefBatchJson", () => {
  it("parses briefs array", () => {
    const json = JSON.stringify({
      briefs: [
        {
          clusterId: "c1",
          recommendedTitle: "Cloud Accounting Guide",
          recommendedPrimaryKeyword: "cloud accounting",
          recommendedMeta: "Learn cloud accounting for small business.",
          lockedDestinationUrl: "https://example.com/2025/01/01/cloud-accounting/",
          combinedOutline: ["Overview"],
          whatToKeepFromEach: [{ url: "https://example.com/a/", title: "A", bullets: ["intent"] }],
          redirectOrCanonicalNote: "Link sources",
          priority: "high",
          confidence: "high",
          rationale: "Grouped",
        },
      ],
    });
    const out = parseGridBlogBriefBatchJson(json);
    expect(out).toHaveLength(1);
    expect(out[0]?.clusterId).toBe("c1");
    expect(out[0]?.lockedDestinationUrl).toContain("cloud-accounting");
  });

  it("returns empty on invalid JSON", () => {
    expect(parseGridBlogBriefBatchJson("not json")).toEqual([]);
  });
});
