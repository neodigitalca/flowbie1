import { describe, expect, it } from "vitest";
import {
  keywordBatchResultsToMap,
  normalizeOverviewKeywordUrlKey,
  parseOverviewKeywordBatchJson,
} from "@/lib/overview/overview-keyword-batch-parse";

describe("parseOverviewKeywordBatchJson", () => {
  it("parses results array", () => {
    const raw = JSON.stringify({
      results: [
        { url: "https://Example.com/a/", focusKeyword: "Roller Shades Install" },
        { url: "https://example.com/b", focusKeyword: "social media vs diy" },
      ],
    });
    const parsed = parseOverviewKeywordBatchJson(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.focusKeyword).toBeTruthy();
  });

  it("parses markdown-fenced JSON", () => {
    const raw = '```json\n{"proposals":[{"page":"https://x.com/p","proposedPrimaryKeyword":"Blinds Orlando FL"}]}\n```';
    const parsed = parseOverviewKeywordBatchJson(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.url).toBe("https://x.com/p");
  });

  it("ignores invalid entries", () => {
    const raw = JSON.stringify({
      results: [{ url: "", focusKeyword: "x" }, { url: "https://a.com", focusKeyword: "" }],
    });
    expect(parseOverviewKeywordBatchJson(raw)).toHaveLength(0);
  });
});

describe("keywordBatchResultsToMap", () => {
  it("normalizes URL keys", () => {
    const map = keywordBatchResultsToMap([
      { url: "https://Example.COM/Page", focusKeyword: "Test Keyword" },
    ]);
    expect(map.get(normalizeOverviewKeywordUrlKey("https://example.com/page"))).toBe(
      "Test Keyword",
    );
  });
});
