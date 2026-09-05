import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postOpenRouterAppChat, postOpenRouterAppChatFetch } from "@/lib/openrouter-app-api";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { fetchUrlTextViaApi, isAppApiUrl } from "@/lib/proxy-fetch-text";
import { streamOpenRouterChatCompletionCore } from "@/lib/openrouter-stream-chat-core";

describe("openrouter app API client", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          content: "hello",
          finishReason: "stop",
          raw: { choices: [{ message: { content: "hello" } }] },
        }),
        text: async () => "{}",
      }) as Response),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /api/openrouter/chat-completion, not openrouter.ai", async () => {
    const result = await postOpenRouterAppChat({
      apiKey: "k",
      model: "google/gemini-2.5-flash-lite",
      system: "sys",
      user: "user",
      maxTokens: 16,
    });
    expect(result.content).toBe("hello");
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(url).toContain("/api/openrouter/chat-completion");
    expect(url).not.toContain("openrouter.ai");
  });

  it("callOpenRouterChatCompletion uses the app API", async () => {
    await callOpenRouterChatCompletion({
      apiKey: "k",
      model: "google/gemini-2.5-flash-lite",
      system: "sys",
      user: "user",
      maxTokens: 16,
    });
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(url).toContain("/api/openrouter/chat-completion");
    expect(url).not.toContain("openrouter.ai");
  });

  it("forwards image size and modalities on the app route", async () => {
    await postOpenRouterAppChatFetch({
      method: "POST",
      headers: { Authorization: "Bearer k" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        modalities: ["text", "image"],
        size: "1024x1024",
        messages: [{ role: "user", content: [{ type: "text", text: "draw" }] }],
      }),
    });
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body.size).toBe("1024x1024");
    expect(body.modalities).toEqual(["text", "image"]);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("/api/openrouter/chat-completion");
  });
});

describe("stream OpenRouter core uses the app API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /api/openrouter/chat-completion with stream true", async () => {
    const encoder = new TextEncoder();
    const sse =
      'data: {"choices":[{"delta":{"content":"hi"},"finish_reason":"stop"}]}\n\n';
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        body: {
          getReader() {
            let sent = false;
            return {
              read: async () => {
                if (sent) return { done: true, value: undefined };
                sent = true;
                return { done: false, value: encoder.encode(sse) };
              },
            };
          },
        },
      }) as unknown as Response),
    );

    const result = await streamOpenRouterChatCompletionCore({
      apiKey: "k",
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.2,
      maxTokens: 16,
      topP: 1,
      httpReferer: "https://example.com",
      onContentChunk: () => undefined,
    });

    expect(result.content).toBe("hi");
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(url).toContain("/api/openrouter/chat-completion");
    expect(url).not.toContain("openrouter.ai");
    expect(body.stream).toBe(true);
  });

  it("buffers split SSE lines across chunks", async () => {
    const encoder = new TextEncoder();
    const fullLine =
      'data: {"choices":[{"delta":{"content":"hello"},"finish_reason":"stop"}]}\n\n';
    const part1 = fullLine.slice(0, 40);
    const part2 = fullLine.slice(40);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        body: {
          getReader() {
            let step = 0;
            return {
              read: async () => {
                if (step === 0) {
                  step = 1;
                  return { done: false, value: encoder.encode(part1) };
                }
                if (step === 1) {
                  step = 2;
                  return { done: false, value: encoder.encode(part2) };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      }) as unknown as Response),
    );

    const chunks: string[] = [];
    const result = await streamOpenRouterChatCompletionCore({
      apiKey: "k",
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.2,
      maxTokens: 16,
      topP: 1,
      httpReferer: "https://example.com",
      onContentChunk: (c) => chunks.push(c),
    });

    expect(result.content).toBe("hello");
    expect(chunks.join("")).toBe("hello");
  });
});

describe("isAppApiUrl", () => {
  it("accepts relative and absolute /api paths", () => {
    expect(isAppApiUrl("/api/teams/1/files/2")).toBe(true);
    expect(isAppApiUrl("https://neodigital.ca/api/agent-runs/1/deliverables")).toBe(true);
    expect(isAppApiUrl("https://cdn.example.com/file.csv")).toBe(false);
    expect(isAppApiUrl("https://example.com/wp-json/wp/v2/posts")).toBe(false);
  });
});

describe("fetchUrlTextViaApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /api/proxy/fetch-text, not the CSV host", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, content: "a,b\n1,2" }),
      }) as Response),
    );
    const text = await fetchUrlTextViaApi("https://cdn.example.com/entities.csv");
    expect(text).toBe("a,b\n1,2");
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(url).toContain("/api/proxy/fetch-text");
    expect(url).not.toContain("cdn.example.com");
    expect(body.url).toBe("https://cdn.example.com/entities.csv");
  });
});
