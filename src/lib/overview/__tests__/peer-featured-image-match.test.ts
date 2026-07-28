import { describe, expect, it } from "vitest";

import {
  keywordMatchTokens,
  normalizeKeywordMatchKey,
  scoreKeywordWordOrderMatch,
  scorePeerRowKeywordMatch,
} from "@/lib/overview/peer-featured-image-match";

describe("normalizeKeywordMatchKey", () => {
  it("lowercases and collapses separators", () => {
    expect(normalizeKeywordMatchKey("  Custom-Blinds/Edmonton  ")).toBe(
      "custom blinds edmonton",
    );
  });

  it("strips punctuation without regex surprises", () => {
    expect(normalizeKeywordMatchKey("Blinds, Shades & Shutters!")).toBe(
      "blinds shades shutters",
    );
  });
});

describe("keywordMatchTokens", () => {
  it("drops stopwords", () => {
    expect(keywordMatchTokens("blinds near me in Edmonton")).toEqual([
      "blinds",
      "edmonton",
    ]);
  });

  it("keeps raw tokens when everything is a stopword", () => {
    expect(keywordMatchTokens("near me")).toEqual(["near", "me"]);
  });
});

describe("scoreKeywordWordOrderMatch", () => {
  it("matches shuffled word order as exact (score 3)", () => {
    const m = scoreKeywordWordOrderMatch(
      "edmonton custom blinds",
      "custom blinds edmonton",
    );
    expect(m).toEqual({ match: true, score: 3 });
  });

  it("scores candidate superset as contains (score 2)", () => {
    const m = scoreKeywordWordOrderMatch(
      "premium custom blinds edmonton alberta",
      "custom blinds edmonton",
    );
    expect(m).toEqual({ match: true, score: 2 });
  });

  it("scores high token overlap as fuzzy (score 1)", () => {
    const m = scoreKeywordWordOrderMatch(
      "custom blinds calgary",
      "custom blinds edmonton",
    );
    // 2 shared of 4 union = 0.5 < 0.6 -> no match
    expect(m.match).toBe(false);

    const m2 = scoreKeywordWordOrderMatch(
      "custom wood blinds edmonton",
      "custom blinds edmonton",
    );
    // 3 shared of 4 union = 0.75 -> fuzzy... superset already scores 2
    expect(m2).toEqual({ match: true, score: 2 });

    const m3 = scoreKeywordWordOrderMatch(
      "custom blinds shades edmonton",
      "custom blinds edmonton shutters",
    );
    // 3 shared of 5 union = 0.6 -> fuzzy score 1
    expect(m3).toEqual({ match: true, score: 1 });
  });

  it("rejects unrelated keywords", () => {
    expect(
      scoreKeywordWordOrderMatch("roof repair toronto", "custom blinds edmonton"),
    ).toEqual({ match: false, score: 0 });
  });

  it("ignores stopwords when comparing", () => {
    expect(
      scoreKeywordWordOrderMatch(
        "the custom blinds in edmonton",
        "custom blinds for edmonton",
      ),
    ).toEqual({ match: true, score: 3 });
  });

  it("rejects empty inputs", () => {
    expect(scoreKeywordWordOrderMatch("", "custom blinds")).toEqual({
      match: false,
      score: 0,
    });
    expect(scoreKeywordWordOrderMatch("custom blinds", "")).toEqual({
      match: false,
      score: 0,
    });
  });
});

describe("scorePeerRowKeywordMatch", () => {
  it("prefers the keyword field over the title", () => {
    const m = scorePeerRowKeywordMatch(
      {
        keyword: "edmonton custom blinds",
        title: "Premium Custom Blinds For Edmonton Homes",
      },
      "custom blinds edmonton",
    );
    expect(m.match).toBe(true);
    expect(m.matchedOn).toBe("keyword");
    expect(m.score).toBe(3);
  });

  it("falls back to the title when keyword misses", () => {
    const m = scorePeerRowKeywordMatch(
      { keyword: "roof repair", title: "Custom Blinds Edmonton" },
      "edmonton custom blinds",
    );
    expect(m.match).toBe(true);
    expect(m.matchedOn).toBe("title");
    expect(m.matchedText).toBe("Custom Blinds Edmonton");
  });

  it("reports no match when neither fits", () => {
    const m = scorePeerRowKeywordMatch(
      { keyword: "roof repair", title: "Gutter Cleaning" },
      "custom blinds edmonton",
    );
    expect(m).toEqual({ match: false, score: 0, matchedOn: null, matchedText: "" });
  });
});
