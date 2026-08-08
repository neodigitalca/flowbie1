import { describe, expect, it } from "vitest";
import { isGeneratedContentHtml, contentAlreadyHasBlockHtml } from "../content-format";
import { convertAllMarkdownToHtml } from "../content-sanitizer";

describe("isGeneratedContentHtml", () => {
  it("detects harness HTML sections", () => {
    expect(isGeneratedContentHtml('<h2 id="x">Title</h2><p>Body.</p>')).toBe(true);
    expect(isGeneratedContentHtml("# Markdown heading\n\nParagraph.")).toBe(false);
  });

  it("does not treat markdown with stray HTML fragments as harness HTML", () => {
    expect(isGeneratedContentHtml("## Title\n\n<p>oops</p>\n\n**bold**")).toBe(false);
    expect(isGeneratedContentHtml("<p>only a paragraph</p>")).toBe(false);
  });
});

describe("convertAllMarkdownToHtml on HTML input", () => {
  it("does not wrap HTML tables in extra markdown passes", () => {
    const html =
      '<h2>Coverage</h2><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>';
    expect(contentAlreadyHasBlockHtml(html)).toBe(true);
    const out = convertAllMarkdownToHtml(html);
    expect(out).toBe(html);
    expect(out.match(/<table/gi)?.length).toBe(1);
  });

  it("still converts markdown links inside HTML", () => {
    const html = '<p>See [Example](https://example.com) for details.</p>';
    const out = convertAllMarkdownToHtml(html);
    expect(out).toContain('<a href="https://example.com">Example</a>');
  });
});
