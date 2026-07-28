import { describe, expect, it } from "vitest";
import { buildDeterministicGridBrief } from "@/lib/sitemap-optimizer/grid-deterministic-brief";
import { lockedDestinationForRedirectMapCluster } from "@/lib/sitemap-optimizer/grid-redirect-destination";
import type { SitemapOptimizerCluster, SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const dest = "https://www.kwbllp.com/blog/auto-repair-profitability/";

describe("lockedDestinationForRedirectMapCluster", () => {
  it("locks to shared CSV new_url for N→1 redirect clusters", () => {
    const members: SitemapOptimizerPostRow[] = [
      {
        postId: "csv:0",
        url: dest,
        gridRedirectFromUrl: "https://www.kwbllp.com/blog/auto-repair-profit/",
        collection: "grid_csv",
        title: "A",
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscQueries: [],
        gscFetched: true,
      },
      {
        postId: "csv:1",
        url: dest,
        gridRedirectFromUrl: "https://www.kwbllp.com/blog/auto-repair-profit-improvement/",
        collection: "grid_csv",
        title: "B",
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscQueries: [],
        gscFetched: true,
      },
    ];
    expect(lockedDestinationForRedirectMapCluster(members)).toBe(dest);
  });
});

describe("buildDeterministicGridBrief redirect map", () => {
  it("never sets lockedDestinationUrl to a legacy old_url", () => {
    const cluster: SitemapOptimizerCluster = {
      clusterId: "grid-group-1",
      label: "Auto Repair",
      intent: "mixed",
      memberPostIds: ["csv:0", "csv:1"],
      confidence: "high",
      rationale: "",
    };
    const rows: SitemapOptimizerPostRow[] = [
      {
        postId: "csv:0",
        url: dest,
        gridRedirectFromUrl: "https://www.kwbllp.com/old/a/",
        collection: "grid_csv",
        title: "A",
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscQueries: [],
        gscFetched: true,
      },
      {
        postId: "csv:1",
        url: dest,
        gridRedirectFromUrl: "https://www.kwbllp.com/old/b/",
        collection: "grid_csv",
        title: "B",
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscQueries: [],
        gscFetched: true,
      },
    ];
    const brief = buildDeterministicGridBrief(cluster, new Map(rows.map((r) => [r.postId, r])));
    expect(brief?.lockedDestinationUrl).toBe(dest);
  });
});
