import { describe, expect, it } from "vitest";
import {
  buildGscSearchAnalyticsUrl,
  detectGscTableRowLinkKind,
  findGscDimensionColumnIndex,
  gscSearchAnalyticsQueryParamValue,
  inclusiveDayCountUtc,
  normalizeGscResourceIdForUi,
} from "../gsc-console-ui-url";

describe("normalizeGscResourceIdForUi", () => {
  it("adds trailing slash for URL-prefix properties", () => {
    expect(normalizeGscResourceIdForUi("https://example.com")).toBe("https://example.com/");
  });

  it("preserves sc-domain properties", () => {
    expect(normalizeGscResourceIdForUi("sc-domain:example.com")).toBe("sc-domain:example.com");
  });
});

describe("inclusiveDayCountUtc", () => {
  it("counts inclusive calendar days in UTC", () => {
    expect(inclusiveDayCountUtc("2025-01-01", "2025-01-03")).toBe(3);
    expect(inclusiveDayCountUtc("2025-01-01", "2025-01-01")).toBe(1);
  });
});

describe("gscSearchAnalyticsQueryParamValue", () => {
  it("prefixes ! for GSC row filter (idempotent if already present)", () => {
    expect(gscSearchAnalyticsQueryParamValue("ejh distribution")).toBe("!ejh distribution");
    expect(gscSearchAnalyticsQueryParamValue("!ejh distribution")).toBe("!ejh distribution");
  });
});

describe("buildGscSearchAnalyticsUrl", () => {
  it("uses fixed start/end, DAY granularity for partial-month spans, and query filter", () => {
    const u = buildGscSearchAnalyticsUrl({
      siteUrl: "https://example.com",
      range: { startDate: "2025-01-01", endDate: "2025-01-07" },
      query: "widgets",
    });
    expect(u).toContain("resource_id=https%3A%2F%2Fexample.com%2F");
    expect(u).toContain("time_granularity=DAY");
    expect(u).not.toContain("num_of_days=");
    expect(u).toContain("start_date=2025-01-01");
    expect(u).toContain("end_date=2025-01-07");
    expect(u).toContain("breakdown=query");
    expect(u).toContain("query=%21widgets");
    expect(u).not.toContain("breakdown=page");
    expect(u).not.toContain("page=");
  });

  it("uses MONTH granularity for a full calendar month range", () => {
    const u = buildGscSearchAnalyticsUrl({
      siteUrl: "https://example.com",
      range: { startDate: "2025-03-01", endDate: "2025-03-31" },
      query: "widgets",
    });
    expect(u).toContain("time_granularity=MONTH");
    expect(u).toContain("start_date=2025-03-01");
    expect(u).toContain("end_date=2025-03-31");
    expect(u).not.toContain("num_of_days=");
  });

  it("uses breakdown=page and page param when filtering by page; omits date params when range absent", () => {
    const u = buildGscSearchAnalyticsUrl({
      siteUrl: "https://example.com/",
      range: null,
      pageUrl: "https://example.com/p",
    });
    expect(u).toContain("resource_id=");
    expect(u).not.toContain("num_of_days=");
    expect(u).toContain("breakdown=page");
    expect(u).toContain("page=https%3A%2F%2Fexample.com%2Fp");
    expect(u).not.toContain("breakdown=query");
    expect(u).not.toContain("query=");
  });
});

describe("detectGscTableRowLinkKind", () => {
  it("detects queries and pages from filename and headers", () => {
    expect(detectGscTableRowLinkKind("Queries-from-API.csv", ["Query", "Clicks"])).toBe("query");
    expect(detectGscTableRowLinkKind("Queries-MoM.csv", ["Query", "Clicks (Mar 2026)"])).toBe("query");
    expect(detectGscTableRowLinkKind("Queries-current-period.csv", ["Query", "Clicks"])).toBe("query");
    expect(detectGscTableRowLinkKind("Queries-compare-period.csv", ["Query", "Clicks"])).toBe("query");
    expect(detectGscTableRowLinkKind("Pages-from-API.csv", ["Page", "Clicks"])).toBe("page");
    expect(detectGscTableRowLinkKind("Pages-MoM.csv", ["Page", "Clicks (Jan 2026)"])).toBe("page");
    expect(detectGscTableRowLinkKind("Pages-current-period.csv", ["Page", "Clicks"])).toBe("page");
    expect(detectGscTableRowLinkKind("Pages-compare-period.csv", ["Page", "Clicks"])).toBe("page");
    expect(detectGscTableRowLinkKind("GSC-sitemaps.csv", ["Path"])).toBe("none");
    expect(detectGscTableRowLinkKind("other.csv", ["URL"])).toBe("page");
  });
});

describe("findGscDimensionColumnIndex", () => {
  it("finds Query and Page columns", () => {
    expect(findGscDimensionColumnIndex(["Clicks", "Query", "Pos"], "query")).toBe(1);
    expect(findGscDimensionColumnIndex(["Page", "Clicks"], "page")).toBe(0);
    expect(findGscDimensionColumnIndex(["Clicks", "Queries", "Pos"], "query")).toBe(1);
  });
});
