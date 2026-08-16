import type { MetaAdCreativeBrief, MetaAdPlacement, MetaAdVisualReferenceElement } from "@/lib/ppc/meta-ads-types";
import { metaAdPlacementLabel } from "@/lib/ppc/meta-ads-field-limits";
import {
  buildMetaDeviceScreenLayoutBlock,
  resolveMetaDeviceScreenLayout,
} from "@/lib/ppc/meta-ad-device-screen-layout";
import {
  formatVisualToolPaletteBlock,
  META_DEVICE_SCREEN_ABSTRACT_RULE,
  META_ICON_CLUSTER_NO_CHARTS_WITH_DEVICE,
  META_ICON_CLUSTER_RULES,
  visualToolIsActive,
} from "@/lib/ppc/meta-ad-visual-tool-palette";
import { metaVisualPlanIncludesDeviceUi } from "@/lib/ppc/meta-ad-device-ui-context";

export const META_IMAGE_ON_IMAGE_TEXT_SPEC = `On-image text: ON-IMAGE TEXT LOCK only, once, upper third. No duplicate lines, no footer repeat, no bottom-band text.`;

export const META_IMAGE_REALISM_RULE = `Realism rule: Every object, screen, and scene element must look physically plausible and make visual sense together. On-image text follows ON-IMAGE TEXT LOCK only, once.`;

export const META_IMAGE_ANTI_ABSTRACT_UI_RULE = `No holographic dashboards, floating analytics panels, neon wireframe globes, or abstract chart-only UI overlays unless device_screen is active with a realistic layout mockup.`;

export function buildMetaImageRealismSceneSpec(options: {
  creativeBrief: MetaAdCreativeBrief;
  placement: MetaAdPlacement;
  localityCity?: string;
  visualReferenceElements?: MetaAdVisualReferenceElement[];
  focusKeyword?: string;
  pageContext?: string;
}): string {
  const brief = options.creativeBrief;
  const city = options.localityCity?.trim();
  const skyline = brief.visualToolPalette.city_skyline;
  const placement = metaAdPlacementLabel(options.placement);
  const includesDevice =
    visualToolIsActive(brief.visualToolPalette.device_screen) ||
    metaVisualPlanIncludesDeviceUi(options.visualReferenceElements);
  const includesIcons = visualToolIsActive(brief.visualToolPalette.icon_cluster);
  const deviceLayout = resolveMetaDeviceScreenLayout(brief, {
    focusKeyword: options.focusKeyword,
    pageContext: options.pageContext,
  });
  const deviceLayoutBlock = includesDevice ? buildMetaDeviceScreenLayoutBlock(deviceLayout) : null;

  const lines = [
    "SCENE SPEC:",
    `- Format: ${placement} sponsored ad`,
    `- Vibe: ${brief.visualVibe}`,
    `- Background treatment: ${brief.backgroundTreatment}`,
    `- Visual concept (follow exactly): ${brief.visualConcept}`,
    `- ${formatVisualToolPaletteBlock(brief.visualToolPalette)}`,
    `- ${META_IMAGE_ON_IMAGE_TEXT_SPEC}`,
    city && visualToolIsActive(skyline)
      ? `- City backdrop: ${city} skyline or cityscape (city_skyline degree ${skyline.degree})`
      : city
        ? `- Locality: ${city} (city_skyline degree 0, no skyline required)`
        : "",
    META_IMAGE_REALISM_RULE,
    META_IMAGE_ANTI_ABSTRACT_UI_RULE,
  ].filter(Boolean);

  if (includesDevice) {
    lines.push(`- ${META_DEVICE_SCREEN_ABSTRACT_RULE}`);
    if (deviceLayoutBlock) {
      lines.push(deviceLayoutBlock);
    }
  }

  if (includesIcons) {
    lines.push(`- ${META_ICON_CLUSTER_RULES.replace(/\n/g, " ")}`);
    if (includesDevice) {
      lines.push(`- ${META_ICON_CLUSTER_NO_CHARTS_WITH_DEVICE}`);
    }
  }

  return lines.join("\n");
}
