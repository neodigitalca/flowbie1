import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/competitor-research/competitor-report-openrouter", () => ({
  callOpenRouterChatCompletion: vi.fn(),
}));

vi.mock("@/lib/optimization-settings-storage", () => ({
  getProductionModel: () => "test-model",
}));

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { resolveBulkWordPressPostTitle } from "@/lib/bulk/bulk-post-title-agent";

const mockCall = vi.mocked(callOpenRouterChatCompletion);

describe("resolveBulkWordPressPostTitle", () => {
  beforeEach(() => {
    mockCall.mockReset();
  });

  it("includes focus keyword and all candidates in the user prompt", async () => {
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        compliant: true,
        wordpress_title: "Veneers vs Crowns Which Dental Restoration Wins",
      }),
    });

    await resolveBulkWordPressPostTitle({
      apiKey: "test-key",
      focusKeyword: "veneers vs crowns",
      candidates: {
        researchSeoTitle: "Veneers vs. Crowns: Which Dental Restoration Guide",
        csvTitle: "Veneers Vs Crowns",
        blueprintTitle: "Veneers vs Crowns Compared",
      },
    });

    expect(mockCall).toHaveBeenCalledTimes(1);
    const call = mockCall.mock.calls[0]![0];
    expect(call.user).toContain("veneers vs crowns");
    expect(call.user).toContain("research_seo_title:");
    expect(call.user).toContain("csv_title:");
    expect(call.user).toContain("blueprint_title:");
    expect(call.system).toContain("WORDPRESS POST TITLE");
    expect(call.user).toContain("synthesize ONE new complete title");
    expect(call.user).not.toContain("max_chars:");
  });

  it("returns the full agent title without truncating past 60 chars", async () => {
    const title =
      "2026 Alberta Physician Privatization Changes Changes for Alberta Physicians";
    expect(title.length).toBeGreaterThan(60);
    mockCall.mockResolvedValue({
      content: JSON.stringify({ compliant: true, wordpress_title: title }),
    });

    const result = await resolveBulkWordPressPostTitle({
      apiKey: "test-key",
      focusKeyword: "Alberta physician privatization changes",
      candidates: {
        csvTitle: title,
        blueprintTitle: "Alberta Physician Privatization",
      },
    });

    expect(result).toBe(title);
    expect(result).not.toMatch(/for Al$/);
  });

  it("returns full CSV title without calling OpenRouter when api key is empty", async () => {
    const csvTitle =
      "2026 Alberta Physician Privatization Changes: Changes for Alberta";
    expect(csvTitle.length).toBeGreaterThan(60);
    const result = await resolveBulkWordPressPostTitle({
      apiKey: "",
      focusKeyword: "Alberta physician privatization changes",
      candidates: {
        csvTitle,
        blueprintTitle: "Blueprint Only",
      },
    });
    expect(mockCall).not.toHaveBeenCalled();
    expect(result).toBe(csvTitle);
  });

  it("uses preferred full title when OpenRouter fails", async () => {
    mockCall.mockRejectedValue(new Error("network"));

    const result = await resolveBulkWordPressPostTitle({
      apiKey: "test-key",
      focusKeyword: "veneers vs crowns",
      candidates: { csvTitle: "Veneers Vs Crowns Guide" },
    });

    expect(result).toBe("Veneers Vs Crowns Guide");
  });
});
