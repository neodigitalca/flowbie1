import { describe, expect, it } from "vitest";
import { filterClustersWithResolvableMembers } from "@/lib/sitemap-optimizer/sitemap-optimizer-cluster-validate-agent";
import {
  filterMergeableMerges,
  isMergeableCluster,
  resolvedMemberRows,
} from "@/lib/sitemap-optimizer/resolved-cluster-members";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

function row(postId: string, url: string): SitemapOptimizerPostRow {
  return {
    postId,
    url,
    collection: "posts",
    title: `Title ${postId}`,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: false,
  };
}

describe("filterClustersWithResolvableMembers", () => {
  const catalogSet = new Set(["wp:1", "wp:2", "wp:3"]);

  it("drops cluster with only one catalog id and remaps bare numeric id", () => {
    const draft: SitemapOptimizerClusterResult = {
      clusters: [
        {
          clusterId: "a",
          label: "x",
          intent: "mixed",
          memberPostIds: ["wp:1", "999"],
          confidence: "medium",
          rationale: "",
        },
      ],
      singletons: [],
    };
    const result = filterClustersWithResolvableMembers(draft, catalogSet);
    expect(result.clusters).toHaveLength(0);
    expect(result.singletons).toContain("wp:1");
  });

  it("keeps cluster when two ids resolve including numeric remap", () => {
    const draft: SitemapOptimizerClusterResult = {
      clusters: [
        {
          clusterId: "b",
          label: "y",
          intent: "mixed",
          memberPostIds: ["wp:1", "2"],
          confidence: "high",
          rationale: "",
        },
      ],
      singletons: [],
    };
    const result = filterClustersWithResolvableMembers(draft, catalogSet);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0]!.memberPostIds).toEqual(["wp:1", "wp:2"]);
  });

  it("keeps cluster with four members after normalize", () => {
    const draft: SitemapOptimizerClusterResult = {
      clusters: [
        {
          clusterId: "c",
          label: "z",
          intent: "mixed",
          memberPostIds: ["wp:1", "wp:2", "wp:3", "wp:4"],
          confidence: "low",
          rationale: "",
        },
      ],
      singletons: [],
    };
    const fourSet = new Set(["wp:1", "wp:2", "wp:3", "wp:4"]);
    const result = filterClustersWithResolvableMembers(draft, fourSet);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0]!.memberPostIds).toEqual(["wp:1", "wp:2", "wp:3", "wp:4"]);
  });
});

describe("resolved-cluster-members", () => {
  const rows = [row("wp:10", "https://x/a"), row("wp:11", "https://x/b")];
  const rowMap = new Map(rows.map((r) => [r.postId, r]));

  const cluster: SitemapOptimizerCluster = {
    clusterId: "g1",
    label: "g",
    intent: "mixed",
    memberPostIds: ["wp:10", "bogus"],
    confidence: "medium",
    rationale: "",
  };

  it("isMergeableCluster is false with one resolved row", () => {
    expect(isMergeableCluster(cluster, rowMap)).toBe(false);
    expect(resolvedMemberRows(cluster, rowMap)).toHaveLength(1);
  });

  it("filterMergeableMerges drops merge for non-mergeable cluster", () => {
    const merges = [
      {
        clusterId: "g1",
        recommendedTitle: "Merged",
        recommendedPrimaryKeyword: "kw",
        recommendedMeta: "",
        combinedOutline: [],
        whatToKeepFromEach: [],
        redirectOrCanonicalNote: "",
        priority: "medium" as const,
        confidence: "medium" as const,
        rationale: "",
      },
    ];
    expect(filterMergeableMerges(merges, [cluster], rows)).toHaveLength(0);
  });
});
