import { describe, expect, it } from "vitest";
import {
  extractTextEditorProseFromPageHtml,
  extractTextEditorProseFromRenderedHtml,
  normalizeSectionProseHtml,
  proseLooksCorrupt,
} from "@/lib/elementor-page-content/extract-text-editor-prose";

describe("extractTextEditorProseFromRenderedHtml", () => {
  it("extracts inner HTML from elementor text-editor widgets", () => {
    const html = [
      '<div class="elementor-element elementor-widget elementor-widget-image" data-e-type="widget" data-widgettype="image.default">',
      '<div class="elementor-widget-container"><img src="/logo.png" alt="Logo" /></div></div>',
      '<div class="elementor-element elementor-widget elementor-widget-text-editor" data-e-type="widget" data-widgettype="text-editor.default">',
      '<div class="elementor-widget-container"><p>Hunter Douglas Canada supports Habitat.</p></div></div>',
    ].join("");
    const prose = extractTextEditorProseFromRenderedHtml(html);
    expect(prose).toContain("<p>Hunter Douglas Canada supports Habitat.</p>");
    expect(prose).not.toContain("data-e-type");
    expect(prose).not.toContain("data-widgettype");
  });

  it("extracts full nested widget-container content with external links", () => {
    const html = [
      '<div class="elementor-widget elementor-widget-text-editor">',
      '<div class="elementor-widget-container">',
      '<div class="elementor-text-editor elementor-clearfix">',
      '<p>We worked with <a href="https://pcl.com" target="_blank" rel="noopener">PCL</a> and <a href="https://ledcor.com" target="_blank" rel="noopener">Ledcor</a>.</p>',
      "</div></div></div>",
    ].join("");
    const prose = extractTextEditorProseFromRenderedHtml(html);
    expect(prose).toContain('<a href="https://pcl.com">PCL</a>');
    expect(prose).toContain('<a href="https://ledcor.com">Ledcor</a>');
    expect(prose).not.toContain("target=");
    expect(prose).not.toContain('blank" rel="noopener"');
  });

  it("returns empty when only non-text widgets present", () => {
    const html =
      '<div class="elementor-widget elementor-widget-video" data-e-type="widget" data-widgettype="video.default"><div class="elementor-widget-container"></div></div>';
    expect(extractTextEditorProseFromRenderedHtml(html)).toBe("");
  });
});

describe("proseLooksCorrupt", () => {
  it("does not flag valid rel=noopener links as corrupt", () => {
    const html =
      '<p>Contact <a href="https://example.com/contact/" target="_blank" rel="noopener">us today</a>.</p>';
    expect(proseLooksCorrupt(html)).toBe(false);
  });
});

describe("normalizeSectionProseHtml", () => {
  it("repairs orphaned target attribute leaks into plain anchor text", () => {
    const broken =
      '<p>contractors as blank" rel="noopener">PCL</a>, blank" rel="noopener">Ledcor</a>.</p>';
    const fixed = normalizeSectionProseHtml(broken);
    expect(fixed).toContain("PCL");
    expect(fixed).toContain("Ledcor");
    expect(fixed).not.toContain('blank" rel="noopener"');
    expect(proseLooksCorrupt(broken)).toBe(true);
    expect(proseLooksCorrupt(fixed)).toBe(false);
  });

  it("repairs curly-quote orphan leaks from commercial copy", () => {
    const broken =
      "<p>premier contractors as blank\u201d rel=\u201cnoopener\u201d>PCL, blank\u201d rel=\u201cnoopener\u201d>Ledcor, blank\u201d rel=\u201cnoopener\u201d>Graham Construction</p>";
    const fixed = normalizeSectionProseHtml(broken);
    expect(fixed).toContain("PCL");
    expect(fixed).toContain("Ledcor");
    expect(fixed).toContain("Graham Construction");
    expect(fixed).not.toMatch(/rel=/i);
    expect(fixed).not.toMatch(/noopener/i);
  });
});

describe("extractTextEditorProseFromPageHtml", () => {
  it("aligns prose to h2 section index", () => {
    const pageHtml =
      "<h2>First</h2><p>Ignored raw</p><h2>Second</h2>" +
      '<div class="elementor-widget-text-editor"><div class="elementor-widget-container"><p>Band two copy</p></div></div>';
    expect(extractTextEditorProseFromPageHtml(pageHtml, 1, "Second")).toContain("Band two copy");
  });

  it("aligns prose to elementor top sections by index", () => {
    const pageHtml = [
      '<div class="elementor-section elementor-top-section">',
      '<div class="elementor-widget-heading"><h2 class="elementor-heading-title">Fully Custom</h2></div>',
      '<div class="elementor-widget-text-editor"><div class="elementor-widget-container"><p>Every space tells a story.</p></div></div>',
      "</div>",
      '<div class="elementor-section elementor-top-section">',
      '<div class="elementor-widget-text-editor"><div class="elementor-widget-container"><p>Second band copy</p></div></div>',
      "</div>",
    ].join("");
    expect(extractTextEditorProseFromPageHtml(pageHtml, 0, "Fully Custom")).toContain(
      "Every space tells a story",
    );
    expect(extractTextEditorProseFromPageHtml(pageHtml, 1, "Second")).toContain("Second band copy");
  });
});
