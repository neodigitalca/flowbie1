import { describe, expect, it } from "vitest";
import { removeNonWikipediaExternalLinks } from "@/lib/content-generation/content-sanitizer";

const ENTITY_WIKI = "https://en.wikipedia.org/wiki/Canora%2C_Edmonton";
const OTHER_WIKI = "https://en.wikipedia.org/wiki/Edmonton";

describe("removeNonWikipediaExternalLinks Overview wiki keep", () => {
  it("keeps exact allowed entity Wikipedia href inside Overview HTML", () => {
    const html = `<h2>Overview</h2><p>Blinds for <a href="${ENTITY_WIKI}">Canora, Edmonton, AB</a> homes.</p><ul><li><strong>Fit</strong>: see <a href="#costs">cost factors</a>.</li></ul>`;
    const out = removeNonWikipediaExternalLinks(html, "https://blindmagic.com", ENTITY_WIKI);
    expect(out).toContain(`href="${ENTITY_WIKI}"`);
    expect(out).toContain("Canora, Edmonton, AB");
    expect(out).toContain('href="#costs"');
  });

  it("strips other Wikipedia URLs when only entity URL is allowed", () => {
    const html = `<h2>Overview</h2><p><a href="${OTHER_WIKI}">Edmonton</a> vs <a href="${ENTITY_WIKI}">Canora</a></p>`;
    const out = removeNonWikipediaExternalLinks(html, "https://blindmagic.com", ENTITY_WIKI);
    expect(out).toContain(`href="${ENTITY_WIKI}"`);
    expect(out).not.toContain(OTHER_WIKI);
  });
});
