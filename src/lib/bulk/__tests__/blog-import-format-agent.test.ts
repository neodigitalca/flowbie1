import { describe, expect, it } from "vitest";
import { formatDirectImportHtmlWithAgent } from "@/lib/bulk/blog-import-format-agent";
import { formatDirectImportHtml } from "@/lib/bulk/blog-import-direct";

const PART2_HEADING_SNIPPET = `**Why Succession Planning Matters**  
A well-designed succession plan helps organizations:

* Maintain leadership continuity during planned or unexpected departures.

**Build for Tomorrow, Not Today**  
Succession planning should reflect where the business is heading and not just its current state or structure.

**Management succession** involves transferring responsibility for the day-to-day leadership of the business.`;

describe("Direct format existing headings", () => {
  it("does not call OpenRouter and does not invent headings from body copy", async () => {
    const html = await formatDirectImportHtmlWithAgent({
      html: "<p>Only body copy about succession planning.</p>",
      postTitle: "Succession Planning: Retention, Pt 2",
      apiKey: "unused",
    });
    expect(html).toContain("<p>Only body copy about succession planning.</p>");
    expect(html).not.toMatch(/<h[1-6]/i);
  });

  it("does not promote a plain paragraph that was never a heading", async () => {
    const html = await formatDirectImportHtmlWithAgent({
      html: "<p>Understanding Business Succession: Ownership vs. Management</p><p>Body stays the same.</p>",
      postTitle: "Title",
      apiKey: "unused",
    });
    expect(html).toContain("<p>Understanding Business Succession: Ownership vs. Management</p>");
    expect(html).not.toMatch(/<h2>/i);
  });

  it("splits a glued bold heading from the following sentence", async () => {
    const source =
      "<p><strong>Why Succession Planning Matters</strong><br>A well-designed succession plan helps organizations:</p>";
    const html = await formatDirectImportHtmlWithAgent({
      html: source,
      postTitle: "Title",
      apiKey: "unused",
    });
    expect(html).toContain("<h2>Why Succession Planning Matters</h2>");
    expect(html).toContain("<p>A well-designed succession plan helps organizations:</p>");
    expect(html).not.toMatch(/<h2>[^<]*A well-designed/i);
  });

  it("keeps existing h2 and demotes body h1", async () => {
    const html = await formatDirectImportHtmlWithAgent({
      html: "<h1>Why Succession Planning Matters</h1><h2>Developing Internal Talent</h2><p>Body.</p>",
      postTitle: "Title",
      apiKey: "unused",
    });
    expect(html).toContain("<h2>Why Succession Planning Matters</h2>");
    expect(html).toContain("<h2>Developing Internal Talent</h2>");
    expect(html).not.toMatch(/<h1>/i);
  });

  it("leaves inline bold terms as paragraphs", async () => {
    const html = await formatDirectImportHtmlWithAgent({
      html: "<p><strong>Management succession</strong> involves transferring responsibility for the day-to-day leadership of the business.</p>",
      postTitle: "Title",
      apiKey: "unused",
    });
    expect(html).toContain("<p><strong>Management succession</strong> involves transferring");
    expect(html).not.toMatch(/<h2>/i);
  });

  it("leaves a bold date line as a paragraph", async () => {
    const html = await formatDirectImportHtmlWithAgent({
      html: "<p><strong>September 3, 2026</strong></p>",
      postTitle: "Title",
      apiKey: "unused",
    });
    expect(html).toContain("<p><strong>September 3, 2026</strong></p>");
    expect(html).not.toMatch(/<h2>/i);
  });
});

describe("Direct markdown already-bold headings", () => {
  it("turns sole-line bold titles into h2 and keeps the next sentence in a paragraph", () => {
    const html = formatDirectImportHtml({ imported_markdown: PART2_HEADING_SNIPPET });
    expect(html).toMatch(/<h2[^>]*>Why Succession Planning Matters<\/h2>/);
    expect(html).toMatch(/<h2[^>]*>Build for Tomorrow, Not Today<\/h2>/);
    expect(html).toContain("A well-designed succession plan helps organizations:");
    expect(html).not.toMatch(/<h2[^>]*>[^<]*A well-designed/i);
    expect(html).toContain("<strong>Management succession</strong>");
    expect(html).not.toMatch(/<h2[^>]*>Management succession<\/h2>/);
  });
});
