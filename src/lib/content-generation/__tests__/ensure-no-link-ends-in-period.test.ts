import { describe, expect, it } from "vitest";
import {
  ensureNoLinkEndsInPeriod,
  sanitizeContentForUpload,
  stripDanglingForMoreTail,
} from "../content-sanitizer";

describe("ensureNoLinkEndsInPeriod", () => {
  it("does not append for more to same-page hash scroll links", () => {
    const html =
      '<li><strong>Impact</strong>: see <a href="#2026-bc-pst-expansion-business-impact">new regulations</a>.</li>';
    expect(ensureNoLinkEndsInPeriod(html)).toBe(html);
  });

  it("does not append for more to external links at end of sentence", () => {
    const html = '<p>Read <a href="https://example.com/page/">this guide</a>.</p>';
    expect(ensureNoLinkEndsInPeriod(html)).not.toContain(" for more.");
    expect(ensureNoLinkEndsInPeriod(html)).toBe(
      '<p>Read <a href="https://example.com/page/">this guide</a>.</p>',
    );
  });

  it("moves period from inside anchor to outside", () => {
    const html = '<p>See <a href="https://example.com/">guide.</a></p>';
    expect(ensureNoLinkEndsInPeriod(html)).toBe(
      '<p>See <a href="https://example.com/">guide</a>.</p>',
    );
  });

  it("does not leave domain for more after forbidden external strip", () => {
    const html = '<p>See <a href="https://www.energy.gov/solar">energy.gov</a>.</p>';
    const out = sanitizeContentForUpload(html, "https://ridgelinesolar.ca");
    expect(out).not.toMatch(/energy\.gov for more/i);
    expect(out).toBe("<p>See energy.gov.</p>");
  });

  it("does not leave initial cost for more after external strip", () => {
    const html = '<p>Compare <a href="https://example.com/cost">initial cost</a>.</p>';
    const out = sanitizeContentForUpload(html, "https://ridgelinesolar.ca");
    expect(out).not.toMatch(/for more/i);
    expect(out).toBe("<p>Compare initial cost.</p>");
  });
});

describe("stripDanglingForMoreTail", () => {
  it("removes orphan for more tail", () => {
    expect(stripDanglingForMoreTail("<p>initial cost for more.</p>")).toBe("<p>initial cost.</p>");
  });

  it("keeps for more information", () => {
    const html = "<p>Contact us for more information.</p>";
    expect(stripDanglingForMoreTail(html)).toBe(html);
  });
});
