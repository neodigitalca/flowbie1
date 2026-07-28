import { describe, expect, it } from "vitest";
import { gridClusterGroupKey } from "@/lib/sitemap-optimizer/grid-tag-key";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const row = (topic: string, geo = ""): Pick<SitemapOptimizerPostRow, "gridTopicTag" | "gridGeoTag"> => ({
  gridTopicTag: topic,
  gridGeoTag: geo,
});

describe("grid-tag-key", () => {
  it("same topic and geo share a bucket key", () => {
    expect(gridClusterGroupKey(row("quickbooks_online", "yellowknife"))).toBe(
      gridClusterGroupKey(row("quickbooks_online", "yellowknife")),
    );
  });

  it("different topics never share a key", () => {
    expect(gridClusterGroupKey(row("quickbooks_online"))).not.toBe(
      gridClusterGroupKey(row("directors_liability")),
    );
  });
});
