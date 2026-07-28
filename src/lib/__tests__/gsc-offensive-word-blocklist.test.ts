import { describe, expect, it } from "vitest";
import {
  containsOffensiveGscLanguage,
  isOffensiveGscQuery,
  normalizeGscOffensiveText,
} from "@/lib/gsc-offensive-word-blocklist";

describe("normalizeGscOffensiveText", () => {
  it("normalizes obfuscated vulgar tokens", () => {
    expect(normalizeGscOffensiveText("f*ck")).toBe("fuck");
    expect(normalizeGscOffensiveText("sh*t")).toBe("shit");
  });
});

describe("containsOffensiveGscLanguage", () => {
  it("blocks vulgar whole words", () => {
    expect(containsOffensiveGscLanguage("shit near me")).toBe(true);
    expect(containsOffensiveGscLanguage("f*ck off")).toBe(true);
    expect(containsOffensiveGscLanguage("fuck off")).toBe(true);
    expect(containsOffensiveGscLanguage("ass hole")).toBe(true);
  });

  it("does not block benign substrings", () => {
    expect(containsOffensiveGscLanguage("class schedule")).toBe(false);
    expect(containsOffensiveGscLanguage("passage door")).toBe(false);
    expect(containsOffensiveGscLanguage("assistant manager")).toBe(false);
  });
});

describe("isOffensiveGscQuery", () => {
  it("matches isOffensiveGscQuery to containsOffensiveGscLanguage", () => {
    expect(isOffensiveGscQuery("shit removal")).toBe(true);
    expect(isOffensiveGscQuery("junk removal near me")).toBe(false);
  });
});
