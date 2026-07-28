import { describe, expect, it } from "vitest";
import { buildDeterministicGridBrief } from "@/lib/sitemap-optimizer/grid-deterministic-brief";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

const makeRow = (): SitemapOptimizerPostRow => ({
  postId: "csv:1",
  url: "https://www.kwbllp.com/2025/01/01/auto-repair-success/",
  collection: "grid_csv",
  title: "Auto Repair Success",
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
  gridTopicTag: "auto_repair_business",
  gridTagLabel: "Auto repair business",
  gridIntent: "mixed",
});

describe("buildDeterministicGridBrief", () => {
  it("builds a destination that differs from a single source URL path", () => {
    const row = makeRow();
    const rowById = new Map([[row.postId, row]]);
    const cluster: SitemapOptimizerCluster = {
      clusterId: "c1",
      label: "Auto repair",
      intent: "mixed",
      memberPostIds: [row.postId],
      confidence: "high",
      rationale: "",
    };
    const brief = buildDeterministicGridBrief(cluster, rowById);
    expect(brief?.lockedDestinationUrl).toBeTruthy();
    const dest = new URL(brief!.lockedDestinationUrl!).pathname.replace(/\/+$/, "/");
    const src = new URL(row.url).pathname.replace(/\/+$/, "/");
    expect(dest).not.toBe(src);
  });
});
