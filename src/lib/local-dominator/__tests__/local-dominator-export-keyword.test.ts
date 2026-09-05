import { describe, expect, it } from "vitest";
import {
  LOCAL_DOMINATOR_GRID_KEYWORD_AUTO,
  isLocalDominatorAutoGridKeyword,
  normalizeLocalDominatorGridKeywordStored,
  resolveLocalDominatorExportKeyword,
  resolveWorkflowLocalDominatorGridKeyword,
} from "@/lib/local-dominator/local-dominator-export-keyword";

describe("local-dominator-export-keyword", () => {
  it("treats auto and empty as auto-first-grid", () => {
    expect(isLocalDominatorAutoGridKeyword("")).toBe(true);
    expect(isLocalDominatorAutoGridKeyword("auto")).toBe(true);
    expect(isLocalDominatorAutoGridKeyword("AUTO")).toBe(true);
    expect(isLocalDominatorAutoGridKeyword("blinds near me")).toBe(false);
  });

  it("normalizes auto modes to stored auto token", () => {
    expect(normalizeLocalDominatorGridKeywordStored("")).toBe(LOCAL_DOMINATOR_GRID_KEYWORD_AUTO);
    expect(normalizeLocalDominatorGridKeywordStored("auto")).toBe(LOCAL_DOMINATOR_GRID_KEYWORD_AUTO);
    expect(normalizeLocalDominatorGridKeywordStored("custom shades")).toBe("custom shades");
  });

  it("resolves auto token to empty export keyword", () => {
    expect(resolveLocalDominatorExportKeyword("auto")).toBe("");
    expect(resolveLocalDominatorExportKeyword("")).toBe("");
    expect(resolveLocalDominatorExportKeyword("blinds near me")).toBe("blinds near me");
  });

  it("drops legacy template keyword when business is not the template client", () => {
    expect(
      resolveWorkflowLocalDominatorGridKeyword(
        { keyword: "blinds near me", businessName: "KWB" },
        "blinds near me",
        "KWB",
      ),
    ).toBe(LOCAL_DOMINATOR_GRID_KEYWORD_AUTO);
    expect(
      resolveWorkflowLocalDominatorGridKeyword(
        { keyword: "blinds near me", businessName: "Advance Blinds & Drapery" },
        "blinds near me",
        "Advance Blinds & Drapery",
      ),
    ).toBe("blinds near me");
  });
});
