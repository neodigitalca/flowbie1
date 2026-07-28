import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  groupClustersByTopicTag,
  runGridBlogBriefByTopicAgent,
} from "@/lib/sitemap-optimizer/grid-blog-brief-by-topic-agent";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

vi.mock("@/lib/competitor-research/competitor-report-openrouter", () => ({
  callOpenRouterChatCompletion: vi.fn(),
}));

vi.mock("@/lib/optimization-settings-storage", () => ({
  getResearchModel: () => "test-model",
}));

const row = (
  id: string,
  topic: string,
  url: string,
): SitemapOptimizerPostRow => ({
  postId: `csv:${id}`,
  url,
  collection: "grid_csv",
  title: `Page ${id}`,
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
  gridTopicTag: topic,
  gridTagLabel: topic,
  gridIntent: "mixed",
});

const cluster = (id: string, memberIds: string[]): SitemapOptimizerCluster => ({
  clusterId: id,
  label: `Group ${id}`,
  intent: "mixed",
  memberPostIds: memberIds,
  confidence: "high",
  rationale: "",
});

describe("groupClustersByTopicTag", () => {
  it("groups clusters by topic tag", () => {
    const rows = [
      row("1", "quickbooks", "https://example.com/2025/01/01/qb-one/"),
      row("2", "quickbooks", "https://example.com/2025/01/02/qb-two/"),
      row("3", "backups", "https://example.com/2025/01/03/backup/"),
    ];
    const rowById = new Map(rows.map((r) => [r.postId, r]));
    const sections = groupClustersByTopicTag(
      [cluster("c1", ["csv:1", "csv:2"]), cluster("c2", ["csv:3"])],
      rowById,
    );
    expect(sections).toHaveLength(2);
    const qb = sections.find((s) => s.topicTag === "quickbooks");
    expect(qb?.clusters).toHaveLength(1);
    expect(qb?.clusters[0]?.memberPostIds).toHaveLength(2);
  });
});

describe("runGridBlogBriefByTopicAgent", () => {
  beforeEach(() => {
    vi.mocked(callOpenRouterChatCompletion).mockReset();
  });

  it("fills missing briefs deterministically and calls OpenRouter per topic", async () => {
    const rows = [
      row("1", "quickbooks", "https://example.com/2025/01/01/qb-one/"),
      row("2", "quickbooks", "https://example.com/2025/01/02/qb-two/"),
      row("3", "backups", "https://example.com/2025/01/03/backup/"),
    ];
    vi.mocked(callOpenRouterChatCompletion).mockImplementation(async () => ({
      content: JSON.stringify({ briefs: [] }),
      raw: {},
    }));

    const result = await runGridBlogBriefByTopicAgent(
      {
        clusters: [cluster("c1", ["csv:1", "csv:2"]), cluster("c2", ["csv:3"])],
        singletons: [],
      },
      rows,
      "test-key",
    );

    expect(callOpenRouterChatCompletion).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result.every((b) => b.lockedDestinationUrl?.startsWith("https://"))).toBe(true);
  });
});
