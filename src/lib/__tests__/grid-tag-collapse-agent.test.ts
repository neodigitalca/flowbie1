import { describe, expect, it } from "vitest";
import {
  distinctTopicTagsFromRows,
  collapseGridTopicTags,
} from "@/lib/sitemap-optimizer/grid-tag-collapse-agent";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const row = (id: string, tag: string): SitemapOptimizerPostRow => ({
  postId: `csv:${id}`,
  url: `https://example.com/p/${id}/`,
  collection: "grid_csv",
  title: `Page ${id}`,
  keyword: "",
  meta: "",
  contentSnippet: "",
  gscQueries: [],
  gscFetched: true,
  gridTopicTag: tag,
  gridTagLabel: tag,
  gridIntent: "mixed",
});

describe("grid-tag-collapse-agent", () => {
  it("distinctTopicTagsFromRows counts unique tags", () => {
    const rows = [row("1", "alpha"), row("2", "alpha"), row("3", "beta")];
    const distinct = distinctTopicTagsFromRows(rows);
    expect(distinct).toHaveLength(2);
    expect(distinct.find((d) => d.topicTag === "alpha")?.urlCount).toBe(2);
  });

  it("skips collapse when already at or below 50 tags", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => row(String(i), `tag_${i}`));
    const out = await collapseGridTopicTags(rows, "key");
    expect(out).toBe(rows);
  });
});
