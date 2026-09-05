import { describe, expect, it } from "vitest";
import {
  catalogFromBlocks,
  htmlTextFingerprint,
  isExistingHeadingTitle,
  parseFormatBlocks,
  reformatExistingHtmlHeadings,
  reformatExistingMarkdownHeadings,
  serializeFormatBlocks,
  setBlockTag,
  wrapBlocksAsList,
} from "@/lib/bulk/blog-import-format-blocks";
import { executeDirectFormatTool } from "@/lib/bulk/blog-import-format-tools";

const SAMPLE = `<p>Intro about succession for owners and managers.</p>
<p><strong>September 3, 2026</strong></p>
<p>Understanding Business Succession: Ownership vs. Management</p>
<p>Business succession planning ensures continuity by preparing for future leadership.</p>
<p>Management vs. Ownership Succession</p>
<p><strong>Management succession</strong> involves transferring day-to-day leadership.</p>`;

describe("Direct format blocks", () => {
  it("parses top-level paragraphs and keeps inner strong", () => {
    const blocks = parseFormatBlocks(SAMPLE);
    expect(blocks.length).toBeGreaterThanOrEqual(5);
    expect(blocks[1]?.innerHtml).toContain("<strong>September 3, 2026</strong>");
    expect(htmlTextFingerprint(serializeFormatBlocks(blocks))).toBe(htmlTextFingerprint(SAMPLE));
  });

  it("retags a heading paragraph without changing words", () => {
    const blocks = parseFormatBlocks(SAMPLE);
    const heading = blocks.find((b) => b.innerHtml.includes("Understanding Business Succession"));
    expect(heading).toBeTruthy();
    const error = setBlockTag(blocks, [heading!.id], "h2");
    expect(error).toBe("");
    const html = serializeFormatBlocks(blocks);
    expect(html).toContain("<h2>Understanding Business Succession: Ownership vs. Management</h2>");
    expect(html).toContain("<strong>September 3, 2026</strong>");
    expect(htmlTextFingerprint(html)).toBe(htmlTextFingerprint(SAMPLE));
  });

  it("wraps consecutive p blocks as a list without inventing words", () => {
    const html = "<p>First item</p><p>Second item</p><p>Third item</p>";
    const blocks = parseFormatBlocks(html);
    const error = wrapBlocksAsList(blocks, 0, 2, "ul");
    expect(error).toBe("");
    const out = serializeFormatBlocks(blocks);
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>First item</li>");
    expect(out).toContain("<li>Third item</li>");
    expect(htmlTextFingerprint(out)).toBe(htmlTextFingerprint(html));
  });

  it("rejects wrap_list when a block is not a paragraph", () => {
    const blocks = parseFormatBlocks("<h2>Title</h2><p>Body</p>");
    expect(wrapBlocksAsList(blocks, 0, 1, "ul")).toContain("consecutive p");
  });

  it("builds a catalog with ids and strong flags", () => {
    const items = catalogFromBlocks(parseFormatBlocks(SAMPLE));
    expect(items[1]?.hasStrong).toBe(true);
    expect(items[0]?.hasStrong).toBe(false);
    expect(items[2]?.textPreview).toContain("Understanding Business Succession");
  });
});

describe("Direct format tools", () => {
  it("set_block_tag keeps wording", () => {
    const html = "<p>Section Title Here</p><p>Body copy stays.</p>";
    const blocks = parseFormatBlocks(html);
    const retag = executeDirectFormatTool(blocks, "set_block_tag", { ids: [0], tag: "h2" });
    expect(retag.ok).toBe(true);
    const out = serializeFormatBlocks(blocks);
    expect(out).toContain("<h2>Section Title Here</h2>");
    expect(htmlTextFingerprint(out)).toBe(htmlTextFingerprint(html));
  });

  it("rejects h1 and unknown tools", () => {
    const blocks = parseFormatBlocks("<p>Title</p>");
    expect(executeDirectFormatTool(blocks, "set_block_tag", { ids: [0], tag: "h1" }).ok).toBe(false);
    expect(executeDirectFormatTool(blocks, "write_html", {}).ok).toBe(false);
  });
});

describe("reformat existing headings only", () => {
  it("converts a sole-line bold markdown heading and leaves inline bold", () => {
    const md = `**Why Succession Planning Matters**  
A well-designed succession plan helps organizations:

**Management succession** involves transferring day-to-day leadership.`;
    const out = reformatExistingMarkdownHeadings(md);
    expect(out).toContain("## Why Succession Planning Matters");
    expect(out).toContain("**Management succession** involves transferring");
    expect(out).not.toContain("## Management succession");
  });

  it("does not treat a long sentence as a heading title", () => {
    expect(
      isExistingHeadingTitle(
        "Succession planning should reflect where the business is heading and not just its current state or structure.",
      ),
    ).toBe(false);
    expect(isExistingHeadingTitle("Why Succession Planning Matters")).toBe(true);
  });

  it("splits glued HTML heading plus body without changing words", () => {
    const html =
      "<p><strong>Why Succession Planning Matters</strong><br>A well-designed succession plan helps organizations:</p>";
    const out = reformatExistingHtmlHeadings(html);
    expect(out).toContain("<h2>Why Succession Planning Matters</h2>");
    expect(out).toContain("<p>A well-designed succession plan helps organizations:</p>");
    expect(htmlTextFingerprint(out)).toBe(htmlTextFingerprint(html));
  });

  it("keeps an existing HTML table as a table", () => {
    const html = `<h2>What Can Owners Do to Build Value?</h2>
<table><thead><tr><th>Value Driver</th><th>Why Buyers Care</th><th>What Owners Can Focus On</th></tr></thead><tbody><tr><td><strong>Profitability and Sustainable Earnings</strong></td><td>Buyers are not simply purchasing last year's profit.</td><td>Review pricing and margins regularly</td></tr></tbody></table>`;
    const out = reformatExistingHtmlHeadings(html);
    expect(out).toContain("<table>");
    expect(out).toContain("Value Driver");
    expect(out).toContain("Profitability and Sustainable Earnings");
    expect(out).toContain("</table>");
    expect(htmlTextFingerprint(out)).toBe(htmlTextFingerprint(html));
  });
});
