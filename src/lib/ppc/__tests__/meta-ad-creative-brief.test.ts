import { describe, expect, it } from "vitest";
import {
  buildCreativeBriefMarkdown,
  countWords,
  parseMetaCreativeBrief,
} from "@/lib/ppc/meta-ad-creative-brief";

describe("meta-ad-creative-brief", () => {
  const validRaw = {
    strategyStatement: "Drive qualified leads for local SEO services with a designed feed ad.",
    captionHook: "Your customers search before they call. We make sure they find you.",
    onImageHeadline: "Get Found Locally",
    onImageSubline: "SEO that works",
    visualConcept: "Bold minimal feed graphic with local search motif",
    visualVibe: "bold-minimal",
    backgroundTreatment: "Dark branded gradient with lime accent",
    useMapOverlay: false,
    creativeStyle: "designed_graphic",
    visualToolPalette: {
      typography: { chance: 0.9, degree: 0.8 },
      icon_cluster: { chance: 0.6, degree: 0.5 },
      accent_shapes: { chance: 0.5, degree: 0.4 },
      city_skyline: { chance: 0, degree: 0 },
      device_screen: { chance: 0, degree: 0 },
      map_overlay: { chance: 0, degree: 0 },
      gradient_panel: { chance: 0.3, degree: 0.2 },
      photo_focal: { chance: 0, degree: 0 },
    },
  };

  it("parses a complete brief", () => {
    const brief = parseMetaCreativeBrief(validRaw, "AI SEO Edmonton");
    expect(brief.onImageHeadline).toBe("Get Found Locally");
    expect(brief.useMapOverlay).toBe(false);
    expect(brief.creativeStyle).toBe("designed_graphic");
  });

  it("rejects incomplete JSON", () => {
    expect(() => parseMetaCreativeBrief({ strategyStatement: "Only one field" })).toThrow(
      "Creative brief returned incomplete JSON.",
    );
  });

  it("rejects headline over 6 words", () => {
    expect(() =>
      parseMetaCreativeBrief(
        { ...validRaw, onImageHeadline: "One two three four five six seven" },
        "AI SEO Edmonton",
      ),
    ).toThrow("Creative brief onImageHeadline exceeds 6 words.");
  });

  it("builds markdown for research section", () => {
    const brief = parseMetaCreativeBrief(validRaw);
    const md = buildCreativeBriefMarkdown(brief);
    expect(md).toContain("# Creative brief");
    expect(md).toContain("Get Found Locally");
    expect(md).toContain("bold-minimal");
    expect(md).toContain("typography");
    expect(md).not.toContain("Forbidden on image");
  });

  it("counts words", () => {
    expect(countWords("Get Found Locally")).toBe(3);
  });
});
