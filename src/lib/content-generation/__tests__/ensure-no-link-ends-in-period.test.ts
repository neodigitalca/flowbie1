import { describe, expect, it } from "vitest";
import { ensureNoLinkEndsInPeriod } from "../content-sanitizer";

describe("ensureNoLinkEndsInPeriod", () => {
  it("does not append for more to same-page hash scroll links", () => {
    const html =
      '<li><strong>Impact</strong>: see <a href="#2026-bc-pst-expansion-business-impact">new regulations</a>.</li>';
    expect(ensureNoLinkEndsInPeriod(html)).toBe(html);
  });

  it("still fixes external links at end of sentence", () => {
    const html = '<p>Read <a href="https://example.com/page/">this guide</a>.</p>';
    expect(ensureNoLinkEndsInPeriod(html)).toContain(" for more.");
  });
});
