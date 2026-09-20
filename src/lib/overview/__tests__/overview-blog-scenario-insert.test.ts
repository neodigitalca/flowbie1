import { describe, expect, it } from "vitest";
import { insertScenarioSectionAfterH2 } from "@/lib/overview/overview-blog-scenario-insert";

describe("insertScenarioSectionAfterH2", () => {
  it("fuzzy-matches the anchor H2 title when casing or wording differs slightly", () => {
    const html =
      '<h2>Import Tariff Cost Pressure</h2><p>Body.</p><h2>What We Offer</h2><p>Catalog.</p>';
    const scenario =
      "<h2>Local buyer example</h2><p>Intro.</p><blockquote><p>Persona quote.</p></blockquote>";
    const next = insertScenarioSectionAfterH2(html, "import tariff cost", scenario);
    expect(next.indexOf("Import Tariff Cost Pressure")).toBeLessThan(next.indexOf("Local buyer example"));
  });

  it("inserts a new section after the anchor H2 block", () => {
    const html =
      '<h2>Answer</h2><p>Lead.</p><h2>Choosing materials</h2><p>Body copy.</p><h2>What We Offer</h2><p>Catalog.</p>';
    const scenario =
      "<h2>Local buyer example</h2><p>Intro.</p><blockquote><p>Persona quote.</p></blockquote>";
    const next = insertScenarioSectionAfterH2(html, "Choosing materials", scenario);
    expect(next.indexOf("Choosing materials")).toBeLessThan(next.indexOf("Local buyer example"));
    expect(next.indexOf("Local buyer example")).toBeLessThan(next.indexOf("What We Offer"));
  });
});
