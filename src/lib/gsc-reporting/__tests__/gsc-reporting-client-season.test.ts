import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import {
  applyReportPeriodToClientSeason,
  formatGscClientSeasonPromptBlock,
  resolveGscClientSeasonContext,
} from "@/lib/gsc-reporting/gsc-reporting-client-season";
import {
  applySeasonalDemandSectionGate,
  parseGscReportingOutlineJson,
} from "@/lib/gsc-reporting/gsc-reporting-outline";
import { buildUserMessageForSection, getGscReportingSectionSystemPrompt } from "@/lib/gsc-reporting/gsc-reporting-section-prompts";
import type { GscReportingOutlineResult, GscReportingSectionPlan } from "@/lib/gsc-reporting/gsc-reporting-types";

function siteWithCity(city: string, vertical?: string): WordPressSite {
  return {
    id: "s1",
    name: "Blind Magic",
    siteUrl: "https://example.com",
    industryVertical: vertical,
    locations: [
      {
        id: "l1",
        name: "HQ",
        address: "",
        city,
        state: "AB",
        zip: "",
        phone: "",
        isDefault: true,
      },
    ],
  } as WordPressSite;
}

describe("resolveGscClientSeasonContext", () => {
  it("reads city from the profile location and calendar month in Edmonton time", () => {
    const ctx = resolveGscClientSeasonContext(siteWithCity("Edmonton", "window coverings"), new Date("2026-09-01T18:00:00Z"));
    expect(ctx.city).toBe("Edmonton");
    expect(ctx.locationLabel).toMatch(/Edmonton/);
    expect(ctx.vertical).toBe("window coverings");
    expect(ctx.calendarMonth).toBe("September");
    expect(ctx.calendarYear).toBe("2026");
  });

  it("still returns calendar month when the profile has no city", () => {
    const ctx = resolveGscClientSeasonContext(
      {
        id: "s1",
        name: "No City Co",
        siteUrl: "https://example.com",
        locations: [],
      } as WordPressSite,
      new Date("2026-09-01T18:00:00Z"),
    );
    expect(ctx.city).toBe("");
    expect(ctx.calendarMonth).toBe("September");
    expect(ctx.calendarYear).toBe("2026");
  });
});

describe("formatGscClientSeasonPromptBlock", () => {
  it("tells the writer to apply local-trade season reading to this city", () => {
    const block = formatGscClientSeasonPromptBlock({
      city: "Edmonton",
      locationLabel: "Edmonton, AB",
      vertical: "window coverings",
      calendarMonth: "September",
      calendarYear: "2026",
    });
    expect(block).toContain("CLIENT_SEASON");
    expect(block).toContain("City: Edmonton");
    expect(block).toContain("Vertical: window coverings");
    expect(block).toContain("September 2026");
    expect(block).toContain("Report period");
    expect(block).toContain("busy or not busy");
    expect(block).toContain("Do not say shoulder");
    expect(block).toMatch(/Do not copy an example city or trade/);
  });

  it("overlays the full picker range so multi-month reports are not April-only", () => {
    const overlaid = applyReportPeriodToClientSeason(
      {
        city: "Edmonton",
        locationLabel: "Edmonton, AB",
        vertical: "solar",
        calendarMonth: "September",
        calendarYear: "2026",
      },
      "April 1, 2026 – August 31, 2026 vs November 1, 2025 – March 31, 2026",
    );
    expect(overlaid.reportPeriod).toBe("April 1, 2026 – August 31, 2026");
  });

  it("overlays the picker month onto season so April reports do not say September", () => {
    const overlaid = applyReportPeriodToClientSeason(
      {
        city: "Edmonton",
        locationLabel: "Edmonton, AB",
        vertical: "solar",
        calendarMonth: "September",
        calendarYear: "2026",
      },
      "April 1, 2026 to April 30, 2026 vs March 1–31, 2026",
    );
    expect(overlaid.calendarMonth).toBe("April");
    expect(overlaid.calendarYear).toBe("2026");
  });

  it("does not invent a city when city is blank", () => {
    const block = formatGscClientSeasonPromptBlock({
      city: "",
      locationLabel: "",
      vertical: "window coverings",
      calendarMonth: "September",
      calendarYear: "2026",
    });
    expect(block).toContain("CLIENT_SEASON");
    expect(block).toMatch(/City: not set/);
    expect(block).toMatch(/Do not invent a city/);
    expect(block).not.toMatch(/^City: Edmonton$/m);
  });
});

describe("seasonal context in section prompts", () => {
  it("requires one seasonality sentence in the executive summary explainer only", () => {
    const s = getGscReportingSectionSystemPrompt("executive_summary");
    expect(s).toMatch(/CLIENT SEASON/);
    expect(s).toMatch(/exactly one sentence/);
    expect(s).toMatch(/seasonality/);
    expect(s).toMatch(/busy/);
    expect(s).toMatch(/shoulder/);
    expect(s).toMatch(/no\*\* \*\*Season:\*\* bullet/i);
  });

  it("forbids season restatement in key performance insights", () => {
    const s = getGscReportingSectionSystemPrompt("key_performance_insights");
    expect(s).toMatch(/NO SEASON REPEAT/);
    expect(s).not.toMatch(/one or two sentences/);
  });

  it("does not ask later sections to write Seasonal Demand Context", () => {
    const s = getGscReportingSectionSystemPrompt("search_performance_period");
    expect(s).toMatch(/NO SEASON REPEAT/);
    expect(s).not.toMatch(/2-4 short paragraphs/);
  });

  it("injects CLIENT_SEASON into the executive summary user message when city is set", () => {
    const outline: GscReportingOutlineResult = {
      executiveSummary: "Summary",
      topOpportunities: [],
      clusters: [],
      sections: [],
    };
    const msg = buildUserMessageForSection({
      siteName: "Blind Magic",
      siteUrl: "https://example.com",
      outline,
      plan: {
        id: "executive_summary",
        h2Title: "Executive Summary",
        kind: "executive_summary",
        ragQuery: "x",
      },
      retrievedContext: "csv",
      compareLabel: "April 1, 2026 to April 30, 2026 vs March 1–31, 2026",
      clientSeason: {
        city: "Edmonton",
        locationLabel: "Edmonton, AB",
        vertical: "window coverings",
        calendarMonth: "September",
        calendarYear: "2026",
      },
    });
    expect(msg).toContain("CLIENT_SEASON");
    expect(msg).toContain("City: Edmonton");
    expect(msg).toContain("REPORT_PERIOD");
    expect(msg).toContain("April 1, 2026 to April 30, 2026");
    expect(msg).toContain("Report period: April 1, 2026 to April 30, 2026");
  });

  it("still injects CLIENT_SEASON into executive summary when clientSeason is omitted", () => {
    const outline: GscReportingOutlineResult = {
      executiveSummary: "Summary",
      topOpportunities: [],
      clusters: [],
      sections: [],
    };
    const msg = buildUserMessageForSection({
      siteName: "Advance Blinds",
      siteUrl: "https://example.com",
      outline,
      plan: {
        id: "executive_summary",
        h2Title: "Executive Summary",
        kind: "executive_summary",
        ragQuery: "x",
      },
      retrievedContext: "csv",
    });
    expect(msg).toContain("CLIENT_SEASON");
    expect(msg).toMatch(/City: not set/);
  });

  it("does not inject CLIENT_SEASON into later section user messages", () => {
    const outline: GscReportingOutlineResult = {
      executiveSummary: "Summary",
      topOpportunities: [],
      clusters: [],
      sections: [],
    };
    const msg = buildUserMessageForSection({
      siteName: "Ridgeline Solar",
      siteUrl: "https://ridgelinesolar.ca",
      outline,
      plan: {
        id: "search_performance_period",
        h2Title: "Search Performance Compared Period Over Period",
        kind: "search_performance_period",
        ragQuery: "x",
      },
      retrievedContext: "csv",
    });
    expect(msg).not.toContain("CLIENT_SEASON");
  });
});

describe("applySeasonalDemandSectionGate", () => {
  it("strips Seasonal Demand Context when the outline still includes it", () => {
    const sections: GscReportingSectionPlan[] = [
      { id: "executive_summary", h2Title: "Executive Summary", kind: "executive_summary", ragQuery: "x" },
      { id: "search_performance_period", h2Title: "", kind: "search_performance_period", ragQuery: "x" },
      { id: "key_performance_insights", h2Title: "", kind: "key_performance_insights", ragQuery: "x" },
      { id: "seasonal_demand", h2Title: "Seasonal Demand Context", kind: "seasonal_demand", ragQuery: "x" },
      { id: "sap_local_seo", h2Title: "", kind: "sap_local_seo", ragQuery: "x" },
      { id: "content_performance", h2Title: "", kind: "content_performance", ragQuery: "x" },
    ];
    const gated = applySeasonalDemandSectionGate(sections);
    expect(gated.map((s) => s.kind)).toEqual([
      "executive_summary",
      "search_performance_period",
      "key_performance_insights",
      "sap_local_seo",
      "content_performance",
    ]);
  });

  it("parseGscReportingOutlineJson builds default sections in code (ignores model sections)", () => {
    const raw = JSON.stringify({
      executiveSummary: "Traffic held steady.",
      topOpportunities: [],
      sections: [
        {
          id: "seasonal_demand",
          h2Title: "Seasonal Demand Context",
          kind: "seasonal_demand",
          ragQuery: "season",
        },
      ],
    });
    const outline = parseGscReportingOutlineJson(raw);
    expect(outline.sections.map((s) => s.kind)).not.toContain("seasonal_demand");
    expect(outline.sections.map((s) => s.kind)).toEqual([
      "executive_summary",
      "search_performance_period",
      "key_performance_insights",
      "sap_local_seo",
      "content_performance",
    ]);
  });
});
