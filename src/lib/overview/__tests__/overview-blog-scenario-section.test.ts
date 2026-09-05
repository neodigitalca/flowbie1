import { describe, expect, it } from "vitest";
import { findIllustrativeH2Bounds } from "@/lib/overview/overview-blog-scenario-section";

describe("findIllustrativeH2Bounds", () => {
  it("finds a legacy Scenario h3 block", () => {
    const html = `<h2>Answer</h2><p>Lead.</p><h2>A realistic local situation</h2><h3>Scenario: What should Eleanor buy?</h3><blockquote><p>Eleanor needs shade.</p></blockquote><h3>Recommendation: Vinyl blinds</h3><p>In The Shade would recommend vinyl.</p><h2>What We Offer</h2><p>Catalog.</p>`;
    const bounds = findIllustrativeH2Bounds(html);
    expect(bounds?.title).toBe("A realistic local situation");
  });

  it("finds a short-H2 section with intro, blockquote, and Recommendation h3", () => {
    const html = `<h2>Answer</h2><p>Lead.</p><h2>West-facing light and privacy</h2><p>West rooms get late glare.</p><blockquote><p>Eleanor needs shade that still looks like the house.</p></blockquote><h3>Recommendation: Vinyl blinds</h3><p>In The Shade would recommend vinyl.</p><h2>What We Offer</h2><p>Catalog.</p>`;
    const bounds = findIllustrativeH2Bounds(html);
    expect(bounds?.title).toBe("West-facing light and privacy");
  });

  it("finds a local-situation H2 even without Scenario h3", () => {
    const html = `<h2>Answer</h2><p>Lead.</p><h2>A realistic local situation</h2><p>Eleanor needs shade on west glass.</p><h2>What We Offer</h2><p>Catalog.</p>`;
    const bounds = findIllustrativeH2Bounds(html);
    expect(bounds?.title).toBe("A realistic local situation");
  });

  it("returns null when no illustrative block exists", () => {
    const html = `<h2>The local problem here</h2><p>Glare.</p><h2>What We Offer</h2><p>Catalog.</p>`;
    expect(findIllustrativeH2Bounds(html)).toBeNull();
  });
});
