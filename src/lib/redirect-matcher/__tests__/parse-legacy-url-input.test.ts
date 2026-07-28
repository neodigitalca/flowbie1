import { describe, expect, it } from "vitest";
import { parseLegacyUrlTextInput } from "@/lib/redirect-matcher/parse-legacy-url-input";

const site = {
  id: "site-1",
  name: "Test Site",
  siteUrl: "https://example.com",
  username: "u",
  appPassword: "p",
} as const;

describe("parseLegacyUrlTextInput", () => {
  it("parses one URL per line", () => {
    const text = [
      "https://example.com/legacy-a/",
      "",
      "https://example.com/legacy-b/",
    ].join("\n");

    const result = parseLegacyUrlTextInput(text, site as any);
    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.uploadRow).toBe(1);
    expect(result.rows[1]?.uploadRow).toBe(2);
  });

  it("errors on empty input", () => {
    const result = parseLegacyUrlTextInput("  \n  ", site as any);
    expect(result.rows).toHaveLength(0);
    expect(result.error).toMatch(/at least one/i);
  });
});
