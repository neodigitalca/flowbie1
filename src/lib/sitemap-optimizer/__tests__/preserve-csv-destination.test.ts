import { describe, expect, it } from "vitest";
import { normalizeMergeDestinations } from "@/lib/sitemap-optimizer/blog-destination-policy";

describe("normalizeMergeDestinations preserveCsvDestinations", () => {
  it("keeps CSV new_url slug when preserveCsvDestinations is set", () => {
    const csvTarget = "https://www.kwbllp.com/blog/cra-gig-worker-reporting/";
    const merges = normalizeMergeDestinations(
      [
        {
          clusterId: "c1",
          recommendedTitle: "CRA Gig Worker Reporting Rules",
          recommendedPrimaryKeyword: "cra gig worker reporting rules long phrase",
          recommendedMeta: "Meta",
          combinedOutline: [],
          whatToKeepFromEach: [],
          redirectOrCanonicalNote: "",
          priority: "high",
          confidence: "high",
          rationale: "",
          lockedDestinationUrl: csvTarget,
        },
      ],
      {
        forceBlogPermalink: true,
        parentPrefix: "blog",
        preserveCsvDestinations: true,
      },
      new Map([["c1", ["https://www.kwbllp.com/2025/01/27/canada-revenue-agency-new-reporting-rules-for-gig-workers/"]]]),
      "2026-06-01T00:00:00.000Z",
    );
    expect(merges[0]?.lockedDestinationUrl).toBe(csvTarget);
  });
});
