import { describe, expect, it } from "vitest";
import {
  assertDistinctFillKeywords,
  keywordFillsMapFromParsedJson,
  keywordUniquenessKey,
  parseKeywordFillsAssistantContent,
} from "@/lib/local-analysis-fill-keywords-from-wp-inventory";

describe("keywordFillsMapFromParsedJson", () => {
  it("returns a map when every required id is present", () => {
    const o = {
      fills: [
        { rowId: "a", keyword: "commercial roofing" },
        { rowId: "b", keyword: "metal roof repair" },
      ],
    };
    const m = keywordFillsMapFromParsedJson(o, ["a", "b"]);
    expect(m.get("a")).toBe("commercial roofing");
    expect(m.get("b")).toBe("metal roof repair");
  });

  it("throws when a required rowId is missing", () => {
    const o = {
      fills: [{ rowId: "a", keyword: "commercial roofing" }],
    };
    expect(() => keywordFillsMapFromParsedJson(o, ["a", "b"])).toThrow(/row "b"/);
  });

  it("throws when fills is not an array", () => {
    expect(() => keywordFillsMapFromParsedJson({ fills: {} }, ["a"])).toThrow(/"fills" array/);
  });

  it("throws when two rows share the same keyword (case-insensitive)", () => {
    const o = {
      fills: [
        { rowId: "a", keyword: "Event Tent Rental" },
        { rowId: "b", keyword: "event tent rental" },
      ],
    };
    expect(() => keywordFillsMapFromParsedJson(o, ["a", "b"])).toThrow(/Duplicate keyword/);
  });
});

describe("assertDistinctFillKeywords", () => {
  it("allows single row", () => {
    const m = new Map([["x", "only one"]]);
    expect(() => assertDistinctFillKeywords(m, ["x"])).not.toThrow();
  });
});

describe("keywordUniquenessKey", () => {
  it("collapses whitespace and lowercases", () => {
    expect(keywordUniquenessKey("  Foo   Bar ")).toBe("foo bar");
  });
});

describe("parseKeywordFillsAssistantContent", () => {
  it("parses JSON wrapped in a markdown fence", () => {
    const raw = '```json\n{"fills":[{"rowId":"x","keyword":"hvac maintenance"}]}\n```';
    const m = parseKeywordFillsAssistantContent(raw, ["x"]);
    expect(m.get("x")).toBe("hvac maintenance");
  });
});
