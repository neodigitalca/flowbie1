import { describe, expect, it } from "vitest";
import { composerSubmitLooksAccepted } from "../../../scripts/research/chatgpt-audit/lib.mjs";

describe("composerSubmitLooksAccepted", () => {
  const baseline = {
    composerText: "Analyze this page and return markdown in one code block please",
    userMessageCount: 1,
  };

  it("accepts when ChatGPT starts generating", () => {
    expect(
      composerSubmitLooksAccepted(
        { composerText: baseline.composerText, userMessageCount: 1, generating: true },
        baseline,
      ),
    ).toBe(true);
  });

  it("accepts when a new user message appears", () => {
    expect(
      composerSubmitLooksAccepted(
        { composerText: "", userMessageCount: 2, generating: false },
        baseline,
      ),
    ).toBe(true);
  });

  it("accepts when the composer clears after typing a long prompt", () => {
    expect(
      composerSubmitLooksAccepted(
        { composerText: "", userMessageCount: 1, generating: false },
        baseline,
      ),
    ).toBe(true);
  });

  it("rejects when an old user message exists but the prompt is still in the composer", () => {
    expect(
      composerSubmitLooksAccepted(
        { composerText: baseline.composerText, userMessageCount: 1, generating: false },
        baseline,
      ),
    ).toBe(false);
  });
});
