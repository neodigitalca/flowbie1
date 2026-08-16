import { describe, expect, it } from "vitest";
import {
  buildMetaImageOnImageTextLockBlock,
  collapseConsecutiveDuplicateWords,
  mergeMandatoryMetaImageTextChecklist,
  normalizeMetaOnImageText,
  prepareCreativeBriefForImageGeneration,
  sanitizeVisualConceptForImage,
} from "@/lib/ppc/meta-ad-image-on-image-text";
import type { MetaAdCreativeBrief } from "@/lib/ppc/meta-ads-types";
import { emptyVisualToolPalette } from "@/lib/ppc/meta-ad-visual-tool-palette";

const baseBrief: MetaAdCreativeBrief = {
  strategyStatement: "Strategy",
  captionHook: "Hook",
  onImageHeadline: "Affordable SEO For Your Business",
  onImageSubline: "Grow online, spend less",
  visualConcept:
    "Bar chart with upward trend, icons for savings and search. Footer text Grow online, spend less. Overlay For Your Business on chart.",
  visualVibe: "bold-minimal",
  backgroundTreatment: "dark blue gradient",
  useMapOverlay: false,
  creativeStyle: "designed_graphic",
  visualToolPalette: emptyVisualToolPalette(),
};

describe("collapseConsecutiveDuplicateWords", () => {
  it("fixes stutter in headlines", () => {
    expect(collapseConsecutiveDuplicateWords("Websites That That Rank")).toBe("Websites That Rank");
    expect(collapseConsecutiveDuplicateWords("Get Found Found")).toBe("Get Found");
  });
});

describe("normalizeMetaOnImageText", () => {
  it("clears subline when identical to headline", () => {
    const normalized = normalizeMetaOnImageText({
      ...baseBrief,
      onImageHeadline: "Rank higher",
      onImageSubline: "Rank higher",
    });
    expect(normalized.onImageSubline).toBe("");
  });
});

describe("sanitizeVisualConceptForImage", () => {
  it("strips headline, subline, and partial headline fragments", () => {
    const sanitized = sanitizeVisualConceptForImage(baseBrief.visualConcept, baseBrief);
    expect(sanitized.toLowerCase()).not.toContain("grow online, spend less");
    expect(sanitized.toLowerCase()).not.toContain("for your business");
    expect(sanitized.toLowerCase()).not.toContain("affordable seo");
    expect(sanitized).toContain("Bar chart");
  });

  it("returns motif-only fallback when concept is only copy", () => {
    const sanitized = sanitizeVisualConceptForImage(
      "Affordable SEO For Your Business. Grow online, spend less.",
      baseBrief,
    );
    expect(sanitized).toContain("No on-image text in the visual concept");
  });
});

describe("prepareCreativeBriefForImageGeneration", () => {
  it("sanitizes visualConcept on the brief copy", () => {
    const prepared = prepareCreativeBriefForImageGeneration(baseBrief);
    expect(prepared.onImageHeadline).toBe(baseBrief.onImageHeadline);
    expect(prepared.visualConcept.toLowerCase()).not.toContain("grow online, spend less");
  });
});

describe("buildMetaImageOnImageTextLockBlock", () => {
  it("locks headline and subline to a single upper zone", () => {
    const block = buildMetaImageOnImageTextLockBlock(baseBrief);
    expect(block).toContain('Line 1: "Affordable SEO For Your Business"');
    expect(block).toContain('Line 2 (directly under line 1): "Grow online, spend less"');
    expect(block).toContain("upper third only");
    expect(block).toContain("Forbidden: splitting");
  });
});

describe("mergeMandatoryMetaImageTextChecklist", () => {
  it("prepends mandatory no-duplicate and no-spec-frame items", () => {
    const merged = mergeMandatoryMetaImageTextChecklist(
      [{ id: "agent-1", label: "Use brand colors" }],
      baseBrief,
    );
    expect(merged[0]?.id).toBe("mandatory-headline-once");
    expect(merged.some((item) => item.id === "mandatory-no-spec-frame")).toBe(true);
    expect(merged.some((item) => item.id === "agent-1")).toBe(true);
  });
});
