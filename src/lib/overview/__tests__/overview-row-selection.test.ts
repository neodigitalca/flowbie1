import { describe, expect, it } from "vitest";
import {
  applyOverviewPageSelection,
  applyOverviewRangeSelection,
  overviewDisplayRowSelectionKeys,
  overviewPageSelectionState,
  overviewRowSelectionKey,
  pruneOverviewRowSelection,
  toggleOverviewRowSelectionKey,
} from "@/lib/overview/overview-row-selection";

describe("overview row selection", () => {
  it("toggles a URL key on and off", () => {
    const empty = new Set<string>();
    const added = toggleOverviewRowSelectionKey(empty, "https://example.com/a/");
    expect(added.has(overviewRowSelectionKey("https://example.com/a/"))).toBe(true);
    const removed = toggleOverviewRowSelectionKey(added, "https://example.com/a/");
    expect(removed.has(overviewRowSelectionKey("https://example.com/a/"))).toBe(false);
  });

  it("ignores blank URLs when toggling", () => {
    const selected = new Set<string>(["https://example.com/a/"]);
    expect(toggleOverviewRowSelectionKey(selected, "")).toBe(selected);
  });

  it("prunes keys that leave the live display set", () => {
    const a = overviewRowSelectionKey("https://example.com/a/");
    const b = overviewRowSelectionKey("https://example.com/b/");
    const selected = new Set([a, b]);
    const pruned = pruneOverviewRowSelection(selected, new Set([a]));
    expect([...pruned]).toEqual([a]);
  });

  it("returns the same set when prune drops nothing", () => {
    const a = overviewRowSelectionKey("https://example.com/a/");
    const selected = new Set([a]);
    expect(pruneOverviewRowSelection(selected, new Set([a]))).toBe(selected);
  });

  it("collects display keys and skips empty URLs", () => {
    expect(
      overviewDisplayRowSelectionKeys([
        { url: "https://example.com/a/" },
        { url: "" },
        { url: "https://example.com/b/" },
      ]),
    ).toEqual([
      overviewRowSelectionKey("https://example.com/a/"),
      overviewRowSelectionKey("https://example.com/b/"),
    ]);
  });

  it("reports none, some, and all selected for the current page", () => {
    const keys = [
      overviewRowSelectionKey("https://example.com/a/"),
      overviewRowSelectionKey("https://example.com/b/"),
    ];
    expect(overviewPageSelectionState(new Set(), keys)).toEqual({
      allSelected: false,
      someSelected: false,
    });
    expect(overviewPageSelectionState(new Set([keys[0]!]), keys)).toEqual({
      allSelected: false,
      someSelected: true,
    });
    expect(overviewPageSelectionState(new Set(keys), keys)).toEqual({
      allSelected: true,
      someSelected: false,
    });
  });

  it("selects and deselects the current page without dropping other pages", () => {
    const page = [
      overviewRowSelectionKey("https://example.com/a/"),
      overviewRowSelectionKey("https://example.com/b/"),
    ];
    const other = overviewRowSelectionKey("https://example.com/c/");
    const selected = new Set([other]);
    const pageOn = applyOverviewPageSelection(selected, page, true);
    expect(pageOn.has(other)).toBe(true);
    expect(pageOn.has(page[0]!)).toBe(true);
    expect(pageOn.has(page[1]!)).toBe(true);
    const pageOff = applyOverviewPageSelection(pageOn, page, false);
    expect(pageOff.has(other)).toBe(true);
    expect(pageOff.has(page[0]!)).toBe(false);
    expect(pageOff.has(page[1]!)).toBe(false);
  });

  it("treats a missing selected set as none selected", () => {
    expect(overviewPageSelectionState(undefined, ["https://example.com/a/"])).toEqual({
      allSelected: false,
      someSelected: false,
    });
  });

  it("shift-range selects inclusive keys in display order", () => {
    const keys = [
      overviewRowSelectionKey("https://example.com/a/"),
      overviewRowSelectionKey("https://example.com/b/"),
      overviewRowSelectionKey("https://example.com/c/"),
      overviewRowSelectionKey("https://example.com/d/"),
    ];
    const other = overviewRowSelectionKey("https://example.com/keep/");
    const ranged = applyOverviewRangeSelection(new Set([other]), keys, keys[0]!, keys[2]!);
    expect(ranged.has(other)).toBe(true);
    expect(ranged.has(keys[0]!)).toBe(true);
    expect(ranged.has(keys[1]!)).toBe(true);
    expect(ranged.has(keys[2]!)).toBe(true);
    expect(ranged.has(keys[3]!)).toBe(false);
  });
});
