import { describe, expect, it } from "vitest";
import {
  emptyVisualToolPalette,
  formatVisualToolPaletteBlock,
  META_VISUAL_TOOL_KEYS,
  META_VISUAL_TOOL_LABELS,
  migrateLegacyPeopleToolPalette,
  parseVisualToolPalette,
  patchVisualToolWeight,
  resolveAllowPeopleInImage,
} from "@/lib/ppc/meta-ad-visual-tool-palette";
import { TYPOGRAPHY_PALETTE, SKYLINE_PALETTE, withToolPalette } from "@/lib/ppc/__tests__/meta-ad-test-fixtures";

const briefBase = {
  strategyStatement: "Test.",
  captionHook: "Hook.",
  onImageHeadline: "Headline",
  onImageSubline: "",
  visualConcept: "Typographic graphic",
  visualVibe: "bold-minimal",
  backgroundTreatment: "Dark gradient",
  useMapOverlay: false,
  creativeStyle: "designed_graphic" as const,
};

describe("meta-ad-visual-tool-palette", () => {
  it("reads degree from OpenRouter JSON and syncs chance", () => {
    const palette = parseVisualToolPalette({
      typography: { chance: 0.9, degree: 0.8 },
      icon_cluster: { chance: 0.6, degree: 0.5 },
    });
    expect(palette.typography).toEqual({ chance: 1, degree: 0.8 });
    expect(palette.icon_cluster).toEqual({ chance: 1, degree: 0.5 });
    expect(palette.device_screen).toEqual({ chance: 0, degree: 0 });
    expect(palette.people).toEqual({ chance: 0, degree: 0 });
  });

  it("reads missing tool fields as zero", () => {
    const palette = parseVisualToolPalette({ typography: { chance: 0.8, degree: 0.5 } });
    expect(palette.typography.degree).toBe(0.5);
    expect(palette.typography.chance).toBe(1);
    expect(palette.city_skyline.degree).toBe(0);
  });

  it("clamps values to 0-1", () => {
    const palette = parseVisualToolPalette({
      typography: { chance: 2, degree: -0.5 },
    });
    expect(palette.typography).toEqual({ chance: 0, degree: 0 });
  });

  it("includes all nine tools in empty palette", () => {
    const palette = emptyVisualToolPalette();
    expect(META_VISUAL_TOOL_KEYS).toHaveLength(9);
    for (const key of META_VISUAL_TOOL_KEYS) {
      expect(palette[key]).toEqual({ chance: 0, degree: 0 });
    }
  });

  it("labels icon_cluster as Icons", () => {
    expect(META_VISUAL_TOOL_LABELS.icon_cluster).toBe("Icons");
  });

  it("formats palette block for image prompt", () => {
    const line = formatVisualToolPaletteBlock(TYPOGRAPHY_PALETTE);
    expect(line).toContain("Visual tool palette (degree):");
    expect(line).toContain("typography 0.80");
    expect(line).toContain("icon_cluster 0.50");
  });

  it("two briefs with different palettes differ", () => {
    const typographic = withToolPalette(briefBase, TYPOGRAPHY_PALETTE);
    const skyline = withToolPalette(briefBase, SKYLINE_PALETTE);
    expect(typographic.visualToolPalette.city_skyline.degree).toBe(0);
    expect(skyline.visualToolPalette.city_skyline.degree).toBe(0.9);
  });

  it("derives allow people from people tool degree", () => {
    const palette = parseVisualToolPalette({ people: { chance: 0.5, degree: 0.4 } });
    expect(resolveAllowPeopleInImage(palette)).toBe(true);
    expect(resolveAllowPeopleInImage(emptyVisualToolPalette())).toBe(false);
  });

  it("migrates legacy allowPeopleInImage to people tool", () => {
    const migrated = migrateLegacyPeopleToolPalette(emptyVisualToolPalette(), true);
    expect(migrated.people.degree).toBe(1);
    expect(migrated.people.chance).toBe(1);
  });

  it("syncs chance when patching degree", () => {
    const off = patchVisualToolWeight(emptyVisualToolPalette(), "typography", "degree", 0);
    expect(off.typography).toEqual({ chance: 0, degree: 0 });
    const on = patchVisualToolWeight(emptyVisualToolPalette(), "typography", "degree", 0.7);
    expect(on.typography).toEqual({ chance: 1, degree: 0.7 });
  });
});
