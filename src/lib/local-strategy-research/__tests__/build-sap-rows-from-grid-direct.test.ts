import { describe, expect, it, vi } from "vitest";
import type { CompetitorResearchSemrushResponse, TieredCompetitorsResult } from "@/lib/competitor-research/types";
import type { LocalDominatorRow } from "@/lib/local-dominator-csv";
import {
  buildSapRowsFromGridDirect,
  entityFromGridRow,
  sanitizeGridSapPlaceLabel,
} from "@/lib/local-strategy-research/build-sap-rows-from-grid-direct";
import {
  LOCAL_STRATEGY_SAP_SCHEDULE_TOTAL_ROWS,
  runLocalStrategySapSchedule,
} from "@/lib/local-strategy-research/local-strategy-sap-schedule-from-grid";

function row(partial: Partial<LocalDominatorRow> & Pick<LocalDominatorRow, "keyword" | "rank">): LocalDominatorRow {
  return {
    scanDate: "",
    latitude: 0,
    longitude: 0,
    business: "",
    address: "",
    placeId: "",
    websiteUrl: "",
    scanSize: "",
    distance: 0,
    distanceMeasure: "",
    primaryCategory: "",
    secondaryCategories: "",
    ...partial,
  };
}

const semrushBase: CompetitorResearchSemrushResponse = {
  seedDomain: "example.com",
  database: "us",
  rows: [],
};

const tiersBase: TieredCompetitorsResult = {
  tiers: [
    {
      tier: "high",
      label: "Strong overlap",
      competitors: [{ domain: "example.com", score: 72, rationale: "" }],
    },
  ],
  summary: "",
};

describe("entityFromGridRow", () => {
  it("uses City, ST from long street addresses (not GMB fluff segments)", () => {
    const r = row({
      keyword: "dentist",
      rank: 1,
      address: "123 Main St, Neighbourhood, Calgary, AB, Canada",
    });
    expect(entityFromGridRow(r, [], "", 0)).toBe("Calgary, AB");
  });

  it("uses place hints with geo when address is empty", () => {
    const r = row({ keyword: "dentist", rank: 1, address: "" });
    expect(entityFromGridRow(r, ["Downtown"], "Calgary, AB", 0)).toBe("Downtown, Calgary, AB");
  });

  it("does not repeat the city when the place hint matches the start of the geo suffix", () => {
    const r = row({ keyword: "blinds", rank: 1, address: "" });
    expect(entityFromGridRow(r, ["Stuart"], "Stuart, FL", 0)).toBe("Stuart, FL");
  });

  it("strips GMB fluff and uses City, ST from messy grid addresses", () => {
    const r = row({
      keyword: "blinds near me",
      rank: 1,
      address: "10+ years in business · , Port St. Lucie, FL",
    });
    expect(entityFromGridRow(r, [], "", 0)).toBe("Port St. Lucie, FL");
  });
});

describe("sanitizeGridSapPlaceLabel", () => {
  it("removes years-in-business GMB noise", () => {
    expect(sanitizeGridSapPlaceLabel("10+ years in business · , Port St. Lucie, FL")).toBe(
      "Port St. Lucie, FL",
    );
  });
});

describe("buildSapRowsFromGridDirect", () => {
  it("orders worst rank first and caps to targetTotal", () => {
    const rows = [
      row({ keyword: "a", rank: 5, address: "x, y, z, p1, p2, p3" }),
      row({ keyword: "b", rank: 20, address: "x, y, z, p1, p2, p3" }),
      row({ keyword: "c", rank: 12, address: "x, y, z, p1, p2, p3" }),
    ];
    const out = buildSapRowsFromGridDirect({
      rows,
      targetTotal: 2,
      placeHints: [],
      geoLabel: null,
      entityLocation: null,
      semrush: semrushBase,
      tiers: tiersBase,
    });
    expect(out).toHaveLength(2);
    expect(out[0]!.keyword).toBe("b");
    expect(out[1]!.keyword).toBe("c");
    expect(out[0]!.title).toBe("");
    expect(out[0]!.modifier).toBe("google-maps");
    expect(out[0]!.featuredImage).toBe("google-maps");
    expect(out[0]!.keyword_questions_json).toBe("[]");
    expect(out[0]!.origin).toContain("seed:example.com");
    expect(out[0]!.origin).toContain("Strong overlap");
  });

  it("returns empty array when rows is empty", () => {
    expect(
      buildSapRowsFromGridDirect({
        rows: [],
        targetTotal: LOCAL_STRATEGY_SAP_SCHEDULE_TOTAL_ROWS,
        placeHints: [],
        geoLabel: null,
        entityLocation: null,
        semrush: semrushBase,
        tiers: tiersBase,
      }),
    ).toEqual([]);
  });
});

vi.mock("@/lib/local-seo-strategy-from-grid", () => ({
  fetchLocalSeoStrategyFromGrid: vi.fn(async () => {
    throw new Error("fetchLocalSeoStrategyFromGrid must not run when gridParsedRows is provided");
  }),
}));

describe("runLocalStrategySapSchedule grid direct path", () => {
  it("returns builtFromGridDirect and does not call fetchLocalSeoStrategyFromGrid", async () => {
    const { fetchLocalSeoStrategyFromGrid } = await import("@/lib/local-seo-strategy-from-grid");
    const gridParsedRows = [
      row({ keyword: "kw", rank: 8, address: "a, b, c, d, e, f" }),
    ];
    const res = await runLocalStrategySapSchedule({
      apiKey: "",
      model: "x",
      temperature: 0,
      maxTokens: 1,
      topP: 1,
      siteName: "Site",
      semrush: semrushBase,
      tiers: tiersBase,
      selectedDomainKeys: new Set(),
      gridParsedRows,
      targetTotal: 1,
    });
    expect(res.builtFromGridDirect).toBe(true);
    expect(res.usedFallback).toBe(false);
    expect(res.sapRows).toHaveLength(1);
    expect(res.sapRows[0]!.keyword).toBe("kw");
    expect(fetchLocalSeoStrategyFromGrid).not.toHaveBeenCalled();
  });
});
