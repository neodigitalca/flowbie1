import { describe, expect, it } from "vitest";
import {
  isRedirectMapOverflowPackCluster,
  overflowKeywordFromRedirectMembers,
  redirectMapClusterPackPart,
} from "@/lib/sitemap-optimizer/grid-redirect-pack-cluster";
import { lockedDestinationForRedirectMapCluster } from "@/lib/sitemap-optimizer/grid-redirect-destination";
import type { SitemapOptimizerCluster, SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const dest = "https://www.kwbllp.com/blog/profit-improvement-strategies/";

function member(id: string, oldUrl: string): SitemapOptimizerPostRow {
  return {
    postId: id,
    url: dest,
    gridRedirectFromUrl: oldUrl,
    collection: "posts",
    title: "Profit",
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
  };
}

describe("grid-redirect-pack-cluster", () => {
  it("detects overflow pack parts from cluster id", () => {
    expect(redirectMapClusterPackPart("grid-dest-1-part-1")).toBe(1);
    expect(redirectMapClusterPackPart("grid-dest-1-part-2")).toBe(2);
    expect(isRedirectMapOverflowPackCluster({ clusterId: "grid-dest-1-part-2" })).toBe(true);
    expect(isRedirectMapOverflowPackCluster({ clusterId: "grid-dest-1-part-1" })).toBe(false);
  });

  it("does not lock CSV new_url for overflow packs", () => {
    const members = [member("wp:5", "https://www.kwbllp.com/2021/07/cash-flow/")];
    const cluster: SitemapOptimizerCluster = {
      clusterId: "grid-dest-1-part-2",
      label: "Overflow",
      intent: "mixed",
      memberPostIds: ["wp:5"],
      confidence: "high",
      rationale: "",
    };
    expect(lockedDestinationForRedirectMapCluster(members, cluster)).toBeNull();
  });

  it("derives overflow keyword from legacy URL slug", () => {
    const members = [
      member("wp:5", "https://www.kwbllp.com/2021/07/cash-flow-planning/"),
    ];
    expect(overflowKeywordFromRedirectMembers(members)).toContain("cash flow planning");
  });
});
