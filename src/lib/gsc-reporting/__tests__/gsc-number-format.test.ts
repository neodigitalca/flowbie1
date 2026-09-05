import { describe, expect, it } from "vitest";
import {
  csvNumberCell,
  formatCanadianNumber,
  parseCanadianNumber,
  splitCsvLine,
} from "../gsc-number-format";

describe("formatCanadianNumber", () => {
  it("groups thousands and omits .00 on whole values", () => {
    expect(formatCanadianNumber(253441)).toBe("253,441");
    expect(formatCanadianNumber(12)).toBe("12");
    expect(formatCanadianNumber(0)).toBe("0");
  });

  it("keeps two decimal places when the fraction is non-zero", () => {
    expect(formatCanadianNumber(12.5)).toBe("12.50");
    expect(formatCanadianNumber(8.4)).toBe("8.40");
    expect(formatCanadianNumber(1000.01)).toBe("1,000.01");
  });

  it("does not keep trailing zeros after rounding to a whole number", () => {
    expect(formatCanadianNumber(12.001, 2)).toBe("12");
  });
});

describe("parseCanadianNumber", () => {
  it("reads grouped and plain counts", () => {
    expect(parseCanadianNumber("253,441")).toBe(253441);
    expect(parseCanadianNumber("26631")).toBe(26631);
    expect(parseCanadianNumber("12.50")).toBe(12.5);
    expect(parseCanadianNumber("10%")).toBe(10);
  });
});

describe("csvNumberCell", () => {
  it("quotes grouped values", () => {
    expect(csvNumberCell(3410)).toBe('"3,410"');
    expect(csvNumberCell(112)).toBe("112");
  });
});

describe("splitCsvLine", () => {
  it("keeps quoted commas as one cell", () => {
    expect(splitCsvLine('Total impressions,"26,631","24,546",+8.5%')).toEqual([
      "Total impressions",
      "26,631",
      "24,546",
      "+8.5%",
    ]);
  });
});
