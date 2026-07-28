import { describe, expect, it } from "vitest";
import { finalizeGridClusterResult } from "@/lib/sitemap-optimizer/grid-finalize-clusters";
import {
  promoteGridSingletonsToClusters,
  splitOversizedGridClusters,
} from "@/lib/sitemap-optimizer/grid-finalize-clusters";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const row = (id: string): SitemapOptimizerPostRow => ({
  postId: `csv:${id}`,
  url: `https://x.com/${id}`,
  collection: "grid_csv",
  title: `Title ${id}`,
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
});

describe("grid-finalize-clusters", () => {
  it("splits clusters larger than max URLs per post", () => {
    const ids = ["0", "1", "2", "3", "4", "5", "6"];
    const result = splitOversizedGridClusters(
      {
        clusters: [
          {
            clusterId: "big",
            label: "Big",
            intent: "mixed",
            memberPostIds: ids.map((i) => `csv:${i}`),
            confidence: "high",
            rationale: "",
          },
        ],
        singletons: [],
      },
      5,
    );
    expect(result.clusters.length).toBe(2);
    expect(result.clusters[0]?.memberPostIds.length).toBe(5);
    expect(result.clusters[1]?.memberPostIds.length).toBe(2);
  });

  it("promotes singletons to 1-URL clusters and finalize covers all rows", () => {
    const rows = [row("0"), row("1"), row("2")];
    const finalized = finalizeGridClusterResult(
      {
        clusters: [
          {
            clusterId: "g1",
            label: "Pair",
            intent: "mixed",
            memberPostIds: ["csv:0", "csv:1"],
            confidence: "high",
            rationale: "",
          },
        ],
        singletons: ["csv:2"],
      },
      rows,
      5,
    );
    expect(finalized.singletons).toHaveLength(0);
    const assigned = new Set(finalized.clusters.flatMap((c) => c.memberPostIds));
    expect(assigned.size).toBe(3);
    for (const c of finalized.clusters) {
      expect(c.memberPostIds.length).toBeLessThanOrEqual(5);
    }
  });

  it("promoteGridSingletonsToClusters clears singletons list", () => {
    const out = promoteGridSingletonsToClusters(
      { clusters: [], singletons: ["csv:0"] },
      [row("0")],
    );
    expect(out.singletons).toHaveLength(0);
    expect(out.clusters).toHaveLength(1);
    expect(out.clusters[0]?.memberPostIds).toEqual(["csv:0"]);
  });
});
