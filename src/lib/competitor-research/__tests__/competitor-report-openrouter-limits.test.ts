import { describe, expect, it } from "vitest";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";

describe("getCompetitorReportMaxOutputTokens", () => {
  it("matches OpenRouter Gemini completion cap for flash-lite (~65.5K)", () => {
    expect(getCompetitorReportMaxOutputTokens("google/gemini-2.5-flash-lite")).toBe(65_536);
  });

  it("matches OpenRouter Gemini completion cap for flash (non-lite)", () => {
    expect(getCompetitorReportMaxOutputTokens("google/gemini-2.5-flash")).toBe(65_536);
  });

  it("defaults unknown models to large ceiling", () => {
    expect(getCompetitorReportMaxOutputTokens("some/vendor-model")).toBe(131_072);
  });
});
