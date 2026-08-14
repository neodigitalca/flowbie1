import { describe, expect, it } from "vitest";
import { parseMetaVisualReferencePlan } from "@/lib/ppc/meta-ad-visual-reference-plan";
import {
  DEVICE_PALETTE,
  TYPOGRAPHY_PALETTE,
  withToolPalette,
} from "@/lib/ppc/__tests__/meta-ad-test-fixtures";

const designedBriefBase = {
  strategyStatement: "Product ad.",
  captionHook: "Hook.",
  onImageHeadline: "Scale SEO",
  onImageSubline: "",
  visualConcept: "Designed graphic",
  visualVibe: "clean-premium",
  backgroundTreatment: "Light studio",
  useMapOverlay: false,
  creativeStyle: "designed_graphic" as const,
};

const designedBrief = withToolPalette(designedBriefBase, TYPOGRAPHY_PALETTE);

const deviceBrief = withToolPalette(designedBriefBase, DEVICE_PALETTE);

describe("run-meta-ad-visual-reference-plan parser", () => {
  it("validates elements schema fields", () => {
    const elements = parseMetaVisualReferencePlan(
      {
        elements: [
          {
            id: "1",
            label: "Instagram ad layout",
            kind: "layout",
            googleImageQuery: "instagram feed sponsored ad graphic design",
            acceptanceBrief: "Designed sponsored ad creative layout",
            pickCount: 1,
          },
          {
            id: "2",
            label: "MacBook hero",
            kind: "device",
            googleImageQuery: "2026 MacBook Pro product photo",
            acceptanceBrief: "Current MacBook with accurate proportions",
          },
        ],
      },
      undefined,
      { creativeBrief: deviceBrief },
    );
    expect(elements).toHaveLength(2);
    expect(elements[0]?.kind).toBe("layout");
    expect(elements[1]?.kind).toBe("device");
    expect(elements.every((element) => element.acceptanceBrief.length > 0)).toBe(true);
  });

  it("accepts query alias from LLM output", () => {
    const elements = parseMetaVisualReferencePlan(
      {
        elements: [
          {
            label: "Instagram ad layout",
            kind: "layout",
            query: "instagram feed sponsored ad graphic design",
            acceptanceBrief: "Designed ad layout",
          },
          {
            label: "Device vignette",
            kind: "device",
            query: "2026 laptop UI vignette product photo",
            acceptanceBrief: "Device vignette",
          },
        ],
      },
      undefined,
      {
        creativeBrief: withToolPalette(
          { ...designedBriefBase, creativeStyle: "photo_hero" as const },
          DEVICE_PALETTE,
        ),
      },
    );
    expect(elements[1]?.googleImageQuery).toContain("laptop");
  });
});
