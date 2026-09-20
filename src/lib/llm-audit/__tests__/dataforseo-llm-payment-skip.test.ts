import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dataforseoLlmResponsesLive,
  isDataForSeoPaymentFailure,
  isDfsLlmPaymentSkip,
  isDfsPaymentLatched,
  resetDfsPaymentLatch,
  DFS_LLM_PAYMENT_SKIP,
} from "@/lib/llm-audit/dataforseo-llm-responses-live";

const liveParams = {
  platform: "chat_gpt" as const,
  model_name: "o4-mini",
  user_prompt: "window blinds",
};

describe("isDataForSeoPaymentFailure", () => {
  it("treats HTTP 402 as a DataForSEO payment skip", () => {
    expect(isDataForSeoPaymentFailure({ httpStatus: 402 })).toBe(true);
    expect(isDataForSeoPaymentFailure({ message: "HTTP 402" })).toBe(true);
    expect(isDataForSeoPaymentFailure({ json: { status_code: 40200 } })).toBe(true);
    expect(isDataForSeoPaymentFailure({ json: { status_code: 40210 } })).toBe(true);
    expect(isDfsLlmPaymentSkip(DFS_LLM_PAYMENT_SKIP)).toBe(true);
  });

  it("does not treat a normal live response as payment", () => {
    expect(isDataForSeoPaymentFailure({ httpStatus: 200, json: { status_code: 20000 } })).toBe(false);
  });
});

describe("DFS payment latch", () => {
  beforeEach(() => {
    resetDfsPaymentLatch();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    resetDfsPaymentLatch();
    vi.unstubAllGlobals();
  });

  it("skips later live calls after the first 402", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 402,
      text: async () => JSON.stringify({ status_code: 40200, status_message: "Payment Required" }),
    } as Response);

    const first = await dataforseoLlmResponsesLive(liveParams);
    expect(first).toEqual(DFS_LLM_PAYMENT_SKIP);
    expect(isDfsPaymentLatched()).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);

    const second = await dataforseoLlmResponsesLive({
      ...liveParams,
      platform: "gemini",
      model_name: "gemini-2.5-flash",
    });
    expect(second).toEqual(DFS_LLM_PAYMENT_SKIP);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
