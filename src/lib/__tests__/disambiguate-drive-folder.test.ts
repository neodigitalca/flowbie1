import { describe, expect, it, vi } from "vitest";
import { disambiguateDriveFolder } from "@/lib/google-drive/disambiguate-drive-folder";

vi.mock("@/lib/competitor-research/competitor-report-openrouter", () => ({
  callOpenRouterChatCompletion: vi.fn(),
}));

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";

describe("disambiguateDriveFolder", () => {
  it("returns the only candidate without calling OpenRouter", async () => {
    const result = await disambiguateDriveFolder({
      apiKey: "test-key",
      model: "test-model",
      siteName: "Acme",
      purpose: "reporting",
      candidates: [{ folderId: "folder123456", name: "Acme Reporting" }],
    });
    expect(result.folderId).toBe("folder123456");
    expect(callOpenRouterChatCompletion).not.toHaveBeenCalled();
  });

  it("uses OpenRouter when multiple candidates exist", async () => {
    vi.mocked(callOpenRouterChatCompletion).mockResolvedValueOnce({
      raw: {},
      content: JSON.stringify({ folderId: "folder22222222", reason: "closest name" }),
    });

    const result = await disambiguateDriveFolder({
      apiKey: "test-key",
      model: "test-model",
      siteName: "Acme",
      purpose: "reporting",
      candidates: [
        { folderId: "folder11111111", name: "Acme" },
        { folderId: "folder22222222", name: "Acme Roofing" },
      ],
    });

    expect(result.folderId).toBe("folder22222222");
    expect(callOpenRouterChatCompletion).toHaveBeenCalledTimes(1);
  });
});
