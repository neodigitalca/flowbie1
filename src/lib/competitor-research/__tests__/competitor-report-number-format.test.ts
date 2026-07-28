import { describe, expect, it } from "vitest";
import { formatCompetitorMetricCell } from "@/lib/competitor-research/competitor-report-number-format";

describe("formatCompetitorMetricCell", () => {
  it("returns hyphen for nullish or non-finite", () => {
    expect(formatCompetitorMetricCell(null)).toBe("-");
    expect(formatCompetitorMetricCell(undefined)).toBe("-");
    expect(formatCompetitorMetricCell(Number.NaN)).toBe("-");
  });

  it("rounds to integer and uses en-US grouping", () => {
    expect(formatCompetitorMetricCell(15450)).toBe("15,450");
    expect(formatCompetitorMetricCell(16.529999999999998)).toBe("17");
    expect(formatCompetitorMetricCell(0.56)).toBe("1");
    expect(formatCompetitorMetricCell(52)).toBe("52");
  });
});
