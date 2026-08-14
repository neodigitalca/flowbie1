import { describe, expect, it } from "vitest";
import {
  formatMetaColorPaletteBlock,
  formatMetaColorPaletteBriefConstraint,
  hasMetaColorPalette,
  normalizeMetaColorHex,
  normalizeMetaColorPalette,
} from "@/lib/ppc/meta-ad-color-palette";
import { buildMetaUnifiedContextBlock } from "@/lib/ppc/meta-ad-context-assembler";
import { buildMetaImagePromptDescription } from "@/lib/ppc/meta-ad-prompt-builder";
import { TYPOGRAPHY_PALETTE, withToolPalette } from "@/lib/ppc/__tests__/meta-ad-test-fixtures";

describe("meta-ad-color-palette", () => {
  it("normalizes hex colors", () => {
    expect(normalizeMetaColorHex("#ABC")).toBe("#aabbcc");
    expect(normalizeMetaColorHex("84bc00")).toBe("#84bc00");
    expect(normalizeMetaColorHex("not-a-color")).toBeUndefined();
  });

  it("formats palette block for prompts", () => {
    const block = formatMetaColorPaletteBlock({
      background: "#02050a",
      accent: "#84bc00",
      primary: "#ffffff",
    });
    expect(block).toContain("background #02050a");
    expect(block).toContain("accent #84bc00");
    expect(block).toContain("primary text #ffffff");
  });

  it("returns null when palette is empty", () => {
    expect(hasMetaColorPalette(undefined)).toBe(false);
    expect(formatMetaColorPaletteBlock({})).toBeNull();
    expect(normalizeMetaColorPalette({ background: "notvalid" })).toBeUndefined();
  });

  it("adds brief constraint text", () => {
    const constraint = formatMetaColorPaletteBriefConstraint({ accent: "#84bc00" });
    expect(constraint).toContain("hex values exactly");
    expect(constraint).toContain("backgroundTreatment");
  });

  it("injects palette into unified context block", () => {
    const block = buildMetaUnifiedContextBlock({
      contextSource: "custom",
      focusKeyword: "AI SEO Edmonton",
      colorPalette: { background: "#02050a", accent: "#84bc00" },
    });
    expect(block).toContain("User color palette");
    expect(block).toContain("#02050a");
  });

  it("injects palette into image prompt description", () => {
    const brief = withToolPalette(
      {
        strategyStatement: "Test",
        captionHook: "Hook",
        onImageHeadline: "Get Found",
        onImageSubline: "",
        visualConcept: "Bold graphic",
        visualVibe: "bold-minimal",
        backgroundTreatment: "Dark gradient",
        useMapOverlay: false,
        creativeStyle: "designed_graphic",
      },
      TYPOGRAPHY_PALETTE,
    );
    const description = buildMetaImagePromptDescription({
      creativeBrief: brief,
      placement: "feed_1x1",
      colorPalette: { background: "#02050a", accent: "#84bc00" },
    });
    expect(description).toContain("User color palette");
    expect(description).toContain("#02050a");
  });
});
