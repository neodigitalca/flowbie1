import { describe, expect, it } from "vitest";
import { parseOpenRouterResponseBody } from "@/lib/openrouter-response-body";

describe("parseOpenRouterResponseBody", () => {
  it("throws a clear error for HTML error pages", () => {
    expect(() =>
      parseOpenRouterResponseBody("<!DOCTYPE html><html><body>Bad Gateway</body></html>", 502),
    ).toThrow(/HTML instead of JSON \(502\)/);
  });

  it("parses valid JSON", () => {
    expect(parseOpenRouterResponseBody('{"choices":[{"message":{"content":"ok"}}]}', 200)).toEqual({
      choices: [{ message: { content: "ok" } }],
    });
  });

  it("throws for non-JSON text bodies", () => {
    expect(() => parseOpenRouterResponseBody("upstream timeout", 504)).toThrow(/non-JSON \(504\)/);
  });
});
