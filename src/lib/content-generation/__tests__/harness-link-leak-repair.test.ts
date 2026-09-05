import { describe, expect, it } from "vitest";
import {
  labelFromHashId,
  repairBareHashParenLeaks,
  repairHarnessLinkLeaks,
  repairHarnessPlaceholderLeaks,
  repairMarkdownLinkLeaksInHtml,
} from "../harness-link-leak-repair";

describe("repairBareHashParenLeaks", () => {
  it("converts bare (#section-id) to a hash anchor link", () => {
    const html =
      "<li><strong>Replacement Timing</strong>: Identify indicators that suggest it is time to (#when-to-replace-your-hunter-douglas-battery-wand).</li>";
    const labelById = new Map([
      ["when-to-replace-your-hunter-douglas-battery-wand", "When To Replace Your Hunter Douglas Battery Wand"],
    ]);
    const out = repairBareHashParenLeaks(html, labelById);
    expect(out).toContain('href="#when-to-replace-your-hunter-douglas-battery-wand"');
    expect(out).not.toContain("(#when-to-replace");
  });

  it("derives readable anchor text from slug when no label map exists", () => {
    const out = repairBareHashParenLeaks("<p>See (#cost-comparison) for details.</p>");
    expect(out).toContain('href="#cost-comparison"');
    expect(out).toContain(labelFromHashId("cost-comparison"));
    expect(out).not.toMatch(/\(#/);
  });
});

describe("repairHarnessPlaceholderLeaks", () => {
  it("expands unresolved SCROLL tokens", () => {
    const html = "<li>Explore [[SCROLL:#dental-services|preventive care]] today.</li>";
    const out = repairHarnessPlaceholderLeaks(html);
    expect(out).toContain('<a href="#dental-services">preventive care</a>');
    expect(out).not.toContain("[[SCROLL:");
  });

  it("strips unresolved LINK tokens to anchor text only", () => {
    const html = "<p>See [[LINK:Hunter Douglas|Hunter Douglas shades]] here.</p>";
    const out = repairHarnessPlaceholderLeaks(html);
    expect(out).toContain("Hunter Douglas shades");
    expect(out).not.toContain("[[LINK:");
  });
});

describe("repairMarkdownLinkLeaksInHtml", () => {
  it("converts markdown hash links left in HTML", () => {
    const html = "<p>Review [replacement timing](#when-to-replace-your-battery-wand) before buying.</p>";
    const out = repairMarkdownLinkLeaksInHtml(html);
    expect(out).toContain('<a href="#when-to-replace-your-battery-wand">replacement timing</a>');
    expect(out).not.toMatch(/\[.*\]\(#/);
  });
});

describe("repairHarnessLinkLeaks", () => {
  it("removes all harness syntax leaks in one pass", () => {
    const html = [
      "<p>Topic [[LINK:query|anchor phrase]] and (#missing-link).</p>",
      "<li>See [[SCROLL:#section-one|section one]] now.</li>",
    ].join("");
    const out = repairHarnessLinkLeaks(html);
    expect(out).not.toContain("[[LINK:");
    expect(out).not.toContain("[[SCROLL:");
    expect(out).not.toMatch(/\(#/);
    expect(out).toContain('href="#section-one"');
    expect(out).toContain('href="#missing-link"');
  });
});
