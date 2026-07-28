import { describe, expect, it } from "vitest";
import {
  gscSitePeriodTotalsToCsv,
  gscSiteTotalsMomComparisonCsv,
  gscSiteTotalsPctChangeVsPrior,
  gscSiteTotalsPreviousMonthToCsv,
} from "../gsc-reporting-fetch";

describe("gscSiteTotalsPreviousMonthToCsv", () => {
  it("exports metric rows for previous month scorecard", () => {
    const csv = gscSiteTotalsPreviousMonthToCsv({
      label: "March 2026",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      clicks: 112,
      impressions: 3410,
      ctr: 0.033,
      position: 14.7,
    });
    expect(csv).toContain("Total clicks,112");
    expect(csv).toContain("Total impressions,3410");
    expect(csv).toContain("March 2026");
    expect(csv).toContain("2026-03-01");
  });
});

describe("gscSitePeriodTotalsToCsv", () => {
  it("labels the period title in header", () => {
    const csv = gscSitePeriodTotalsToCsv(
      {
        label: "February 2026",
        startDate: "2026-02-01",
        endDate: "2026-02-28",
        clicks: 50,
        impressions: 2000,
        ctr: 0.025,
        position: 12,
      },
      "Period B",
    );
    expect(csv).toContain("Period B");
    expect(csv).toContain("February 2026");
    expect(csv).toContain("Total clicks,50");
  });
});

describe("gscSiteTotalsPctChangeVsPrior", () => {
  it("returns em dash when compare is zero", () => {
    expect(gscSiteTotalsPctChangeVsPrior(10, 0)).toBe(" - ");
  });

  it("formats signed percent with one decimal", () => {
    expect(gscSiteTotalsPctChangeVsPrior(110, 100)).toBe("+10.0%");
    expect(gscSiteTotalsPctChangeVsPrior(90, 100)).toBe("-10.0%");
  });
});

describe("gscSiteTotalsMomComparisonCsv", () => {
  const primary = {
    label: "March 2026",
    startDate: "2026-03-01",
    endDate: "2026-03-31",
    clicks: 110,
    impressions: 3600,
    ctr: 0.03,
    position: 13,
  };
  const compare = {
    label: "February 2026",
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    clicks: 100,
    impressions: 3000,
    ctr: 0.025,
    position: 14,
  };

  it("includes header and percent change for clicks", () => {
    const csv = gscSiteTotalsMomComparisonCsv(primary, compare);
    expect(csv).toContain("Metric,Mar 2026,Feb 2026,% change vs prior");
    expect(csv).toContain("Total clicks,110,100,+10.0%");
    expect(csv).toContain("Mar 2026");
    expect(csv).toContain("Feb 2026");
  });

  it("uses em dash for percent when compare clicks are zero", () => {
    const csv = gscSiteTotalsMomComparisonCsv(
      { ...primary, clicks: 5 },
      { ...compare, clicks: 0 },
    );
    expect(csv).toMatch(/Total clicks,5,0, - /);
  });

  it("handles one missing aggregate", () => {
    const csv = gscSiteTotalsMomComparisonCsv(primary, null);
    expect(csv).toContain("Metric,Mar 2026,Period B,% change vs prior");
    expect(csv).toContain("Total clicks,110, - , - ");
  });
});
