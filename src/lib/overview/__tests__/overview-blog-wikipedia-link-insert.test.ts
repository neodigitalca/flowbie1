import { describe, expect, it } from "vitest";
import {
  entityPhraseCandidates,
  htmlAlreadyHasWikiLink,
  insertWikipediaLink,
  insertWikipediaLinkAtEarliestEntityReference,
  extractWikipediaLinksWithContext,
} from "@/lib/overview/overview-blog-wikipedia-link-insert";

const WIKI = "https://en.wikipedia.org/wiki/Canora%2C_Edmonton";

describe("entityPhraseCandidates", () => {
  it("returns longest phrases first", () => {
    const c = entityPhraseCandidates("Canora, Edmonton, AB");
    expect(c[0]).toBe("Canora, Edmonton, AB");
    expect(c).toContain("Canora");
  });
});

describe("htmlAlreadyHasWikiLink", () => {
  it("detects existing wiki href", () => {
    const html = `<p>Homes in <a href="${WIKI}">Canora</a>.</p>`;
    expect(htmlAlreadyHasWikiLink(html, WIKI)).toBe(true);
  });
});

describe("insertWikipediaLinkAtEarliestEntityReference", () => {
  it("links earliest Canora mention not the second", () => {
    const html =
      "<p>Canora families trust local care.</p><p>Later Canora mentions appear here.</p>";
    const out = insertWikipediaLinkAtEarliestEntityReference(html, "Canora, Edmonton", WIKI);
    expect(out.ok).toBe(true);
    expect(out.html).toContain(`<a href="${WIKI}">Canora</a> families`);
    expect(out.html.match(/<a href=/g)?.length).toBe(1);
  });

  it("skips when wiki url already linked", () => {
    const html = `<p><a href="${WIKI}">Canora</a> is linked.</p>`;
    const out = insertWikipediaLinkAtEarliestEntityReference(html, "Canora", WIKI);
    expect(out.ok).toBe(false);
    expect(out.html).toBe(html);
  });

  it("does not link text inside existing anchors", () => {
    const html = `<p><a href="#x">Canora area</a> and Canora plain.</p>`;
    const out = insertWikipediaLinkAtEarliestEntityReference(html, "Canora", WIKI);
    expect(out.ok).toBe(true);
    expect(out.html).toContain(`<a href="${WIKI}">Canora</a> plain`);
    expect(out.html).toContain('<a href="#x">Canora area</a>');
  });

  it("tries comma entity variant when full phrase missing", () => {
    const html = "<p>Services in Canora for families.</p>";
    const out = insertWikipediaLinkAtEarliestEntityReference(
      html,
      "Canora, Edmonton, AB",
      WIKI,
    );
    expect(out.ok).toBe(true);
    expect(out.html).toContain(`<a href="${WIKI}">Canora</a>`);
  });
});

describe("insertWikipediaLink", () => {
  it("falls back to first paragraph when entity phrase missing", () => {
    const html = "<p>Local dental care for families.</p>";
    const out = insertWikipediaLink(html, "Canora, Edmonton", WIKI, "Canora, Edmonton");
    expect(out.ok).toBe(true);
    expect(out.html).toMatch(/<p><a href="[^"]+wikipedia\.org[^"]+">Canora, Edmonton<\/a>/);
  });
});

describe("extractWikipediaLinksWithContext", () => {
  it("returns anchor with surrounding plain text and href", () => {
    const html =
      '<p>Families across Edmonton AB choose local care near <a href="https://en.wikipedia.org/wiki/Blue_Quill%2C_Edmonton">Blue Quill</a> every day.</p>';
    const links = extractWikipediaLinksWithContext(html);
    expect(links).toHaveLength(1);
    expect(links[0]?.anchor).toBe("Blue Quill");
    expect(links[0]?.href).toContain("wikipedia.org/wiki/Blue_Quill");
    expect(links[0]?.contextBefore).toContain("near");
    expect(links[0]?.contextAfter).toContain("every day");
  });
});
