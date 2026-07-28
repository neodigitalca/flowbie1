import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  rowsFromSemrushCsvText,
  extractRawTableRows,
  guessCsvDelimiter,
} = require("../semrush/semrush-table-parse.cjs");
const {
  normalizeCompetitorRow,
  parseSemrushMetricNumber,
} = require("../semrush/semrush-organic-competitors-parse.cjs");

describe("guessCsvDelimiter", () => {
  it("prefers semicolon when dominant", () => {
    expect(guessCsvDelimiter("Dn;Cr;Np;Or")).toBe(";");
    expect(guessCsvDelimiter("a,b,c,d")).toBe(",");
  });
});

describe("rowsFromSemrushCsvText", () => {
  it("parses semicolon-separated Semrush CSV", () => {
    const csv = ["Dn;Cr;Np;Or;Ot;Oc;Ad", "example.com;0.5;10;100;50;200;5"].join("\n");
    const rows = rowsFromSemrushCsvText(csv);
    expect(rows.length).toBe(1);
    expect(rows[0].dn).toBe("example.com");
    expect(rows[0].or).toBe("100");
  });

  it("parses comma-separated CSV", () => {
    const csv = ["dn,or,oc", "foo.com,1,2"].join("\n");
    const rows = rowsFromSemrushCsvText(csv);
    expect(rows[0].dn).toBe("foo.com");
    expect(rows[0].or).toBe("1");
  });
});

describe("normalizeCompetitorRow", () => {
  it("maps verbose headers and currency", () => {
    const row = normalizeCompetitorRow({
      Domain: "x.com",
      "Organic Traffic": "1,234",
      "Traffic Value": "$99.50",
      "Organic Keywords": "500",
    });
    expect(row?.domain).toBe("x.com");
    expect(row?.organicTraffic).toBe(1234);
    expect(row?.trafficCost).toBe(99.5);
    expect(row?.organicKeywords).toBe(500);
  });
});

describe("parseSemrushMetricNumber", () => {
  it("strips currency and percent", () => {
    expect(parseSemrushMetricNumber("$1,234.5")).toBe(1234.5);
    expect(parseSemrushMetricNumber("42%")).toBe(42);
  });
});

describe("extractRawTableRows", () => {
  it("flattens nested metric objects into string cells", () => {
    const parsed = {
      rows: [{ dn: "a.com", or: { value: 99 }, oc: 10 }],
    };
    const rows = extractRawTableRows(parsed);
    expect(rows[0].dn).toBe("a.com");
    expect(rows[0].or).toBe("99");
  });

  it("does not return early when rows is an empty array - finds nested table data", () => {
    const parsed = {
      rows: [],
      result: [{ ph: "dentist edmonton", nq: "100", tr: "10", po: "3" }],
    };
    const rows = extractRawTableRows(parsed);
    expect(rows.length).toBe(1);
    expect(rows[0].ph).toBe("dentist edmonton");
  });
});
