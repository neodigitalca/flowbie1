import { describe, expect, it } from "vitest";
import { finalizeGridClusterResult } from "@/lib/sitemap-optimizer/grid-finalize-clusters";
import { packGridLooseClusters } from "@/lib/sitemap-optimizer/grid-pack-loose-clusters";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const row = (index: number): SitemapOptimizerPostRow => ({
  postId: `csv:${index}`,
  url: `https://example.com/p/${index}/`,
  collection: "grid_csv",
  title: `Page ${index}`,
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
  uploadRowIndex: index,
});

describe("packGridLooseClusters", () => {
  it("packs loose URLs into groups of at most maxUrlsPerPost", () => {
    const rows = Array.from({ length: 11 }, (_, i) => row(i + 1));
    const draft = {
      clusters: [
        {
          clusterId: "ai-multi",
          label: "Kept merge",
          intent: "mixed" as const,
          memberPostIds: ["csv:1", "csv:2"],
          confidence: "high" as const,
          rationale: "",
        },
        ...rows.slice(2).map((r) => ({
          clusterId: `solo-${r.postId}`,
          label: r.title,
          intent: "mixed" as const,
          memberPostIds: [r.postId],
          confidence: "medium" as const,
          rationale: "",
        })),
      ],
      singletons: [] as string[],
    };

    const packed = packGridLooseClusters(draft, rows, 5);
    const multi = packed.clusters.find((c) => c.clusterId === "ai-multi");
    expect(multi?.memberPostIds).toHaveLength(2);

    const looseMembers = packed.clusters
      .filter((c) => c.clusterId.startsWith("grid-pack-"))
      .flatMap((c) => c.memberPostIds);
    expect(looseMembers).toHaveLength(9);
    expect(packed.clusters.filter((c) => c.clusterId.startsWith("grid-pack-"))).toHaveLength(2);
    expect(packed.singletons).toHaveLength(0);
  });

  it("finalize assigns every upload row and caps cluster size", () => {
    const rows = Array.from({ length: 23 }, (_, i) => row(i + 1));
    const draft = {
      clusters: rows.map((r) => ({
        clusterId: `solo-${r.postId}`,
        label: r.title,
        intent: "mixed" as const,
        memberPostIds: [r.postId],
        confidence: "medium" as const,
        rationale: "",
      })),
      singletons: [] as string[],
    };
    const final = finalizeGridClusterResult(draft, rows, 5);
    const assigned = new Set(final.clusters.flatMap((c) => c.memberPostIds));
    expect(assigned.size).toBe(23);
    expect(final.singletons).toHaveLength(0);
    expect(final.clusters.every((c) => c.memberPostIds.length <= 5)).toBe(true);
    expect(final.clusters.length).toBe(23);
  });
});
