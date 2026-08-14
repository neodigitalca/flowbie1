import { describe, expect, it, vi, beforeEach } from "vitest";
import { callMetaAdJsonCompletion } from "@/lib/ppc/meta-ad-openrouter-json";

vi.mock("@/lib/competitor-research/competitor-report-openrouter", () => ({
  callOpenRouterChatCompletion: vi.fn(),
}));

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";

describe("callMetaAdJsonCompletion", () => {
  beforeEach(() => {
    vi.mocked(callOpenRouterChatCompletion).mockReset();
  });

  it("parses fenced JSON on first attempt", async () => {
    vi.mocked(callOpenRouterChatCompletion).mockResolvedValueOnce({
      raw: {},
      content: '```json\n{"items":[{"id":"1","label":"ok"}]}\n```',
      finishReason: "stop",
    });

    const parsed = await callMetaAdJsonCompletion({
      apiKey: "key",
      model: "test-model",
      system: "system",
      user: '{"task":"test"}',
      maxTokens: 1000,
      temperature: 0.2,
      errorLabel: "Copy checklist",
    });

    expect(parsed).toEqual({ items: [{ id: "1", label: "ok" }] });
    expect(callOpenRouterChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("repairs broken JSON after retries", async () => {
    vi.mocked(callOpenRouterChatCompletion)
      .mockResolvedValueOnce({
        raw: {},
        content: "not json at all",
        finishReason: "stop",
      })
      .mockResolvedValueOnce({
        raw: {},
        content: "still broken",
        finishReason: "stop",
      })
      .mockResolvedValueOnce({
        raw: {},
        content: "still broken again",
        finishReason: "stop",
      })
      .mockResolvedValueOnce({
        raw: {},
        content: '{"goalStatement":"Drive leads","primaryTopic":"Contact","audience":"Owners","adAngle":"Help","hook":"Grow","visualDirection":"Graphic","creativeMode":"agency_service","referenceQueries":[]}',
        finishReason: "stop",
      });

    const parsed = await callMetaAdJsonCompletion({
      apiKey: "key",
      model: "test-model",
      system: "system",
      user: '{"task":"instagram_goal"}',
      maxTokens: 1000,
      temperature: 0.2,
      errorLabel: "Instagram ad goal",
    });

    expect(parsed).toMatchObject({ goalStatement: "Drive leads" });
    expect(callOpenRouterChatCompletion).toHaveBeenCalledTimes(4);
  });
});
