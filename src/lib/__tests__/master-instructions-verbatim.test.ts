import { describe, expect, it } from "vitest";
import {
  shouldStoreInstructionVerbatim,
  VERBATIM_INSTRUCTION_CHAR_THRESHOLD,
} from "@/lib/master-instructions-openrouter-summarize";

describe("shouldStoreInstructionVerbatim", () => {
  it("stores short branding rules verbatim", () => {
    const text = `it's ONSight Advisory, not ONSight`;
    expect(text.length).toBeLessThanOrEqual(VERBATIM_INSTRUCTION_CHAR_THRESHOLD);
    expect(shouldStoreInstructionVerbatim(text)).toBe(true);
  });

  it("triples long instruction documents", () => {
    const text = "x".repeat(VERBATIM_INSTRUCTION_CHAR_THRESHOLD + 1);
    expect(shouldStoreInstructionVerbatim(text)).toBe(false);
  });
});
