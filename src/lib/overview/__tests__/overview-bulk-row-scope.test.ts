import { describe, expect, it } from "vitest";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  overviewBulkRowIndices,
  overviewBulkRowIndicesForDisplayOrder,
  overviewBulkScopeUrlKeysFromRows,
  overviewRowInBulkScope,
  overviewRowsInBulkScope,
  resolveOverviewBulkScopeUrlKeys,
} from "@/lib/overview/overview-bulk-row-scope";

function row(url: string): OverviewRow {
  return {
    url,
    title: "",
    metaDescription: "",
    aiTitle: "",
    aiMeta: "",
    status: "idle",
  };
}

describe("overview bulk row scope", () => {
  it("scopes indices to display rows", () => {
    const rows = [
      row("https://example.com/a/"),
      row("https://example.com/b/"),
      row("https://example.com/c/"),
    ];
    const scope = overviewBulkScopeUrlKeysFromRows([rows[0]!, rows[2]!]);
    expect(overviewBulkRowIndices(rows, scope)).toEqual([0, 2]);
    expect(overviewRowsInBulkScope(rows, scope).map((r) => r.url)).toEqual([
      "https://example.com/a/",
      "https://example.com/c/",
    ]);
    expect(overviewRowInBulkScope("https://example.com/b/", scope)).toBe(false);
  });

  it("orders bulk indices by visible grid rows", () => {
    const rows = [
      row("https://example.com/storage-first/"),
      row("https://example.com/grid-first/"),
      row("https://example.com/grid-second/"),
    ];
    const displayRows = [rows[1]!, rows[2]!, rows[0]!];
    const scope = overviewBulkScopeUrlKeysFromRows(displayRows);
    expect(overviewBulkRowIndices(rows, scope)).toEqual([0, 1, 2]);
    expect(overviewBulkRowIndicesForDisplayOrder(rows, displayRows, scope)).toEqual([1, 2, 0]);
  });

  it("treats empty selection as every visible row", () => {
    const rows = [
      row("https://example.com/a/"),
      row("https://example.com/b/"),
      row("https://example.com/c/"),
    ];
    const scope = resolveOverviewBulkScopeUrlKeys(new Set(), rows);
    expect(scope).toEqual(overviewBulkScopeUrlKeysFromRows(rows));
    expect(overviewBulkRowIndices(rows, scope)).toEqual([0, 1, 2]);
  });

  it("keeps an explicit selection and ignores other visible rows", () => {
    const rows = [
      row("https://example.com/a/"),
      row("https://example.com/b/"),
      row("https://example.com/c/"),
    ];
    const selected = overviewBulkScopeUrlKeysFromRows([rows[1]!]);
    const scope = resolveOverviewBulkScopeUrlKeys(selected, rows);
    expect(scope).toEqual(selected);
    expect(overviewBulkRowIndices(rows, scope)).toEqual([1]);
  });

  it("returns an empty scope when nothing is visible", () => {
    expect(resolveOverviewBulkScopeUrlKeys(new Set(), []).size).toBe(0);
  });
});
