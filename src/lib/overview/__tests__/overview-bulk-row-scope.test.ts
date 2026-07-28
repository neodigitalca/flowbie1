import { describe, expect, it } from "vitest";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  overviewBulkRowIndices,
  overviewBulkScopeUrlKeysFromRows,
  overviewRowInBulkScope,
  overviewRowsInBulkScope,
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
});
