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

  it("uses the OpenRouter wordpress_title as the post title", async () => {
    mockCall.mockResolvedValue({
      content: JSON.stringify({
        wordpress_title: "How To Choose Between Hunter Douglas And Alta Shades",
      }),
    });

    const result = await resolveBulkWordPressPostTitle({
      apiKey: "test-key",
      focusKeyword: "hunter douglas vs alta",
      candidates: {
        researchSeoTitle: "Hunter Douglas vs. Alta Shades",
        csvTitle: "Hunter Douglas Vs Alta",
        blueprintTitle: "Hunter Douglas Versus Alta Shades",
      },
    });

    expect(result).toBe("How To Choose Between Hunter Douglas And Alta Shades");
    expect(mockCall).toHaveBeenCalledTimes(1);
    const call = mockCall.mock.calls[0]![0];
    expect(call.user).toContain("hunter douglas vs alta");
    expect(call.user).toContain("do not paste as the title");
    expect(call.user).toContain("research_seo_title:");
    expect(call.user).toContain("csv_title:");
    expect(call.user).toContain("blueprint_title:");
    expect(call.system).toContain("WORDPRESS POST TITLE");
    expect(call.system).toContain("Keyword is the topic signal, not the title");
    expect(call.system).not.toContain("Front-load naturally");
  });

  it("returns the full OpenRouter title without truncating", async () => {
    const title =
      "What Alberta Physician Privatization Changes Mean For Clinics In 2026";
    mockCall.mockResolvedValue({
      content: JSON.stringify({ wordpress_title: title }),
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
  });

  it("calls OpenRouter only when an API key is present", async () => {
    await expect(
      resolveBulkWordPressPostTitle({
        apiKey: "",
        focusKeyword: "hunter douglas vs alta",
        candidates: { csvTitle: "Hunter Douglas Vs Alta" },
      }),
    ).rejects.toThrow(/OpenRouter API key/);
    expect(mockCall).not.toHaveBeenCalled();
  });
});
