import { describe, expect, it } from "vitest";
import {
  buildMetaImageRealismSceneSpec,
  META_IMAGE_REALISM_RULE,
} from "@/lib/ppc/meta-ad-image-realism-spec";
import type { MetaAdCreativeBrief } from "@/lib/ppc/meta-ads-types";
import { DEVICE_PALETTE, SKYLINE_PALETTE, TYPOGRAPHY_PALETTE, withToolPalette } from "@/lib/ppc/__tests__/meta-ad-test-fixtures";
import { META_DEVICE_SCREEN_ABSTRACT_RULE } from "@/lib/ppc/meta-ad-visual-tool-palette";

const briefBase = {
  strategyStatement: "Drive local SEO leads.",
  captionHook: "Customers search before they call.",
  onImageHeadline: "Rank Higher Locally",
  onImageSubline: "SEO that works",
  visualConcept: "Warm co-working loft with walnut desk and open laptop",
  visualVibe: "clean-premium",
  backgroundTreatment: "Golden-hour window light with soft city bokeh",
  useMapOverlay: false,
  creativeStyle: "designed_graphic" as const,
};

const sampleBrief: MetaAdCreativeBrief = withToolPalette(briefBase, SKYLINE_PALETTE);

describe("meta-ad-image-realism-spec", () => {
  it("uses one general realism rule", () => {
    expect(META_IMAGE_REALISM_RULE).toMatch(/physically plausible/i);
  });

  it("builds scene spec from creative brief not white desk template", () => {
    const spec = buildMetaImageRealismSceneSpec({
      creativeBrief: {
        ...withToolPalette(briefBase, DEVICE_PALETTE),
        deviceScreenLayout: "elementor_editor",
      },
      placement: "feed_1x1",
      localityCity: "Edmonton",
      visualReferenceElements: [
        {
          id: "1",
          label: "Device ref",
          kind: "device",
          googleImageQuery: "2026 laptop mockup",
          acceptanceBrief: "Hardware vignette",
        },
      ],
    });

    expect(spec).toContain("SCENE SPEC");
    expect(spec).toContain("Warm co-working loft with walnut desk");
    expect(spec).not.toContain("one laptop on a clean desk");
    expect(spec).toContain(META_DEVICE_SCREEN_ABSTRACT_RULE);
    expect(spec).toContain("DEVICE SCREEN LAYOUT");
    expect(spec).toContain("Elementor-style page builder");
    expect(spec).toContain("Locality: Edmonton");
    expect(spec).toContain("Visual tool palette (degree):");
  });

  it("includes on-image text dedupe in scene spec", () => {
    const spec = buildMetaImageRealismSceneSpec({
      creativeBrief: withToolPalette(briefBase, TYPOGRAPHY_PALETTE),
      placement: "feed_1x1",
    });
    expect(spec).toContain("No duplicate lines");
  });

  it("omits device abstract rule when no device tool or refs", () => {
    const spec = buildMetaImageRealismSceneSpec({
      creativeBrief: withToolPalette(briefBase, TYPOGRAPHY_PALETTE),
      placement: "feed_1x1",
    });
    expect(spec).toContain("SCENE SPEC");
    expect(spec).not.toContain(META_DEVICE_SCREEN_ABSTRACT_RULE);
  });

  it("includes icon cluster cap rules when icon_cluster is active", () => {
    const spec = buildMetaImageRealismSceneSpec({
      creativeBrief: withToolPalette(briefBase, TYPOGRAPHY_PALETTE),
      placement: "feed_1x1",
    });
    expect(spec).toContain("at most 2 to 3 distinct icons");
  });

  it("omits icon cluster cap rules when icon_cluster is off", () => {
    const spec = buildMetaImageRealismSceneSpec({
      creativeBrief: withToolPalette(briefBase, SKYLINE_PALETTE),
      placement: "feed_1x1",
    });
    expect(spec).not.toContain("at most 2 to 3 distinct icons");
  });
});