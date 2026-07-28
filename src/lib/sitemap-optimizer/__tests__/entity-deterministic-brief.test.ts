import { describe, expect, it } from "vitest";
import { buildDeterministicEntityBrief } from "@/lib/sitemap-optimizer/entity-deterministic-brief";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function entityRow(url: string): SitemapOptimizerPostRow {
  return {
    postId: `wp:${url}`,
    url,
    collection: "service-area",
    title: "Charleswood Blinds",
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
  };
}

describe("entity-deterministic-brief", () => {
  it("keeps destination under service-area path", () => {
    const members = [
      entityRow("https://example.com/service-area/charleswood-blinds/"),
      entityRow("https://example.com/service-area/transcona-blinds/"),
    ];
    const rowById = new Map(members.map((r) => [r.postId, r]));
    const brief = buildDeterministicEntityBrief(
      {
        clusterId: "entity-compress-1-1",
        label: "Winnipeg blinds",
        intent: "local",
        memberPostIds: members.map((m) => m.postId),
        confidence: "high",
        rationale: "test",
      },
      rowById,
      { forceBlogPermalink: false },
    );
    expect(brief?.lockedDestinationUrl).toMatch(/service-area/i);
    expect(brief?.lockedDestinationUrl).not.toMatch(/\/blog\//i);
  });
});
