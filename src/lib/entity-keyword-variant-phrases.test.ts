import { describe, expect, it } from "vitest";
import {
  ENTITY_KEYWORD_VARIANT_TEMPLATES,
  ENTITY_KEYWORD_VARIANT_RULE,
  formatEntityKeywordVariantPromptBlock,
} from "@/lib/entity-keyword-variant-phrases";

describe("ENTITY_KEYWORD_VARIANT_TEMPLATES", () => {
  it("weights sum to 100", () => {
    const total = ENTITY_KEYWORD_VARIANT_TEMPLATES.reduce((n, t) => n + t.weightPercent, 0);
    expect(total).toBe(100);
  });

  it("uses general placeholders not hardcoded products", () => {
    for (const t of ENTITY_KEYWORD_VARIANT_TEMPLATES) {
      expect(t.pattern).toMatch(/\{topic\}|\{topicSynonym\}/);
      expect(t.pattern).not.toContain("blinds");
      expect(t.pattern).not.toContain("Lacombe");
    }
  });
});

describe("formatEntityKeywordVariantPromptBlock", () => {
  it("lists weighted templates with filled examples from entity + keyword", () => {
    const block = formatEntityKeywordVariantPromptBlock({
      entity: "Lacombe Park, St. Albert, AB",
      keyword: "custom blinds lacombe park st albert",
      topicSynonymHint: "window coverings",
    });
    expect(block).toContain("ENTITY KEYWORD VARIANTS");
    expect(block).toContain("18%");
    expect(block).toContain("custom blinds in Lacombe Park");
    expect(block).toContain("window coverings in Lacombe Park");
    expect(block).toContain("homeowners in Lacombe Park, St. Albert");
    expect(block).toContain("Place entity (comma label): Lacombe Park, St. Albert");
    expect(block).toContain("City: St. Albert");
    expect(block).toContain(ENTITY_KEYWORD_VARIANT_RULE);
    expect(ENTITY_KEYWORD_VARIANT_RULE).toContain("Most topic mentions **omit the place entity** (~70%)");
    expect(ENTITY_KEYWORD_VARIANT_RULE).toContain("remaining ~30%");
    expect(block).not.toContain("the city");
    expect(block).not.toContain("blinds Lacombe Park St. Albert");
  });

  it("returns empty when entity or keyword missing", () => {
    expect(formatEntityKeywordVariantPromptBlock({ entity: "Lacombe Park, St. Albert, AB", keyword: "  " })).toBe("");
    expect(formatEntityKeywordVariantPromptBlock({ entity: "  ", keyword: "blinds" })).toBe("");
  });
});
