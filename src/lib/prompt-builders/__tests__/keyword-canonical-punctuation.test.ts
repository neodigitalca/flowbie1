import { describe, expect, it } from "vitest";
import {
  applyCanonicalKeywordPunctuation,
  buildKeywordPunctuationPromptBlock,
  resolveWritingKeyword,
} from "@/lib/prompt-builders/keyword-canonical-punctuation";

describe("applyCanonicalKeywordPunctuation", () => {
  it("hyphenates xray to X-ray", () => {
    expect(applyCanonicalKeywordPunctuation("dental xray safety")).toBe("dental X-ray safety");
  });

  it("hyphenates x ray to X-ray", () => {
    expect(applyCanonicalKeywordPunctuation("dental x ray safety")).toBe("dental X-ray safety");
  });

  it("leaves veneers vs crowns unchanged", () => {
    expect(applyCanonicalKeywordPunctuation("veneers vs crowns")).toBe("veneers vs crowns");
  });

  it("hyphenates ecommerce", () => {
    expect(applyCanonicalKeywordPunctuation("ecommerce solutions")).toBe("e-commerce solutions");
  });

  it("hyphenates covid 19", () => {
    expect(applyCanonicalKeywordPunctuation("covid 19 updates")).toBe("COVID-19 updates");
  });
});

describe("buildKeywordPunctuationPromptBlock", () => {
  it("includes STORED and WRITING lines when they differ", () => {
    const block = buildKeywordPunctuationPromptBlock("dental xray safety");
    expect(block).toContain("STORED FOCUS KEYWORD");
    expect(block).toContain("dental xray safety");
    expect(block).toContain("WRITING KEYWORD");
    expect(block).toContain("dental X-ray safety");
  });

  it("uses short form when stored equals writing", () => {
    const block = buildKeywordPunctuationPromptBlock("veneers vs crowns");
    expect(block).not.toContain("WRITING KEYWORD");
    expect(block).toContain("veneers vs crowns");
  });
});

describe("resolveWritingKeyword", () => {
  it("returns override when provided", () => {
    expect(resolveWritingKeyword("dental xray safety", "custom keyword")).toBe("custom keyword");
  });
});
