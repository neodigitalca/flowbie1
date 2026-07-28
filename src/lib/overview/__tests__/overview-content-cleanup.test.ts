import { describe, expect, it } from "vitest";
import {
  cleanupOverviewPostContent,
  convertMarkdownTablesToHtml,
  stripContentH1Blocks,
} from "@/lib/overview/overview-content-cleanup";

describe("stripContentH1Blocks", () => {
  it("removes every h1 block including attributes", () => {
    const html =
      `<h1 class="entry-title">Page Title Dup</h1><p>Lead</p><h1 id="x">Second</h1><h2>Keep</h2>`;
    const { html: out, removedCount } = stripContentH1Blocks(html);
    expect(removedCount).toBe(2);
    expect(out).toBe(`<p>Lead</p><h2>Keep</h2>`);
    expect(out.toLowerCase()).not.toContain("<h1");
  });

  it("returns unchanged when no h1", () => {
    const html = `<h2>A</h2><p>b</p>`;
    expect(stripContentH1Blocks(html)).toEqual({ html, removedCount: 0 });
  });
});

describe("convertMarkdownTablesToHtml", () => {
  it("converts pipe tables to HTML", () => {
    const html = `Intro\n| Q | A |\n| --- | --- |\n| One? | Yes |\nAfter`;
    const { html: out, convertedCount } = convertMarkdownTablesToHtml(html);
    expect(convertedCount).toBe(1);
    expect(out).toContain("<table><thead><tr><th>Q</th><th>A</th></tr></thead>");
    expect(out).toContain("<td>One?</td><td>Yes</td>");
    expect(out).toContain("Intro");
    expect(out).toContain("After");
  });

  it("leaves existing HTML tables alone", () => {
    const html = `<table><thead><tr><th>Q</th></tr></thead><tbody><tr><td>A</td></tr></tbody></table>`;
    const { html: out, convertedCount } = convertMarkdownTablesToHtml(html);
    expect(convertedCount).toBe(0);
    expect(out).toBe(html);
  });
});

describe("cleanupOverviewPostContent", () => {
  it("strips h1 then converts markdown tables", () => {
    const html =
      `<h1>Dup</h1><p>x</p>\n| Col |\n| --- |\n| Val |\n`;
    const r = cleanupOverviewPostContent(html);
    expect(r.removedH1Count).toBe(1);
    expect(r.convertedTableCount).toBe(1);
    expect(r.html.toLowerCase()).not.toContain("<h1");
    expect(r.html).toContain("<th>Col</th>");
    expect(r.html).toContain("<td>Val</td>");
  });
});
