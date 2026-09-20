import { describe, expect, it, vi } from "vitest";
import { createEmptyOverviewRow } from "@/lib/overview/overview-row-helpers";
import {
  overviewBulkRowIndices,
  resolveOverviewBulkScopeUrlKeys,
} from "@/lib/overview/overview-bulk-row-scope";
import {
  isOverviewKeywordRunKind,
  writeOverviewKeywordsOneAtATime,
} from "@/lib/overview/overview-keywords-harness-run";

describe("isOverviewKeywordRunKind", () => {
  it("matches only keyword harness run kinds", () => {
    expect(isOverviewKeywordRunKind("contentKw")).toBe(true);
    expect(isOverviewKeywordRunKind("entityKw")).toBe(true);
    expect(isOverviewKeywordRunKind("wpUpload")).toBe(false);
    expect(isOverviewKeywordRunKind(undefined)).toBe(false);
  });
});


describe("writeOverviewKeywordsOneAtATime", () => {
  it("writes one keyword then the next", async () => {
    const order: number[] = [];
    const rows = [
      createEmptyOverviewRow("https://example.com/a/"),
      createEmptyOverviewRow("https://example.com/b/"),
    ];
    const deriveKeyword = vi.fn(async (index: number) => {
      order.push(index);
      return index === 0 ? "conversion optimization" : "website design";
    });
    const updateRow = vi.fn();

    const stats = await writeOverviewKeywordsOneAtATime({
      indices: [0, 1],
      rowsRef: { current: rows },
      deriveKeyword,
      updateRow,
    });

    expect(order).toEqual([0, 1]);
    expect(deriveKeyword).toHaveBeenCalledTimes(2);
    expect(stats).toEqual({ ok: 2, failed: 0 });
    expect(updateRow).toHaveBeenCalledWith(0, {
      focusKeyword: "conversion optimization",
      status: "idle",
    });
    expect(updateRow).toHaveBeenCalledWith(1, {
      focusKeyword: "website design",
      status: "idle",
    });
  });

  it("marks a row error and continues", async () => {
    const rows = [
      createEmptyOverviewRow("https://example.com/a/"),
      createEmptyOverviewRow("https://example.com/b/"),
    ];
    const deriveKeyword = vi.fn(async (index: number) => (index === 0 ? null : "website design"));
    const updateRow = vi.fn();

    const stats = await writeOverviewKeywordsOneAtATime({
      indices: [0, 1],
      rowsRef: { current: rows },
      deriveKeyword,
      updateRow,
    });

    expect(stats).toEqual({ ok: 1, failed: 1 });
    expect(updateRow).toHaveBeenCalledWith(0, { status: "error" });
    expect(updateRow).toHaveBeenCalledWith(1, {
      focusKeyword: "website design",
      status: "idle",
    });
  });

  it("runs every visible row when none are selected", async () => {
    const rows = [
      createEmptyOverviewRow("https://example.com/a/"),
      createEmptyOverviewRow("https://example.com/b/"),
      createEmptyOverviewRow("https://example.com/c/"),
    ];
    const scope = resolveOverviewBulkScopeUrlKeys(new Set(), rows);
    const indices = overviewBulkRowIndices(rows, scope);
    const deriveKeyword = vi.fn(async (index: number) => `kw ${index}`);
    const updateRow = vi.fn();

    const stats = await writeOverviewKeywordsOneAtATime({
      indices,
      rowsRef: { current: rows },
      deriveKeyword,
      updateRow,
    });

    expect(indices).toEqual([0, 1, 2]);
    expect(deriveKeyword).toHaveBeenCalledTimes(3);
    expect(stats.ok).toBe(3);
    expect(updateRow).toHaveBeenCalledWith(2, { focusKeyword: "kw 2", status: "idle" });
  });
});
