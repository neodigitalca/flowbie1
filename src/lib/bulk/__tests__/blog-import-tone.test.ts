import { describe, expect, it } from "vitest";
import {
  buildDraftTextForToneAnalysis,
  formatImportedToneForHarnessPrompt,
  parseImportedToneJson,
} from "../blog-import-tone";

describe("buildDraftTextForToneAnalysis", () => {
  it("includes title and section bodies", () => {
    const text = buildDraftTextForToneAnalysis("Arctic Policy", [
      { h2: "Investment scale", body: "Billions in federal funding." },
      { h2: "Regional impact", body: "Territorial economies shift." },
    ]);
    expect(text).toContain("Arctic Policy");
    expect(text).toContain("Investment scale");
    expect(text).toContain("federal funding");
  });
});

describe("formatImportedToneForHarnessPrompt", () => {
  it("requires maintaining sophistication", () => {
    const block = formatImportedToneForHarnessPrompt({
      register: "policy-analytical",
      sophistication: "high",
      voice_traits: ["data-forward", "institutional"],
      sentence_rhythm: "Mixed medium and long sentences",
      vocabulary_notes: "Technical geopolitical terms",
      do_not: ["Do not dumb down"],
      sample_phrases: ["strategic sovereignty framework"],
    });
    expect(block).toMatch(/sophistication/i);
    expect(block).toMatch(/Do not dumb down/i);
    expect(block).toMatch(/policy-analytical/);
  });
});

describe("parseImportedToneJson", () => {
  it("round-trips profile", () => {
    const profile = {
      register: "journalistic",
      sophistication: "moderate-high",
      voice_traits: ["neutral"],
      sentence_rhythm: "steady",
      vocabulary_notes: "precise",
      do_not: ["no hype"],
      sample_phrases: ["according to analysts"],
    };
    const parsed = parseImportedToneJson(JSON.stringify(profile));
    expect(parsed?.register).toBe("journalistic");
    expect(parsed?.voice_traits).toEqual(["neutral"]);
  });
});
