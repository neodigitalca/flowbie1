import { describe, expect, it } from "vitest";
import { shouldAbortChatGptProxyRequest } from "../../../scripts/research/chatgpt-audit/chatgpt-lean-browsing.mjs";

describe("shouldAbortChatGptProxyRequest", () => {
  it("blocks images, media, and fonts", () => {
    expect(
      shouldAbortChatGptProxyRequest("https://chatgpt.com/cdn/app.js", "image"),
    ).toBe(true);
    expect(
      shouldAbortChatGptProxyRequest("https://chatgpt.com/cdn/app.woff2", "font"),
    ).toBe(true);
    expect(
      shouldAbortChatGptProxyRequest("https://chatgpt.com/video/intro.mp4", "media"),
    ).toBe(true);
  });

  it("allows ChatGPT scripts and stylesheets", () => {
    expect(
      shouldAbortChatGptProxyRequest("https://chatgpt.com/cdn/main.js", "script"),
    ).toBe(false);
    expect(
      shouldAbortChatGptProxyRequest("https://oaistatic.com/assets/app.css", "stylesheet"),
    ).toBe(false);
  });

  it("blocks known analytics hosts", () => {
    expect(
      shouldAbortChatGptProxyRequest("https://www.google-analytics.com/collect", "script"),
    ).toBe(true);
    expect(
      shouldAbortChatGptProxyRequest("https://region1.ingest.sentry.io/api/1/envelope/", "fetch"),
    ).toBe(true);
  });

  it("allows OpenAI API traffic", () => {
    expect(
      shouldAbortChatGptProxyRequest("https://chatgpt.com/backend-api/conversation", "fetch"),
    ).toBe(false);
    expect(
      shouldAbortChatGptProxyRequest("https://auth.openai.com/authorize", "document"),
    ).toBe(false);
  });
});
