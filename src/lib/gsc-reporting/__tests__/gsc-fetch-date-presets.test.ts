import { describe, expect, it } from "vitest";
import {
  computeCompareRangesForPreset,
  computeMomCompareRanges,
  computeTrailingFullMonthsCompareRanges,
  formatGscReportFullDateRange,
  formatLocalYmd,
  formatTrailingMonthsTriggerLabel,
  parseTrailingMonthCount,
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

describe("computeTrailingFullMonthsCompareRanges", () => {
  it("uses last 3 full months vs the 3 before", () => {
    const r = computeTrailingFullMonthsCompareRanges(3, REF);
    expect(r.primary.startDate).toBe("2026-01-01");
    expect(r.primary.endDate).toBe("2026-03-31");
    expect(r.compare.startDate).toBe("2025-10-01");
    expect(r.compare.endDate).toBe("2025-12-31");
  });

  it("uses last 6 full months vs the 6 before", () => {
    const r = computeTrailingFullMonthsCompareRanges(6, REF);
    expect(r.primary.startDate).toBe("2025-10-01");
    expect(r.primary.endDate).toBe("2026-03-31");
    expect(r.compare.startDate).toBe("2025-04-01");
    expect(r.compare.endDate).toBe("2025-09-30");
  });

  it("uses last 12 full months vs the 12 before", () => {
    const r = computeTrailingFullMonthsCompareRanges(12, REF);
    expect(r.primary.startDate).toBe("2025-04-01");
    expect(r.primary.endDate).toBe("2026-03-31");
    expect(r.compare.startDate).toBe("2024-04-01");
    expect(r.compare.endDate).toBe("2025-03-31");
  });

  it("spans the year boundary in January", () => {
    const r = computeTrailingFullMonthsCompareRanges(3, new Date(2026, 0, 15));
    expect(r.primary.startDate).toBe("2025-10-01");
    expect(r.primary.endDate).toBe("2025-12-31");
    expect(r.compare.startDate).toBe("2025-07-01");
    expect(r.compare.endDate).toBe("2025-09-30");
  });

  it("uses last 2 full months vs the 2 before", () => {
    const r = computeTrailingFullMonthsCompareRanges(2, REF);
    expect(r.primary.startDate).toBe("2026-02-01");
    expect(r.primary.endDate).toBe("2026-03-31");
    expect(r.compare.startDate).toBe("2025-12-01");
    expect(r.compare.endDate).toBe("2026-01-31");
  });
});

describe("parseTrailingMonthCount", () => {
  it("accepts integers from 1 to 36", () => {
    expect(parseTrailingMonthCount("1")).toBe(1);
    expect(parseTrailingMonthCount("4")).toBe(4);
    expect(parseTrailingMonthCount("36")).toBe(36);
  });

  it("rejects empty, zero, and out-of-range values", () => {
    expect(parseTrailingMonthCount("")).toBeNull();
    expect(parseTrailingMonthCount("0")).toBeNull();
    expect(parseTrailingMonthCount("37")).toBeNull();
    expect(parseTrailingMonthCount("2.5")).toBeNull();
  });

  it("formats the trigger label", () => {
    expect(formatTrailingMonthsTriggerLabel(4)).toBe("4 months vs 4");
  });
});

describe("computeCompareRangesForPreset trailing months", () => {
  it("maps m3/m6/m12 to trailing full-month windows", () => {
    expect(computeCompareRangesForPreset("m3", REF)).toEqual(computeTrailingFullMonthsCompareRanges(3, REF));
    expect(computeCompareRangesForPreset("m6", REF)).toEqual(computeTrailingFullMonthsCompareRanges(6, REF));
    expect(computeCompareRangesForPreset("m12", REF)).toEqual(computeTrailingFullMonthsCompareRanges(12, REF));
  });
});

describe("formatLocalYmd", () => {
  it("formats local calendar date", () => {
    expect(formatLocalYmd(REF)).toBe("2026-04-13");
  });
});

describe("formatGscReportFullDateRange", () => {
  it("writes the full start and end dates", () => {
    expect(formatGscReportFullDateRange("2026-04-01", "2026-04-30")).toBe("April 1, 2026 to April 30, 2026");
  });

  it("keeps both months when the range crosses months", () => {
    expect(formatGscReportFullDateRange("2026-03-15", "2026-04-12")).toBe("March 15, 2026 to April 12, 2026");
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
