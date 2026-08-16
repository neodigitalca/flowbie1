import { describe, expect, it } from "vitest";
import { parsePostCreatorCannibalizationJson } from "@/lib/post-creator/post-creator-cannibalization-parse";

describe("parsePostCreatorCannibalizationJson", () => {
  it("parses allow/block decisions", () => {
    const parsed = parsePostCreatorCannibalizationJson(
      JSON.stringify({
        decisions: [
          { rowIndex: 0, allow: false, reason: "Same intent", conflictingUrl: "https://example.com/a" },
          { rowIndex: 1, allow: true, reason: "Distinct topic" },
        ],
      }),
    );
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.allow).toBe(false);
    expect(parsed[0]?.conflictingUrl).toBe("https://example.com/a");
    expect(parsed[1]?.allow).toBe(true);
  });
});
