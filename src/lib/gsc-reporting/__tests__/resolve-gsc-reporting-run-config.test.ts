import { describe, expect, it } from "vitest";
import { computeTrailingFullMonthsCompareRanges } from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import {
  gscComparePresetIdForTrailingCount,
  payloadForGscTrailingMonthCount,
  resolveGscComparePresetId,
  resolveGscReportingRunConfig,
  resolveGscTrailingMonthCount,
} from "@/lib/gsc-reporting/resolve-gsc-reporting-run-config";

describe("resolveGscReportingRunConfig", () => {
  it("defaults to mom when unset", () => {
    expect(resolveGscComparePresetId(null)).toBe("mom");
    expect(resolveGscReportingRunConfig(null)).toMatchObject({
      comparePreset: "mom",
      presetId: "mom",
    });
  });

  it("passes custom ranges when preset is custom_compare", () => {
    const ranges = {
      primary: { startDate: "2026-06-01", endDate: "2026-06-30" },
      compare: { startDate: "2026-05-01", endDate: "2026-05-31" },
    };
    const config = resolveGscReportingRunConfig({
      gscComparePresetId: "custom_compare",
      gscCompareRanges: ranges,
    });
    expect(config.presetId).toBe("custom_compare");
    expect(config.compareRanges).toEqual(ranges);
  });

  it("computes trailing 3-month ranges at run time", () => {
    expect(resolveGscComparePresetId({ gscComparePresetId: "m3" })).toBe("m3");
    const config = resolveGscReportingRunConfig({ gscComparePresetId: "m6" });
    expect(config.presetId).toBe("m6");
    expect(config.comparePreset).toBe("mom");
    expect(config.compareRanges?.primary.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(config.compareRanges?.compare.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("maps stored month count to N vs N ranges", () => {
    expect(resolveGscTrailingMonthCount({ gscComparePresetId: "m6" })).toBe(6);
    expect(gscComparePresetIdForTrailingCount(4)).toBe("custom_compare");
    const config = resolveGscReportingRunConfig({ gscTrailingMonthCount: 4 });
    expect(config.presetId).toBe("custom_compare");
    expect(config.comparePreset).toBe("mom");
    expect(config.compareRanges).toEqual(computeTrailingFullMonthsCompareRanges(4));
  });

  it("keeps year-over-year when no month count is stored", () => {
    expect(resolveGscReportingRunConfig({ gscComparePresetId: "yoy" })).toMatchObject({
      comparePreset: "yoy",
      presetId: "yoy",
    });
  });

  it("writes month-count payload without custom dates", () => {
    expect(payloadForGscTrailingMonthCount(1)).toEqual({
      gscTrailingMonthCount: 1,
      gscComparePresetId: "mom",
      comparePreset: "mom",
      gscCompareRanges: undefined,
    });
  });
});
