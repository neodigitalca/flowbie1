import { describe, expect, it } from "vitest";
import {
  findIllustrativeH2Bounds,
  formatScenarioH2Title,
  stripAllScenarioSections,
  stripLegacyScenarioH3Blocks,
} from "@/lib/overview/overview-blog-scenario-section";

describe("formatScenarioH2Title", () => {
  it("prefixes topical titles with Scenario:", () => {
    expect(formatScenarioH2Title("Navigating tariff shifts")).toBe(
      "Scenario: Navigating tariff shifts",
    );
  });

  it("does not double-prefix when topic already includes Scenario:", () => {
    expect(formatScenarioH2Title("Scenario: Tariff pressure")).toBe("Scenario: Tariff pressure");
  });
});

describe("stripLegacyScenarioH3Blocks", () => {
  it("removes h3 Scenario blocks and keeps Recommendation h3", () => {
    const html = `<h2>Topic</h2><p>Body.</p><h3>Scenario: What should Eleanor buy?</h3><blockquote><p>Eleanor needs shade.</p></blockquote><h3>Recommendation: Vinyl blinds</h3><p>Advice.</p>`;
    const stripped = stripLegacyScenarioH3Blocks(html);
    expect(stripped).not.toMatch(/<h3[^>]*>\s*scenario\s*:/i);
    expect(stripped).toContain("Recommendation: Vinyl blinds");
  });
});

describe("stripAllScenarioSections", () => {
  it("removes legacy illustrative blocks with blockquote and Recommendation h3", () => {
    const html = `<h2>Answer</h2><p>Lead.</p><h2>Growth Strategy Impact on Valuation</h2><p>Intro.</p><blockquote><p>Arthur is selling.</p></blockquote><h3>Recommendation: Valuation</h3><p>Advice.</p><h2>What We Offer</h2><p>Catalog.</p>`;
    const stripped = stripAllScenarioSections(html);
    expect(stripped).not.toContain("Arthur is selling");
    expect(stripped).toContain("What We Offer");
  });

  it("removes H2 blocks titled with Scenario:", () => {
    const html = `<h2>Answer</h2><p>Lead.</p><h2>Scenario: Old example</h2><p>Old intro.</p><blockquote><p>Old quote.</p></blockquote><h3>Recommendation: Old</h3><p>Old rec.</p><h2>What We Offer</h2><p>Catalog.</p>`;
    const stripped = stripAllScenarioSections(html);
    expect(stripped).not.toContain("Old quote");
    expect(stripped).toContain("What We Offer");
  });
});

describe("findIllustrativeH2Bounds", () => {
  it("finds an H2 titled with Scenario:", () => {
    const html = `<h2>Answer</h2><p>Lead.</p><h2>Scenario: Tariff supply chain shifts</h2><p>Intro.</p><blockquote><p>Marcus runs a firm.</p></blockquote><h3>Recommendation: Diversify</h3><p>Advice.</p><h2>What We Offer</h2><p>Catalog.</p>`;
    const bounds = findIllustrativeH2Bounds(html);
    expect(bounds?.title).toBe("Scenario: Tariff supply chain shifts");
  });

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

  it("returns null when no illustrative block exists", () => {
    const html = `<h2>The local problem here</h2><p>Glare.</p><h2>What We Offer</h2><p>Catalog.</p>`;
    expect(findIllustrativeH2Bounds(html)).toBeNull();
  });
});
