import { describe, expect, it } from "vitest";
import { buildOpenRouterChatPostBodyJson } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { GSC_OUTLINE_OPENROUTER_OPTS } from "@/lib/gsc-reporting/gsc-reporting-outline-schema";

describe("gsc-reporting-outline OpenRouter contract", () => {
  it("requests strict json_schema for executiveSummary and topOpportunities only", () => {
    const bodyJson = buildOpenRouterChatPostBodyJson({
      model: "google/gemini-2.5-flash",
      maxTokensRequested: 8192,
      system: "test",
      userMessage: "test",
      ...GSC_OUTLINE_OPENROUTER_OPTS,
    });
    const body = JSON.parse(bodyJson) as {
      response_format?: { type?: string; json_schema?: { name?: string; strict?: boolean } };
    };
    expect(body.response_format?.type).toBe("json_schema");
    expect(body.response_format?.json_schema?.name).toBe("gsc_reporting_outline");
    expect(body.response_format?.json_schema?.strict).toBe(true);
  });
});
