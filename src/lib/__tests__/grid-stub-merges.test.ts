import { describe, expect, it } from "vitest";
import { buildMergeGroupNumbersForGrid } from "@/lib/sitemap-optimizer/grid-merge-group-ids";
import { buildMergePublishContract } from "@/lib/sitemap-optimizer/sitemap-merge-publish-contract";
import { resolvedMemberRows } from "@/lib/sitemap-optimizer/resolved-cluster-members";
import { mergeGroupNumberForDestination } from "@/lib/sitemap-optimizer/grid-merge-group-ids";
import { buildGridStubMerges } from "@/lib/sitemap-optimizer/grid-stub-merges";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const row = (id: string): SitemapOptimizerPostRow => ({
  postId: `csv:${id}`,
  url: `https://x.com/p/${id}`,
  collection: "grid_csv",
  title: `Page ${id}`,
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
});

describe("grid-stub-merges", () => {
  it("assigns same merge_group_id to rows that share a destination URL", () => {
    const rows = [row("0"), row("1"), row("2")];
    const clusters = {
      clusters: [
        {
          clusterId: "g1",
          label: "Group one",
          intent: "mixed",
          memberPostIds: ["csv:0", "csv:1"],
          confidence: "high" as const,
          rationale: "",
        },
        {
          clusterId: "g2",
          label: "Group two",
          intent: "mixed",
          memberPostIds: ["csv:2"],
          confidence: "medium" as const,
          rationale: "",
        },
      ],
      singletons: [],
    };
    const merges = buildGridStubMerges(clusters, rows);
    expect(merges).toHaveLength(2);
    const groupMap = buildMergeGroupNumbersForGrid({ rows, clusters, merges });
    const rowMap = new Map(rows.map((r) => [r.postId, r]));
    const c1 = clusters.clusters[0]!;
    const members = resolvedMemberRows(c1, rowMap);
    const contract = buildMergePublishContract(merges[0]!, members, "2025-01-01T00:00:00.000Z", {
      minMembers: 1,
    });
    const g1 = mergeGroupNumberForDestination(contract!.destinationUrl, groupMap);
    expect(g1).toBeGreaterThan(0);
    expect(mergeGroupNumberForDestination(contract!.destinationUrl, groupMap)).toBe(g1);
  });
});
