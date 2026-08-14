import { formatMetaColorPaletteBriefConstraint } from "@/lib/ppc/meta-ad-color-palette";
import { META_FOCUS_KEYWORD_GRAMMAR_RULES } from "@/lib/ppc/meta-ad-focus-keyword-grammar";
import { formatMetaVisualToolPaletteBriefConstraint } from "@/lib/ppc/meta-ad-visual-tool-themes";
import {
  cloneVisualToolPalette,
  hasActiveVisualToolPalette,
  META_VISUAL_TOOL_OUTPUT_SCHEMA,
  META_VISUAL_TOOL_PALETTE_PROMPT,
  parseVisualToolPalette,
  visualToolPaletteMarkdown,
} from "@/lib/ppc/meta-ad-visual-tool-palette";
import {
  META_VALUE_PROPOSITION_RULES,
  resolveMetaAdvertiserLabel,
} from "@/lib/ppc/meta-ad-prompt-builder";
import { META_ADS_COPY_LIMITS_PROMPT } from "@/lib/ppc/meta-ads-field-limits";
import type {
  MetaAdColorPalette,
  MetaAdCreativeBrief,
  MetaAdCreativeStyle,
  MetaAdInstagramGoal,
  MetaAdPlacement,
  MetaAdVisualToolPalette,
} from "@/lib/ppc/meta-ads-types";
import { metaAdPlacementLabel } from "@/lib/ppc/meta-ads-field-limits";

const VALID_VIBES = new Set([
  "bold-minimal",
  "neon-tech",
  "clean-premium",
  "warm-local",
  "high-contrast",
  "soft-gradient",
]);

const VALID_STYLES = new Set<MetaAdCreativeStyle>(["designed_graphic", "photo_hero"]);

export function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function buildMetaCreativeBriefSystemPrompt(siteName?: string | null): string {
  const advertiser = resolveMetaAdvertiserLabel(siteName);
  return `You are a senior Instagram ads creative director for ${advertiser}.

Plan the full ad before any copy or image is written. Lock exact on-image text and caption hook.
${META_VISUAL_TOOL_PALETTE_PROMPT}
Output visualToolPalette with all eight tools every generate. Vary degree values each generate for the same keyword unless userVisualToolPaletteConstraint is set.
When userVisualToolPaletteConstraint is set, output visualToolPalette with those exact degree values.
visualConcept describes only tools with degree above zero and their degrees.
Do not default every ad to a laptop. No tool is mandatory.
visualVibe and backgroundTreatment set mood and palette.
When userColorPalette is set in the payload, use those exact hex colors in backgroundTreatment.
useMapOverlay: when true, set map_overlay.degree above zero.
onImageHeadline must be natural English, never the raw focus keyword verbatim or jammed.
${META_VALUE_PROPOSITION_RULES}
${META_FOCUS_KEYWORD_GRAMMAR_RULES}
${META_ADS_COPY_LIMITS_PROMPT}
Return ONLY valid JSON matching outputSchema.`;
}

export function buildMetaCreativeBriefUserPayload(options: {
  goal: MetaAdInstagramGoal;
  focusKeyword?: string;
  placement: MetaAdPlacement;
  pageContext?: string;
  localityCity?: string;
  localityRegion?: string;
  colorPalette?: MetaAdColorPalette;
  visualToolPalette?: MetaAdVisualToolPalette;
}): string {
  const colorConstraint = formatMetaColorPaletteBriefConstraint(options.colorPalette);
  const toolConstraint = formatMetaVisualToolPaletteBriefConstraint(options.visualToolPalette);
  return JSON.stringify({
    task: "meta_ad_creative_brief",
    focusKeyword: options.focusKeyword?.trim() || "",
    placement: options.placement,
    placementLabel: metaAdPlacementLabel(options.placement),
    pageContext: options.pageContext?.trim() || "",
    localityCity: options.localityCity?.trim() || "",
    localityRegion: options.localityRegion?.trim() || "",
    userColorPalette: colorConstraint || "",
    userVisualToolPaletteConstraint: toolConstraint || "",
    goal: options.goal,
    outputSchema: {
      strategyStatement: "string, 2 to 3 sentences",
      captionHook: "string, sentence 1 angle with outcome or next step (not keyword paste)",
      onImageHeadline: "string, max 6 words, exact on-image text with outcome or next step",
      onImageSubline: "string, 3 to 5 words with outcome if headline is setup-only, or empty string",
      visualConcept: "string, tools with degree above zero and how they appear",
      visualVibe: "bold-minimal | neon-tech | clean-premium | warm-local | high-contrast | soft-gradient",
      backgroundTreatment: "string, mood-driven colors from vibe",
      useMapOverlay: false,
      creativeStyle: "designed_graphic | photo_hero",
      visualToolPalette: META_VISUAL_TOOL_OUTPUT_SCHEMA,
      referenceAdPattern:
        "optional: ad-01-bofu-action-list | ad-02-bofu-wordpress-connected | ad-03-mofu-agency-scale | ad-04-mofu-enterprise-flows | ad-05-tofu-local-search | ad-06-tofu-awareness",
    },
  });
}

export function parseMetaCreativeBrief(raw: unknown, _focusKeyword?: string): MetaAdCreativeBrief {
  const root = raw as Partial<MetaAdCreativeBrief>;
  const strategyStatement = root.strategyStatement?.trim();
  const captionHook = root.captionHook?.trim();
  const onImageHeadline = root.onImageHeadline?.trim();
  const onImageSubline = root.onImageSubline?.trim() ?? "";
  const visualConcept = root.visualConcept?.trim();
  const visualVibe = root.visualVibe?.trim();
  const backgroundTreatment = root.backgroundTreatment?.trim();
  const creativeStyle = root.creativeStyle?.trim() as MetaAdCreativeStyle | undefined;
  const useMapOverlay = root.useMapOverlay === true;
  const visualToolPalette = parseVisualToolPalette(root.visualToolPalette);

  if (
    !strategyStatement ||
    !captionHook ||
    !onImageHeadline ||
    !visualConcept ||
    !visualVibe ||
    !backgroundTreatment ||
    !creativeStyle ||
    !VALID_STYLES.has(creativeStyle)
  ) {
    throw new Error("Creative brief returned incomplete JSON.");
  }

  if (countWords(onImageHeadline) > 6) {
    throw new Error("Creative brief onImageHeadline exceeds 6 words.");
  }
  if (onImageSubline && countWords(onImageSubline) > 5) {
    throw new Error("Creative brief onImageSubline exceeds 5 words.");
  }

  return {
    strategyStatement,
    captionHook,
    onImageHeadline,
    onImageSubline,
    visualConcept,
    visualVibe: visualVibe as MetaAdCreativeBrief["visualVibe"],
    backgroundTreatment,
    useMapOverlay,
    creativeStyle,
    visualToolPalette,
    referenceAdPattern: root.referenceAdPattern?.trim() || undefined,
  };
}

export function applyUserVisualToolPaletteToBrief(
  brief: MetaAdCreativeBrief,
  palette?: MetaAdVisualToolPalette,
): MetaAdCreativeBrief {
  if (!palette || !hasActiveVisualToolPalette(palette)) return brief;
  return { ...brief, visualToolPalette: cloneVisualToolPalette(palette) };
}

export function buildCreativeBriefMarkdown(brief: MetaAdCreativeBrief): string {
  return [
    "# Creative brief",
    "",
    "## Strategy",
    brief.strategyStatement,
    "",
    "## Caption hook",
    brief.captionHook,
    "",
    "## On-image text (exact)",
    `- Headline: ${brief.onImageHeadline}`,
    `- Subline: ${brief.onImageSubline || "none"}`,
    "",
    "## Visual",
    `- Concept: ${brief.visualConcept}`,
    `- Vibe: ${brief.visualVibe}`,
    `- Background: ${brief.backgroundTreatment}`,
    `- Style: ${brief.creativeStyle}`,
    `- Map overlay: ${brief.useMapOverlay ? "yes" : "no"}`,
    "",
    "## Visual tool palette (degree)",
    visualToolPaletteMarkdown(brief),
    brief.referenceAdPattern ? `- Reference pattern: ${brief.referenceAdPattern}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
