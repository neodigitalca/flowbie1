import { describe, expect, it } from "vitest";
import { buildUserPrompt, mergeOptimizerInstructions, OPTIMIZER_INSTRUCTIONS_LABEL } from "@/lib/prompt-builders/system-user";

describe("optimizer Instructions", () => {
  it("keeps operator text ahead of an existing modifier", () => {
    expect(mergeOptimizerInstructions("Apply the new live template.", "Tone: plain")).toBe(
      "Apply the new live template.\n\nTone: plain",
    );
    expect(mergeOptimizerInstructions("Apply the new live template.", "")).toBe(
      "Apply the new live template.",
    );
    expect(mergeOptimizerInstructions("", "Tone: plain")).toBe("Tone: plain");
  });

  it("puts the current Instructions text in the writer block", () => {
    const user = buildUserPrompt(
      "Title",
      "Purpose",
      "Sections",
      { name: "Acme", siteUrl: "https://acme.test" },
      undefined,
      { promptModifier: "Apply the new live template. Add winter install notes." },
    );
    expect(user).toContain(`${OPTIMIZER_INSTRUCTIONS_LABEL}: Apply the new live template. Add winter install notes.`);
    expect(user).not.toContain("Prompt modifier:");
  });
});
