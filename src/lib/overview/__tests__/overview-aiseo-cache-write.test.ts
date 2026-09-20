import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import { createEmptyOverviewRow } from "@/lib/overview/overview-row-helpers";
import {
  applyAiseoHtmlToRowsRef,
  createAiseoCacheWriteAccumulator,
  finalizeAiseoCacheWriteForUpload,
} from "@/lib/overview/overview-aiseo-cache-write";

const mergeMock = vi.fn();

vi.mock("@/lib/local-analysis/entity-site-warm-cache", () => ({
  getEntitySiteWarmCacheIfReady: () => ({
    bulkInventoryRows: [
      { url: "https://example.com/a/", fields: { content: "<p>old</p>" } },
      { url: "https://example.com/b/", fields: { content: "<p>b</p>" } },
    ],
  }),
  mergeSitePrefetchBulkInventoryRows: (...args: unknown[]) => mergeMock(...args),
}));

const site = { id: "wp-1", name: "Test", siteUrl: "https://example.com" } as WordPressSite;

describe("createAiseoCacheWriteAccumulator", () => {
  beforeEach(() => {
    mergeMock.mockClear();
  });
  it("merges pending html into warm cache on flush", () => {
    const acc = createAiseoCacheWriteAccumulator(site);
    acc.push("https://example.com/a/", "<p>new body</p>");
    expect(acc.size()).toBe(1);
    acc.flush();
    expect(mergeMock).toHaveBeenCalledTimes(1);
    const merged = mergeMock.mock.calls[0][1] as Array<{ url?: string; fields?: { content?: string } }>;
    expect(merged[0]?.fields?.content).toBe("<p>new body</p>");
    expect(acc.size()).toBe(0);
  });

  it("applyToRows sets postContentOptimized for upload", () => {
    const acc = createAiseoCacheWriteAccumulator(site);
    acc.push("https://example.com/a/", "<p>upload me</p>");
    const rows = [createEmptyOverviewRow("https://example.com/a/")];
    const next = acc.applyToRows(rows);
    expect(next[0]?.postContentOptimized).toBe("<p>upload me</p>");
  });

  it("applyAiseoHtmlToRowsRef matches a trailing-slash URL change after refresh", () => {
    const rowsRef = { current: [createEmptyOverviewRow("https://example.com/a")] };
    applyAiseoHtmlToRowsRef(rowsRef, "https://example.com/a/", "<p>from refresh</p>");
    expect(rowsRef.current[0]?.postContentOptimized).toBe("<p>from refresh</p>");
  });

  it("finalize writes rows then flushes cache", () => {
    const acc = createAiseoCacheWriteAccumulator(site);
    acc.push("https://example.com/a/", "<p>upload me</p>");
    const rowsRef = { current: [createEmptyOverviewRow("https://example.com/a/")] };
    finalizeAiseoCacheWriteForUpload(acc, rowsRef);
    expect(rowsRef.current[0]?.postContentOptimized).toBe("<p>upload me</p>");
    expect(mergeMock).toHaveBeenCalledTimes(1);
  });
});
