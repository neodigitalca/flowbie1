import { describe, expect, it } from "vitest";
import { parseEnhanceGoalJson, parseSuggestTitleJson } from "../flow-freeform-prompts";

describe("parseSuggestTitleJson", () => {
  it("parses plain JSON", () => {
    expect(parseSuggestTitleJson('{"title":"Q4 SEO Audit"}')).toBe("Q4 SEO Audit");
  });

  it("parses fenced JSON", () => {
    expect(parseSuggestTitleJson('```json\n{"title":"Local Pack Guide"}\n```')).toBe("Local Pack Guide");
  });

  it("returns empty on invalid", () => {
    expect(parseSuggestTitleJson("not json")).toBe("");
  });
});

describe("parseEnhanceGoalJson", () => {
  it("parses enhancedPrompt", () => {
    expect(parseEnhanceGoalJson('{"enhancedPrompt":"Do X then Y."}')).toBe("Do X then Y.");
  });

  it("returns empty on invalid", () => {
    expect(parseEnhanceGoalJson("{}")).toBe("");
  });
});
