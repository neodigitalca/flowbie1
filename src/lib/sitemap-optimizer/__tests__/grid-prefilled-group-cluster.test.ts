import { describe, expect, it } from "vitest";
import {
  clusterRedirectMapByDestination,
  tryClusterByPrefilledGridGroup,
  tryClusterBySharedNewUrl,
} from "@/lib/sitemap-optimizer/grid-prefilled-group-cluster";
import { finalizeGridClusterResult } from "@/lib/sitemap-optimizer/grid-finalize-clusters";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const row = (id: string, group: number): SitemapOptimizerPostRow => ({
  postId: id,
  url: `https://example.com/new-${id}/`,
  gridRedirectFromUrl: `https://example.com/old-${id}/`,
  gridRedirectGroup: group,
  gridTopicTag: "topic_a",
  collection: "grid_csv",
  title: "Title",
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
});

describe("tryClusterByPrefilledGridGroup", () => {
  it("clusters rows by CSV group when every row has a group", () => {
    const result = tryClusterByPrefilledGridGroup([
      row("csv:0", 1),
      row("csv:1", 1),
      row("csv:2", 2),
    ]);
    expect(result?.clusters).toHaveLength(2);
    const g1 = result?.clusters.find((c) => c.clusterId === "grid-group-1");
    expect(g1?.memberPostIds).toEqual(["csv:0", "csv:1"]);
  });

  it("returns null when any row lacks a group", () => {
    const rows = [row("csv:0", 1), { ...row("csv:1", 2), gridRedirectGroup: undefined }];
    expect(tryClusterByPrefilledGridGroup(rows)).toBeNull();
  });
});

describe("tryClusterBySharedNewUrl", () => {
  const dest = "https://www.kwbllp.com/blog/auto-repair-profitability/";

  const mapRow = (id: string, oldUrl: string, url = dest): SitemapOptimizerPostRow => ({
    postId: id,
    url,
    gridRedirectFromUrl: oldUrl,
    collection: "grid_csv",
    title: "Auto Repair Profitability",
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
  });

  it("clusters redirect map rows sharing the same new_url", () => {
    const result = tryClusterBySharedNewUrl([
      mapRow("csv:0", "https://www.kwbllp.com/blog/auto-repair-profit/"),
      mapRow("csv:1", "https://www.kwbllp.com/blog/auto-repair-profit-improvement/"),
      mapRow(
        "csv:2",
        "https://www.kwbllp.com/blog/other-old/",
        "https://www.kwbllp.com/blog/other-topic/",
      ),
    ]);
    expect(result?.clusters).toHaveLength(2);
    const profitCluster = result?.clusters.find((c) => c.memberPostIds.length === 2);
    expect(profitCluster?.memberPostIds).toEqual(["csv:0", "csv:1"]);
  });

  it("clusters by new_url even when CSV group ids are present", () => {
    const shared = "https://www.kwbllp.com/blog/shared-dest/";
    const rows = [
      { ...mapRow("csv:0", "https://example.com/old-a/", shared), gridRedirectGroup: 1 },
      { ...mapRow("csv:1", "https://example.com/old-b/", shared), gridRedirectGroup: 2 },
    ];
    const result = tryClusterBySharedNewUrl(rows);
    expect(result?.clusters).toHaveLength(1);
    expect(result?.clusters[0]?.memberPostIds).toEqual(["csv:0", "csv:1"]);
  });
});

describe("clusterRedirectMapByDestination", () => {
  const dest = "https://www.kwbllp.com/blog/yellowknife-profit-improvement/";

  it("groups by shared new_url even when CSV group ids differ", () => {
    const mk = (id: string, group: number, oldSlug: string): SitemapOptimizerPostRow => ({
      postId: `csv:${id}`,
      url: dest,
      gridRedirectFromUrl: `https://www.kwbllp.com/old/${oldSlug}/`,
      gridRedirectGroup: group,
      gridTopicTag: "yellowknife_profit",
      collection: "grid_csv",
      title: oldSlug,
      keyword: "",
      meta: "",
      contentSnippet: "",
      gscQueries: [],
      gscFetched: true,
    });
    const rows = [mk("0", 1, "a"), mk("1", 1, "b"), mk("2", 1, "c"), mk("3", 2, "d")];
    const draft = clusterRedirectMapByDestination(rows);
    expect(draft.clusters).toHaveLength(1);
    expect(draft.clusters[0]?.memberPostIds).toHaveLength(4);
    const finalized = finalizeGridClusterResult(draft, rows, 1);
    expect(finalized.clusters).toHaveLength(1);
    expect(finalized.clusters[0]?.memberPostIds).toHaveLength(4);
  });
});
