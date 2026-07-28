import { describe, expect, it } from "vitest";
import { resolveClusterOverlap } from "@/lib/sitemap-optimizer/resolve-cluster-overlap";
import type { SitemapOptimizerClusterResult } from "@/lib/sitemap-optimizer/types";

function cluster(
  id: string,
  members: string[],
  confidence: "high" | "medium" | "low" = "medium",
) {
  return {
    clusterId: id,
    label: id,
    intent: "mixed",
    memberPostIds: members,
    confidence,
    rationale: "",
  };
}

describe("resolveClusterOverlap", () => {
  it("keeps postId in highest-confidence cluster only", () => {
    const draft: SitemapOptimizerClusterResult = {
      clusters: [
        cluster("a", ["wp:1", "wp:2"], "high"),
        cluster("b", ["wp:2", "wp:3"], "low"),
      ],
      singletons: [],
    };
    const result = resolveClusterOverlap(draft);
    expect(result.clusters.find((c) => c.clusterId === "a")?.memberPostIds).toEqual([
      "wp:1",
      "wp:2",
    ]);
    expect(result.clusters.find((c) => c.clusterId === "b")).toBeUndefined();
    expect(result.singletons).toContain("wp:3");
  });
});
