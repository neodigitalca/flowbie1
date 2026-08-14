import { describe, expect, it } from "vitest";
import {
  buildMetaReferenceTargetsFromElements,
  buildMetaVisualReferencePlanSystemPrompt,
  buildMetaVisualReferencePlanUserPayload,
  buildVisualReferencePlanMarkdown,
  extractVisualReferenceElements,
  getMetaReferencePlanYear,
  metaTopicRequiresMapElement,
  META_IMAGE_REF_MAX_TARGETS,
  parseMetaVisualReferencePlan,
  validateVisualReferencePlan,
} from "@/lib/ppc/meta-ad-visual-reference-plan";
import {
  DEVICE_PALETTE,
  MAP_PALETTE,
  PHOTO_FOCAL_PALETTE,
  PHOTO_SKYLINE_DEVICE_PALETTE,
  SKYLINE_PALETTE,
  TYPOGRAPHY_PALETTE,
  withToolPalette,
} from "@/lib/ppc/__tests__/meta-ad-test-fixtures";

const designedBriefBase = {
  strategyStatement: "Local SEO awareness ad.",
  captionHook: "Search drives calls.",
  onImageHeadline: "Get Found Locally",
  onImageSubline: "",
  visualConcept: "Bold minimal feed graphic",
  visualVibe: "bold-minimal",
  backgroundTreatment: "Dark gradient",
  useMapOverlay: false,
  creativeStyle: "designed_graphic" as const,
};

const designedBrief = withToolPalette(designedBriefBase, TYPOGRAPHY_PALETTE);

const sceneBrief = withToolPalette(designedBriefBase, SKYLINE_PALETTE);

const deviceBrief = withToolPalette(designedBriefBase, DEVICE_PALETTE);

const mapBrief = withToolPalette(
  { ...designedBriefBase, useMapOverlay: true },
  MAP_PALETTE,
);

const photoHeroBrief = withToolPalette(
  { ...designedBriefBase, creativeStyle: "photo_hero" as const },
  PHOTO_FOCAL_PALETTE,
);

const photoHeroSceneDeviceBrief = withToolPalette(
  { ...designedBriefBase, creativeStyle: "photo_hero" as const },
  PHOTO_SKYLINE_DEVICE_PALETTE,
);

const layoutElement = {
  id: "1",
  label: "Instagram ad layout",
  kind: "layout" as const,
  googleImageQuery: "instagram feed sponsored ad graphic design bold typography",
  acceptanceBrief: "Designed sponsored ad creative layout",
};

const propElement = {
  id: "2",
  label: "Clipboard prop",
  kind: "prop" as const,
  googleImageQuery: "clipboard checklist product photo",
  acceptanceBrief: "Visible clipboard prop",
};

const sceneElement = {
  id: "3",
  label: "Edmonton skyline",
  kind: "scene" as const,
  googleImageQuery: "Edmonton skyline cityscape",
  acceptanceBrief: "Recognizable Edmonton skyline",
};

describe("meta-ad-visual-reference-plan", () => {
  it("injects current year into device queries missing a year", () => {
    const year = getMetaReferencePlanYear();
    const elements = parseMetaVisualReferencePlan(
      {
        elements: [
          layoutElement,
          {
            id: "3",
            label: "Tablet on stand",
            kind: "device",
            googleImageQuery: "iPad Pro on stand product photo",
            acceptanceBrief: "Current-model tablet on a stand, accurate bezels and proportions",
          },
        ],
      },
      year,
      { creativeBrief: deviceBrief },
    );
    expect(elements[0]?.googleImageQuery).toContain("graphic design");
    expect(elements[1]?.googleImageQuery).toMatch(new RegExp(`${year}.*iPad`, "i"));
  });

  it("maps element kinds to grounded targets with labels as roles", () => {
    const elements = parseMetaVisualReferencePlan(
      {
        elements: [
          layoutElement,
          {
            id: "4",
            label: "Tablet on stand",
            kind: "device",
            googleImageQuery: "2026 iPad Pro on stand product photo",
            acceptanceBrief: "Current-model tablet on a stand",
          },
          {
            id: "5",
            label: "SEO audit scene",
            kind: "scene",
            googleImageQuery: "SEO audit desk photo",
            acceptanceBrief: "Professional SEO audit environment",
          },
        ],
      },
      undefined,
      { creativeBrief: photoHeroSceneDeviceBrief },
    );
    const targets = buildMetaReferenceTargetsFromElements(elements);
    expect(targets.length).toBeLessThanOrEqual(META_IMAGE_REF_MAX_TARGETS);
    expect(targets[1]?.role).toBe("Tablet on stand");
    expect(targets[2]?.query).toContain("SEO audit");
  });

  it("builds markdown for research accordion", () => {
    const markdown = buildVisualReferencePlanMarkdown([
      {
        id: "4",
        label: "Tablet on stand",
        kind: "device",
        googleImageQuery: "2026 iPad Pro on stand product photo",
        acceptanceBrief: "Current-model tablet on a stand",
      },
    ]);
    expect(markdown).toContain("# Visual reference plan");
    expect(markdown).toContain("Tablet on stand");
    expect(markdown).toContain("2026 iPad Pro on stand product photo");
  });

  it("rejects invalid plans", () => {
    expect(() => parseMetaVisualReferencePlan({ elements: [] })).toThrow(
      "Visual reference plan returned no elements (keys: elements).",
    );
    expect(() => parseMetaVisualReferencePlan({ plan: {} })).toThrow(
      "Visual reference plan returned no elements (keys: plan).",
    );
    expect(() =>
      parseMetaVisualReferencePlan({
        elements: [{ label: "x", kind: "bad-kind", googleImageQuery: "q", acceptanceBrief: "a" }],
      }),
    ).toThrow("Visual reference plan returned no valid elements.");
  });

  it("allows layout-only plan when brief has no skyline even with localityCity", () => {
    const elements = parseMetaVisualReferencePlan(
      { elements: [layoutElement] },
      undefined,
      {
        creativeBrief: designedBrief,
        localityCity: "Edmonton",
      },
    );
    expect(elements).toHaveLength(1);
    expect(elements[0]?.kind).toBe("layout");
  });

  it("allows locality plan without a device element", () => {
    const elements = parseMetaVisualReferencePlan(
      { elements: [layoutElement, sceneElement] },
      undefined,
      { creativeBrief: sceneBrief, localityCity: "Edmonton" },
    );
    expect(elements.some((element) => element.kind === "scene")).toBe(true);
    expect(elements.some((element) => element.kind === "device")).toBe(false);
  });

  it("allows layout-only plan for designed_graphic brief without locality", () => {
    const elements = parseMetaVisualReferencePlan(
      { elements: [layoutElement] },
      undefined,
      { creativeBrief: designedBrief },
    );
    expect(elements).toHaveLength(1);
    expect(elements[0]?.kind).toBe("layout");
  });

  it("accepts visualElements alias with layout and prop for photo_hero", () => {
    const elements = parseMetaVisualReferencePlan(
      { visualElements: [layoutElement, propElement] },
      undefined,
      { creativeBrief: photoHeroBrief },
    );
    expect(elements).toHaveLength(2);
    expect(elements[0]?.kind).toBe("layout");
    expect(elements[1]?.kind).toBe("prop");
  });

  it("extracts nested plan.elements", () => {
    const raw = extractVisualReferenceElements({
      plan: {
        elements: [layoutElement, propElement],
      },
    });
    expect(raw).toHaveLength(2);
  });

  it("requires map element only when brief.useMapOverlay is true", () => {
    expect(
      metaTopicRequiresMapElement({
        focusKeyword: "AI SEO Edmonton",
        creativeBrief: designedBrief,
      }),
    ).toBe(false);
    expect(
      metaTopicRequiresMapElement({
        creativeBrief: mapBrief,
      }),
    ).toBe(true);
    expect(() =>
      validateVisualReferencePlan([layoutElement, propElement], { creativeBrief: mapBrief }),
    ).not.toThrow();
  });

  it("adds Flowbie product rules to system prompt", () => {
    const prompt = buildMetaVisualReferencePlanSystemPrompt({
      contextSource: "flowbie_app",
      creativeMode: "product_saas",
      creativeBrief: designedBrief,
    });
    expect(prompt).toContain("FlowbieONE product ad rules");
    expect(prompt).toContain("visualToolPalette");
    expect(prompt).not.toContain("visualElementKinds");
    expect(prompt).not.toContain("white-background product photography queries only");
  });

  it("includes creativeBrief in user payload", () => {
    const payload = JSON.parse(
      buildMetaVisualReferencePlanUserPayload({
        creativeBrief: designedBrief,
        goal: {
          visualDirection: "Designed feed graphic",
          primaryTopic: "FlowbieONE",
          creativeMode: "product_saas",
        },
        placement: "feed_1x1",
        placementLabel: "Square feed",
        currentYear: 2026,
        contextSource: "flowbie_app",
        programBrief: "# FlowbieONE program brief",
      }),
    );
    expect(payload.creativeBrief.creativeStyle).toBe("designed_graphic");
    expect(payload.creativeBrief.visualToolPalette.typography.chance).toBe(0.9);
    expect(payload.programBrief).toContain("FlowbieONE program brief");
    expect(payload.outputSchema.elements[0].kind).toContain("map");
  });
});
