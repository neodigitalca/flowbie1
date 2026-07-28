import { describe, expect, it } from "vitest";
import {
  collectRewriteSingletonIds,
  isWeakConsolidateCandidate,
} from "@/lib/sitemap-optimizer/entity-compression-pipeline-helpers";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function row(args: Partial<SitemapOptimizerPostRow>): SitemapOptimizerPostRow {
  return {
    postId: "wp:1",
    url: "https://example.com/service-area/test/",
    collection: "entity",
    title: "Test",
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: false,
    ...args,
  };
}

describe("entity compression singleton rewrite helpers", () => {
  it("flags consolidate disposition as weak", () => {
    expect(
      isWeakConsolidateCandidate(row({ gscDisposition: "consolidate", gscPageClicks: 10 }), 5, 5),
    ).toBe(true);
  });

  it("flags bottom-quartile metrics as weak", () => {
    expect(isWeakConsolidateCandidate(row({ gscPageClicks: 0, gscPageImpressions: 100 }), 5, 50)).toBe(
      true,
    );
  });

  it("collects rewrite singleton ids from cluster result", () => {
    const rowMap = new Map([
      ["a", row({ postId: "a", gscDisposition: "consolidate" })],
      ["b", row({ postId: "b", gscPageClicks: 100, gscPageImpressions: 1000 })],
    ]);
    const ids = collectRewriteSingletonIds({ clusters: [], singletons: ["a", "b"] }, rowMap, 5, 50);
    expect(ids).toEqual(["a"]);
  });
});
