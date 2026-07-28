import { describe, expect, it } from "vitest";
import {
  buildContentSheetRows,
  contentSheetSummaryCounts,
  standalonePostIdsFromClusters,
} from "@/lib/sitemap-optimizer/build-content-sheet-rows";
import type {
  SitemapOptimizerClusterResult,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
  SitemapOptimizerStandaloneProposal,
} from "@/lib/sitemap-optimizer/types";

const row = (id: string, url: string, title: string): SitemapOptimizerPostRow => ({
  postId: id,
  url,
  collection: "posts",
  title,
  keyword: "kw",
  meta: "meta",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
});

describe("build-content-sheet-rows", () => {
  it("maps merge members to shared proposed title", () => {
    const rows = [row("a", "https://x.com/a", "Title A"), row("b", "https://x.com/b", "Title B")];
    const clusters: SitemapOptimizerClusterResult = {
      clusters: [
        {
          clusterId: "c1",
          label: "Group",
          intent: "mixed",
          memberPostIds: ["a", "b"],
          confidence: "high",
          rationale: "",
        },
      ],
      singletons: [],
    };
    const merges: SitemapOptimizerMergeRecommendation[] = [
      {
        clusterId: "c1",
        recommendedTitle: "Merged Title",
        recommendedPrimaryKeyword: "merged kw",
        recommendedMeta: "Merged meta",
        combinedOutline: [],
        whatToKeepFromEach: [],
        redirectOrCanonicalNote: "",
        priority: "high",
        confidence: "high",
        rationale: "overlap",
      },
    ];
    const sheet = buildContentSheetRows({ rows, clusters, merges });
    expect(sheet).toHaveLength(1);
    expect(sheet[0]?.action).toBe("merge");
    expect(sheet[0]?.proposedTitle).toBe("Merged Title");
    expect(sheet[0]?.mergeSourceCount).toBe(2);
    const summary = contentSheetSummaryCounts(sheet);
    expect(summary.mergeGroups).toBe(1);
    expect(summary.urlsConsolidating).toBe(2);
  });

  it("uses deterministic fallback when a non-merge URL has no proposal", () => {
    const rows = [row("solo", "https://x.com/solo", "Solo")];
    const clusters: SitemapOptimizerClusterResult = { clusters: [], singletons: ["solo"] };
    const sheet = buildContentSheetRows({ rows, clusters, merges: [], standaloneProposals: [] });
    expect(sheet[0]?.action).toBe("refresh");
    expect(sheet[0]?.proposedTitle).toBe("Solo");
    expect(sheet[0]?.rationale).toMatch(/Deterministic refresh brief/);
  });

  it("uses new destination url on content sheet when row was redirect-mapped", () => {
    const rows: SitemapOptimizerPostRow[] = [
      {
        postId: "wp:1",
        url: "https://www.kwbllp.com/blog/tax-financial-planning/",
        gridRedirectFromUrl:
          "https://www.kwbllp.com/2026/04/02/integrated-financial-and-tax-planning-for-medical-professionals-3/",
        collection: "posts",
        title: "Tax planning",
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscQueries: [],
        gscFetched: true,
      },
    ];
    const clusters: SitemapOptimizerClusterResult = { clusters: [], singletons: ["wp:1"] };
    const proposals: SitemapOptimizerStandaloneProposal[] = [
      {
        postId: "wp:1",
        action: "refresh",
        proposedTitle: "Medical Tax Planning Guide",
        proposedPrimaryKeyword: "tax planning",
        proposedMeta: "Meta.",
        priority: "high",
        rationale: "refresh",
      },
    ];
    const sheet = buildContentSheetRows({
      rows,
      clusters,
      merges: [],
      standaloneProposals: proposals,
    });
    expect(sheet[0]?.sourceUrl).toBe("https://www.kwbllp.com/blog/tax-financial-planning/");
  });

  it("matches standalone proposals when model returns bare wp numeric id", () => {
    const rows = [row("wp:10773", "https://kwbllp.com/post/", "Medical Planning")];
    const clusters: SitemapOptimizerClusterResult = {
      clusters: [],
      singletons: ["wp:10773"],
    };
    const proposals: SitemapOptimizerStandaloneProposal[] = [
      {
        postId: "10773",
        action: "refresh",
        proposedTitle: "Refreshed Title",
        proposedPrimaryKeyword: "tax planning",
        proposedMeta: "Meta description for refresh.",
        priority: "high",
        rationale: "GSC opportunity",
      },
    ];
    const sheet = buildContentSheetRows({
      rows,
      clusters,
      merges: [],
      standaloneProposals: proposals,
    });
    expect(sheet[0]?.proposedTitle).toBe("Refreshed Title");
  });

  it("applies standalone refresh proposals", () => {
    const rows = [row("solo", "https://x.com/solo", "Solo")];
    const clusters: SitemapOptimizerClusterResult = { clusters: [], singletons: ["solo"] };
    const proposals: SitemapOptimizerStandaloneProposal[] = [
      {
        postId: "solo",
        action: "refresh",
        proposedTitle: "New Solo",
        proposedPrimaryKeyword: "solo kw",
        proposedMeta: "New meta",
        priority: "medium",
        rationale: "thin",
      },
    ];
    const sheet = buildContentSheetRows({
      rows,
      clusters,
      merges: [],
      standaloneProposals: proposals,
    });
    expect(sheet[0]?.action).toBe("refresh");
    expect(sheet[0]?.proposedTitle).toBe("New Solo");
  });

  it("lists standalone post ids excluding merge members", () => {
    const rows = [row("a", "https://x.com/a", "A"), row("b", "https://x.com/b", "B"), row("c", "https://x.com/c", "C")];
    const clusters: SitemapOptimizerClusterResult = {
      clusters: [
        {
          clusterId: "c1",
          label: "G",
          intent: "mixed",
          memberPostIds: ["a", "b"],
          confidence: "high",
          rationale: "",
        },
      ],
      singletons: ["c"],
    };
    const merges: SitemapOptimizerMergeRecommendation[] = [
      {
        clusterId: "c1",
        recommendedTitle: "M",
        recommendedPrimaryKeyword: "k",
        recommendedMeta: "m",
        combinedOutline: [],
        whatToKeepFromEach: [],
        redirectOrCanonicalNote: "",
        priority: "high",
        confidence: "high",
        rationale: "",
      },
    ];
    const ids = standalonePostIdsFromClusters(clusters, merges, rows);
    expect(ids).toEqual(["c"]);
  });
});
