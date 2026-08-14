import type { MetaAdCreativeBrief, MetaAdPlacement, MetaAdVisualReferenceElement } from "@/lib/ppc/meta-ads-types";
import { metaAdPlacementLabel } from "@/lib/ppc/meta-ads-field-limits";
import {
  formatVisualToolPaletteBlock,
  META_DEVICE_SCREEN_ABSTRACT_RULE,
  visualToolIsActive,
} from "@/lib/ppc/meta-ad-visual-tool-palette";
import { metaVisualPlanIncludesDeviceUi } from "@/lib/ppc/meta-ad-device-ui-context";

export const META_IMAGE_REALISM_RULE = `Realism rule: Every object, screen, and scene element must look physically plausible and make visual sense together. On-image text is only the brief headline and optional subline.`;

export function buildMetaImageRealismSceneSpec(options: {
  creativeBrief: MetaAdCreativeBrief;
  placement: MetaAdPlacement;
  localityCity?: string;
  visualReferenceElements?: MetaAdVisualReferenceElement[];
}): string {
  const brief = options.creativeBrief;
  const city = options.localityCity?.trim();
  const skyline = brief.visualToolPalette.city_skyline;
  const placement = metaAdPlacementLabel(options.placement);
  const includesDevice =
    visualToolIsActive(brief.visualToolPalette.device_screen) ||
    metaVisualPlanIncludesDeviceUi(options.visualReferenceElements);

  const lines = [
    "SCENE SPEC:",
    `- Format: ${placement} sponsored ad`,
    `- Vibe: ${brief.visualVibe}`,
    `- Background treatment: ${brief.backgroundTreatment}`,
    `- Visual concept (follow exactly): ${brief.visualConcept}`,
    `- ${formatVisualToolPaletteBlock(brief.visualToolPalette)}`,
    `- On-image headline: "${brief.onImageHeadline}"`,
    brief.onImageSubline ? `- On-image subline: "${brief.onImageSubline}"` : "",
    city && visualToolIsActive(skyline)
      ? `- City backdrop: ${city} skyline or cityscape (city_skyline degree ${skyline.degree})`
      : city
        ? `- Locality: ${city} (city_skyline degree 0, no skyline required)`
        : "",
    META_IMAGE_REALISM_RULE,
  ].filter(Boolean);

  if (includesDevice) {
    lines.push(`- ${META_DEVICE_SCREEN_ABSTRACT_RULE}`);
  }

  return lines.join("\n");
}
