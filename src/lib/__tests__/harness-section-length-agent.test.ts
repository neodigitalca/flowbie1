import { describe, expect, it } from "vitest";
import type { HarnessSectionLengthResult } from "@/lib/bulk/harness-section-length-agent";
import { HARNESS_AI_LENGTH_RETRY } from "@/lib/bulk/harness-section-length-agent";

describe("HarnessSectionLengthResult contract", () => {
  it("harness bulk path uses one OpenRouter pass per section (no length rewrite)", () => {
    expect(HARNESS_AI_LENGTH_RETRY).toBe(false);
  });

  it("parses compliant rewrite JSON shape", () => {
    const raw = JSON.stringify({
      compliant: false,
      section_html: "<h2>Topic</h2><p>Short body.</p>",
    } satisfies HarnessSectionLengthResult);
    const parsed = JSON.parse(raw) as HarnessSectionLengthResult;
    expect(parsed.compliant).toBe(false);
    expect(parsed.section_html).toContain("<h2>");
  });
});
