import { describe, expect, it } from "vitest";
import {
  MATURITY_KEEP_RATIONALE_IMMATURE,
  MATURITY_KEEP_RATIONALE_UNKNOWN,
  daysSincePublish,
  isContentMatureForConsolidation,
  isImmatureKeepRationale,
  markImmatureRowsAsKeep,
  partitionRowsByContentMaturity,
  SITEMAP_OPTIMIZER_CONTENT_MATURITY_DAYS,
} from "@/lib/sitemap-optimizer/content-maturity-gate";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function row(publishedAtGmt?: string): SitemapOptimizerPostRow {
  return {
    postId: "wp:1",
    url: "https://example.com/service-area/test/",
    collection: "entity",
    title: "Test",
    keyword: "",
    meta: "",
    contentSnippet: "",
    publishedAtGmt,
    gscQueries: [],
    gscFetched: false,
  };
}

describe("content-maturity-gate", () => {
  const analyzedAt = "2026-06-18T12:00:00.000Z";

  it("treats content published 91 days ago as mature", () => {
    const published = new Date("2026-06-18T12:00:00.000Z");
    published.setUTCDate(published.getUTCDate() - (SITEMAP_OPTIMIZER_CONTENT_MATURITY_DAYS + 1));
    const r = row(published.toISOString());
    expect(isContentMatureForConsolidation(r, analyzedAt)).toBe(true);
    expect(daysSincePublish(r.publishedAtGmt, analyzedAt)).toBeGreaterThanOrEqual(91);
  });

  it("treats content published 89 days ago as immature", () => {
    const published = new Date("2026-06-18T12:00:00.000Z");
    published.setUTCDate(published.getUTCDate() - (SITEMAP_OPTIMIZER_CONTENT_MATURITY_DAYS - 1));
    const r = row(published.toISOString());
    expect(isContentMatureForConsolidation(r, analyzedAt)).toBe(false);
  });

  it("missing publish date is eligible for triage (mature), not auto-kept", () => {
    expect(isContentMatureForConsolidation(row(), analyzedAt)).toBe(true);
    const { mature, immature } = partitionRowsByContentMaturity([row()], analyzedAt);
    expect(mature).toHaveLength(1);
    expect(immature).toHaveLength(0);
  });

  it("partitions mature and immature rows", () => {
    const matureDate = new Date(analyzedAt);
    matureDate.setUTCDate(matureDate.getUTCDate() - 120);
    const immatureDate = new Date(analyzedAt);
    immatureDate.setUTCDate(immatureDate.getUTCDate() - 10);
    const { mature, immature } = partitionRowsByContentMaturity(
      [row(matureDate.toISOString()), row(immatureDate.toISOString()), row()],
      analyzedAt,
    );
    expect(mature).toHaveLength(2);
    expect(immature).toHaveLength(1);
  });

  it("marks known immature rows as keep with immature rationale", () => {
    const immatureDate = new Date(analyzedAt);
    immatureDate.setUTCDate(immatureDate.getUTCDate() - 10);
    const marked = markImmatureRowsAsKeep([row(immatureDate.toISOString())]);
    expect(marked[0]?.gscTriageRationale).toBe(MATURITY_KEEP_RATIONALE_IMMATURE);
  });

  it("detects immature keep rationales", () => {
    expect(isImmatureKeepRationale(MATURITY_KEEP_RATIONALE_IMMATURE)).toBe(true);
    expect(isImmatureKeepRationale(MATURITY_KEEP_RATIONALE_UNKNOWN)).toBe(true);
    expect(isImmatureKeepRationale("Strong relative traffic.")).toBe(false);
  });
});
