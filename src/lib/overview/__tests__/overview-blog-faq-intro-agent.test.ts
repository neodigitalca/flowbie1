import { describe, expect, it } from "vitest";
import { isValidFaqIntroPlainText, normalizeFaqIntroPlainText } from "../overview-blog-faq-intro-agent";

describe("isValidFaqIntroPlainText", () => {
  it("rejects single-word intros like For", () => {
    expect(isValidFaqIntroPlainText("For")).toBe(false);
  });

  it("rejects intros that are too short", () => {
    expect(isValidFaqIntroPlainText("Short intro without enough length.")).toBe(false);
  });

  it("accepts a complete multi-sentence intro", () => {
    const intro =
      "These answers cover common Hunter Douglas warranty questions for homeowners reviewing coverage details.";
    expect(isValidFaqIntroPlainText(intro)).toBe(true);
  });
});

describe("normalizeFaqIntroPlainText", () => {
  it("strips accidental HTML tags", () => {
    expect(normalizeFaqIntroPlainText("<p>Plain intro text.</p>")).toBe("Plain intro text.");
  });
});
