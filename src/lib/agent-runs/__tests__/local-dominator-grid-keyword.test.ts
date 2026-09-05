import { describe, expect, it } from "vitest";
import { resolveEffectiveGridKeyword } from "@/lib/agent-runs/run-local-dominator-export-client-harness";
import {
  resolveLocalDominatorExportKeyword,
  resolveWorkflowLocalDominatorGridKeyword,
} from "@/lib/local-dominator/local-dominator-export-keyword";

describe("resolveEffectiveGridKeyword", () => {
  it("returns explicit keyword when provided", () => {
    expect(resolveEffectiveGridKeyword("blinds near me", "Keyword,Rank\nignored,1")).toBe(
      "blinds near me",
    );
  });

  it("infers dominant keyword from exported grid CSV when keyword is auto", () => {
    const csv = [
      "Keyword,Rank,Latitude,Longitude",
      "roller shades,3,49.1,-97.5",
      "roller shades,5,49.2,-97.6",
      "window coverings,8,49.3,-97.7",
    ].join("\n");
    expect(resolveEffectiveGridKeyword("auto", csv)).toBe("roller shades");
  });

  it("falls back to business name for business listing CSV without Keyword column", () => {
    const csv = [
      "Business Name,Address,Average Rank,Latitude,Longitude,Place ID",
      '"Advance Blinds","303A Main Ave",3.46,49.1904838,-97.7626737,ChIJabc',
    ].join("\n");
    expect(resolveEffectiveGridKeyword("auto", csv, "Advance Blinds")).toBe("Advance Blinds");
  });

  it("exports without keyword filter when template keyword leaked for another business", () => {
    const stored = resolveWorkflowLocalDominatorGridKeyword(
      { keyword: "blinds near me", businessName: "KWB" },
      "blinds near me",
      "KWB",
    );
    expect(resolveLocalDominatorExportKeyword(stored)).toBe("");
  });
});
