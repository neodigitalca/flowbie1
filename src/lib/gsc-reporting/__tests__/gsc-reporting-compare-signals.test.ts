import { describe, expect, it } from "vitest";
import {
  deriveGscCompareSignals,
  gscCompareSignalsFileContent,
  parseSiteTotalsCompareCsv,
} from "../gsc-reporting-compare-signals";

const advanceBlindsPrimary = {
  label: "Jul 2026",
  startDate: "2026-07-01",
  endDate: "2026-07-31",
  clicks: 94,
  impressions: 26631,
  ctr: 94 / 26631,
  position: 28.09,
};

const advanceBlindsCompare = {
  label: "Jun 2026",
  startDate: "2026-06-01",
  endDate: "2026-06-30",
  clicks: 106,
  impressions: 24546,
  ctr: 106 / 24546,
  position: 25.19,
};

describe("deriveGscCompareSignals", () => {
  it("classifies Advance Blinds July MoM as query_footprint_expansion", () => {
    const signals = deriveGscCompareSignals({
      compareKind: "mom",
      compareLabel: "Jul 2026 vs Jun 2026",
      aggregatePrimary: advanceBlindsPrimary,
      aggregateCompare: advanceBlindsCompare,
      queryCountPrimary: 2951,
      queryCountCompare: 2674,
      primaryQueries: [],
      compareQueries: [],
    });

    expect(signals).not.toBeNull();
    expect(signals!.primaryPattern).toBe("query_footprint_expansion");
    expect(signals!.confidence).toBe("medium");
    expect(signals!.interpretation).toContain("footprint expanded");
    expect(signals!.forbiddenFraming).toContain("visibility decline");
    expect(signals!.metrics.impressionsPct).toBe("+8.5%");
    expect(signals!.metrics.queriesPct).toBe("+10.4%");
  });

  it("same metrics under yoy preset yield the same pattern", () => {
    const signals = deriveGscCompareSignals({
      compareKind: "yoy",
      compareLabel: "Jul 2026 vs Jul 2025",
      aggregatePrimary: advanceBlindsPrimary,
      aggregateCompare: advanceBlindsCompare,
      queryCountPrimary: 2951,
      queryCountCompare: 2674,
    });

    expect(signals!.primaryPattern).toBe("query_footprint_expansion");
    expect(signals!.compareKind).toBe("yoy");
  });

  it("classifies visibility_contraction when impressions fall and position worsens", () => {
    const signals = deriveGscCompareSignals({
      compareKind: "mom",
      compareLabel: "A vs B",
      aggregatePrimary: {
        ...advanceBlindsPrimary,
        impressions: 20000,
        position: 30,
      },
      aggregateCompare: {
        ...advanceBlindsCompare,
        impressions: 25000,
        position: 25,
      },
      queryCountPrimary: 2500,
      queryCountCompare: 2600,
    });

    expect(signals!.primaryPattern).toBe("visibility_contraction");
  });

  it("classifies ctr_dilution when impressions up, clicks and ctr down", () => {
    const signals = deriveGscCompareSignals({
      compareKind: "mom",
      compareLabel: "A vs B",
      aggregatePrimary: {
        ...advanceBlindsPrimary,
        clicks: 80,
        impressions: 30000,
        ctr: 80 / 30000,
        position: 20,
      },
      aggregateCompare: {
        ...advanceBlindsCompare,
        clicks: 100,
        impressions: 25000,
        ctr: 100 / 25000,
        position: 20,
      },
      queryCountPrimary: 2800,
      queryCountCompare: 2700,
    });

    expect(signals!.primaryPattern).toBe("ctr_dilution");
  });

  it("counts new queries when query arrays provided", () => {
    const signals = deriveGscCompareSignals({
      compareKind: "mom",
      compareLabel: "A vs B",
      aggregatePrimary: advanceBlindsPrimary,
      aggregateCompare: advanceBlindsCompare,
      queryCountPrimary: 3,
      queryCountCompare: 2,
      primaryQueries: [
        { query: "blinds calgary", clicks: 10, impressions: 100, ctr: 0.1, position: 5 },
        { query: "new term", clicks: 1, impressions: 50, ctr: 0.02, position: 40 },
      ],
      compareQueries: [
        { query: "blinds calgary", clicks: 12, impressions: 120, ctr: 0.1, position: 4 },
      ],
    });

    expect(signals!.newQueryCount).toBe(1);
    expect(signals!.continuingQueryCount).toBe(1);
    expect(signals!.confidence).toBe("high");
  });

  it("emits file content with COMPARE_SIGNALS header", () => {
    const signals = deriveGscCompareSignals({
      compareKind: "mom",
      compareLabel: "Jul 2026 vs Jun 2026",
      aggregatePrimary: advanceBlindsPrimary,
      aggregateCompare: advanceBlindsCompare,
      queryCountPrimary: 2951,
      queryCountCompare: 2674,
    })!;

    const text = gscCompareSignalsFileContent(signals);
    expect(text).toContain("COMPARE_SIGNALS");
    expect(text).toContain("primaryPattern: query_footprint_expansion");
  });
});

describe("parseSiteTotalsCompareCsv", () => {
  it("parses Site-totals-MoM.csv metric rows", () => {
    const csv = [
      "# Site-wide",
      "Metric,Jul 2026,Jun 2026,% change vs prior",
      "Total clicks,94,106,-11.3%",
      "Total impressions,26631,24546,+8.5%",
      "Search queries,2951,2674,+10.3%",
      "Average CTR,0.35%,0.43%,-18.6%",
      "Average position,28.09,25.19,+11.5%",
    ].join("\n");

    const parsed = parseSiteTotalsCompareCsv(csv);
    expect(parsed).not.toBeNull();
    expect(parsed!.queryCountPrimary).toBe(2951);
    expect(parsed!.aggregatePrimary?.clicks).toBe(94);
    expect(parsed!.aggregateCompare?.impressions).toBe(24546);
  });
});
