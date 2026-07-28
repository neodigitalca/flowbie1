import { describe, expect, it } from "vitest";
import {
  countHtmlHeadingTags,
  enforceKeywordInExtraTextHeadings,
  extraTextHeadingContractOk,
  extraTextHeadingIncludesKeywordFocus,
  extraTextHeadingsIncludeKeywordFocus,
  extractFirstHeadingInnerText,
  finalizeExtraTextHtml,
  stitchExtraTextFragments,
} from "./extra-text-heading-contract";

describe("extraTextHeadingContractOk", () => {
  it("accepts HTML that starts with h2 and has one h3", () => {
    const html = `<h2>Provenance woven wood shades: overview</h2><p>Intro.</p><h3>Why choose Provenance woven wood shades</h3><p>More.</p>`;
    expect(extraTextHeadingContractOk(html)).toBe(true);
    expect(countHtmlHeadingTags(html, "h2")).toBe(1);
    expect(countHtmlHeadingTags(html, "h3")).toBe(1);
  });

  it("rejects plain paragraph without h2", () => {
    expect(extraTextHeadingContractOk("<p>Key considerations</p>")).toBe(false);
  });

  it("converts markdown ## to h2 via finalize", () => {
    const md = "## Provenance woven wood shades\n\nBody.\n\n### Why Provenance woven wood shades\n\nMore.";
    const html = finalizeExtraTextHtml(md);
    expect(extraTextHeadingContractOk(html)).toBe(true);
    expect(extraTextHeadingsIncludeKeywordFocus(html, "Provenance woven wood shades")).toBe(true);
  });
});

describe("extraTextHeadingIncludesKeywordFocus", () => {
  it("requires exact keyword phrase in heading", () => {
    expect(extraTextHeadingIncludesKeywordFocus("About custom drapes", "custom drapes")).toBe(true);
    expect(extraTextHeadingIncludesKeywordFocus("About custom drapery", "custom drapes")).toBe(false);
  });
});

describe("enforceKeywordInExtraTextHeadings", () => {
  it("prepends keyword when h2/h3 omit it", () => {
    const html =
      "<h2>Planning your visit</h2><p>x</p><h3>Next steps</h3><p>y</p>";
    const out = enforceKeywordInExtraTextHeadings(html, "custom drapes");
    expect(extraTextHeadingsIncludeKeywordFocus(out, "custom drapes")).toBe(true);
  });
});

describe("stitchExtraTextFragments", () => {
  it("joins h2 and h3 with keyword in both headings", () => {
    const h2 = "<h2>Provenance woven wood shades: what to expect</h2><p>Intro.</p>";
    const h3 = "<h3>Installing Provenance woven wood shades in Stuart</h3><p>More detail.</p>";
    const html = stitchExtraTextFragments(h2, h3);
    expect(extraTextHeadingContractOk(html)).toBe(true);
    expect(extraTextHeadingsIncludeKeywordFocus(html, "Provenance woven wood shades")).toBe(true);
    expect(extractFirstHeadingInnerText(html, "h2")).toContain("Provenance woven wood shades");
    expect(extractFirstHeadingInnerText(html, "h3")).toContain("Provenance woven wood shades");
  });
});
