import { describe, expect, it } from "vitest";
import {
  computeMomCompareRanges,
  formatLocalYmd,
  validateGscCompareFetchRanges,
} from "../gsc-fetch-date-presets";

/** Fixed "today" for deterministic tests - reporting MoM uses April as reference → primary March, compare February. */
const REF = new Date(2026, 3, 13);

describe("computeMomCompareRanges", () => {
  it("uses last full calendar month as primary and the month before as compare", () => {
    const r = computeMomCompareRanges(REF);
    expect(r.primary.startDate).toBe("2026-03-01");
    expect(r.primary.endDate).toBe("2026-03-31");
    expect(r.compare.startDate).toBe("2026-02-01");
    expect(r.compare.endDate).toBe("2026-02-28");
  });
});

describe("formatLocalYmd", () => {
  it("formats local calendar date", () => {
    expect(formatLocalYmd(REF)).toBe("2026-04-13");
  });
});

describe("validateGscCompareFetchRanges", () => {
  it("accepts two valid ordered ranges", () => {
    expect(
      validateGscCompareFetchRanges(
        { startDate: "2026-03-01", endDate: "2026-03-31" },
        { startDate: "2026-02-01", endDate: "2026-02-28" },
      ).ok,
    ).toBe(true);
  });

  it("rejects start >= end in either period", () => {
    expect(
      validateGscCompareFetchRanges(
        { startDate: "2026-03-01", endDate: "2026-03-01" },
        { startDate: "2026-02-01", endDate: "2026-02-28" },
      ).ok,
    ).toBe(false);
  });
});
