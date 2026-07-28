import { describe, expect, it } from "vitest";
import {
  dedupeImportedDraftLinks,
  extractImportedDraftLinksFromHtml,
  extractImportedDraftLinksFromMarkdown,
  htmlFragmentToBodyWithMarkdownLinks,
  injectImportedLinksIntoChecklist,
  normalizeImportedDraftUrl,
} from "../blog-import-draft-links";

describe("blog-import-draft-links", () => {
  it("normalizes absolute http(s) urls", () => {
    expect(normalizeImportedDraftUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(normalizeImportedDraftUrl("//cdn.example.com/x")).toBe("https://cdn.example.com/x");
    expect(normalizeImportedDraftUrl("#anchor")).toBeNull();
  });

  it("extracts anchors from html", () => {
    const links = extractImportedDraftLinksFromHtml(
      '<p>See <a href="https://irs.gov/credit">IRS guidance</a> for details.</p>',
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.url).toBe("https://irs.gov/credit");
    expect(links[0]?.anchorText).toBe("IRS guidance");
  });

  it("preserves markdown links in html fragment body", () => {
    const body = htmlFragmentToBodyWithMarkdownLinks(
      'Apply at <a href="https://energy.gov/solar">Energy.gov</a> today.',
    );
    expect(body).toContain("[Energy.gov](https://energy.gov/solar)");
  });

  it("extracts markdown links", () => {
    const links = extractImportedDraftLinksFromMarkdown(
      "Read [Tax credit FAQ](https://example.org/faq) now.",
    );
    expect(links[0]?.anchorText).toBe("Tax credit FAQ");
    expect(links[0]?.url).toBe("https://example.org/faq");
  });

  it("dedupes identical url+anchor pairs", () => {
    const links = dedupeImportedDraftLinks([
      { url: "https://a.com", anchorText: "A" },
      { url: "https://a.com", anchorText: "A" },
    ]);
    expect(links).toHaveLength(1);
  });

  it("injects imported link lines into matching checklist item", () => {
    const out = injectImportedLinksIntoChecklist(
      ['1. H2 "Solar credit basics" with table and links'],
      [{ url: "https://irs.gov/x", anchorText: "IRS", h2: "Solar credit basics" }],
    );
    expect(out[0]).toContain("[IMPORTED_DRAFT_LINK]");
    expect(out[0]).toContain("[IRS](https://irs.gov/x)");
  });
});
