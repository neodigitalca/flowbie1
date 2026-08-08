import { describe, expect, it } from "vitest";
import { isGeneratedContentHtml } from "@/lib/content-generation/content-format";
import {
  convertAllMarkdownToHtml,
  removeFeatureLabelArtifacts,
  sanitizePlaceholders,
} from "@/lib/content-generation/content-sanitizer";
import { repairHarnessHtmlForUpload } from "@/lib/content-generation/repair-harness-html";
import { markdownToHtml } from "@/lib/markdown-to-html";

describe("bulk HTML upload path helpers", () => {
  const harnessHtml = [
    '<div class="flo-overview">',
    "<h2 id=\"overview\">Overview</h2>",
    "<p>Intro paragraph about warranty coverage.</p>",
    "</div>",
    "<h2 id=\"coverage\">Coverage</h2>",
    "<p>First coverage paragraph.</p>",
    "<table><thead><tr><th>Item</th></tr></thead><tbody><tr><td>Defects</td></tr></tbody></table>",
  ].join("\n");

  it("detects stitched harness output as HTML", () => {
    expect(isGeneratedContentHtml(harnessHtml)).toBe(true);
  });

  it("skips markdown conversion passes that would duplicate HTML", () => {
    const repaired = repairHarnessHtmlForUpload(harnessHtml);
    const converted = convertAllMarkdownToHtml(repaired);
    expect(converted).toBe(repaired);
    expect(converted).not.toContain("<br>");
  });

  it("does not skip markdownToHtml when harness markdown contains a stray p tag", async () => {
    const markdownHarness = "## Overview\n\n<p>fragment</p>\n\n**Lifetime Protection**";
    expect(isGeneratedContentHtml(markdownHarness)).toBe(false);
    const html = await markdownToHtml(markdownHarness);
    expect(html).toContain("<h2");
    expect(html).not.toContain("## Overview");
  });

  it("markdownToHtml still converts markdown links in legacy markdown harness", async () => {
    const md = "## Overview\n\nSee [warranty guide](https://example.com/warranty) for details.";
    const html = await markdownToHtml(md);
    expect(html).toContain('<a href="https://example.com/warranty">');
  });

  it("sanitizePlaceholders preserves [[EXTERNAL:...]] tokens", () => {
    const input =
      "See [[EXTERNAL:https://example.com/warranty|warranty guide]] for details.";
    expect(sanitizePlaceholders(input)).toContain(
      "[[EXTERNAL:https://example.com/warranty|warranty guide]]",
    );
  });

  it("sanitizePlaceholders preserves [[LINK:...]] tokens", () => {
    const input = "See [[LINK:employment expenses|expense rules]] before filing.";
    expect(sanitizePlaceholders(input)).toContain("[[LINK:employment expenses|expense rules]]");
  });

  it("sanitizePlaceholders preserves [[SCROLL:...]] tokens", () => {
    const input = "See [[SCROLL:#coverage|warranty details]] in this guide.";
    expect(sanitizePlaceholders(input)).toContain("[[SCROLL:#coverage|warranty details]]");
  });

  it("removeFeatureLabelArtifacts does not strip markdown links after [LINK]:", () => {
    const input =
      "[LINK]: See [official guide](https://example.com/warranty) for coverage.";
    const out = removeFeatureLabelArtifacts(input);
    expect(out).toContain("[official guide](https://example.com/warranty)");
    expect(out).not.toMatch(/^\]\(https:\/\//);
  });
});
