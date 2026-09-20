import { describe, expect, it, vi } from "vitest";
import {
  clearBulkActionSlice,
  hasActiveBulkActionProgress,
  isActiveBulkProgressSlice,
  pickActiveBulkProgressSlice,
} from "@/lib/overview/overview-bulk-inline-status";

describe("isActiveBulkProgressSlice", () => {
  it("is idle when completed catches total", () => {
    expect(isActiveBulkProgressSlice({ total: 30, completed: 30 })).toBe(false);
  });

  it("is active while rows remain", () => {
    expect(isActiveBulkProgressSlice({ total: 30, completed: 29 })).toBe(true);
  });
});

describe("hasActiveBulkActionProgress", () => {
  it("ignores a finished research slice", () => {
    expect(hasActiveBulkActionProgress({ research: { total: 30, completed: 30 } })).toBe(false);
  });

  it("detects an in-progress research slice", () => {
    expect(hasActiveBulkActionProgress({ research: { total: 30, completed: 12 } })).toBe(true);
  });
});

describe("pickActiveBulkProgressSlice", () => {
  it("skips completed slices", () => {
    expect(
      pickActiveBulkProgressSlice({
        research: { total: 30, completed: 30 },
        aiTitle: { total: 5, completed: 2 },
      }),
    ).toEqual({ key: "aiTitle", slice: { total: 5, completed: 2 } });
  });

  it("returns null when every slice is finished", () => {
    expect(pickActiveBulkProgressSlice({ research: { total: 30, completed: 30 } })).toBeNull();
  });
});

describe("clearBulkActionSlice", () => {
  it("removes the finished key", () => {
    const setBulkActionProgress = vi.fn((updater) => updater({ research: { total: 30, completed: 30 } }));
    clearBulkActionSlice(setBulkActionProgress, "research");
    expect(setBulkActionProgress).toHaveBeenCalled();
    const next = setBulkActionProgress.mock.calls[0][0]({ research: { total: 30, completed: 30 } });
    expect(next.research).toBeUndefined();
  });
});
