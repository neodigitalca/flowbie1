import {
  META_FOCUS_KEYWORD_GRAMMAR_RULES,
} from "@/lib/ppc/meta-ad-focus-keyword-grammar";
import {
  buildMetaImageRealismSceneSpec,
  META_IMAGE_REALISM_RULE,
} from "@/lib/ppc/meta-ad-image-realism-spec";
import { formatVisualToolPaletteBlock, visualToolIsActive } from "@/lib/ppc/meta-ad-visual-tool-palette";
import { formatMetaColorPaletteBlock } from "@/lib/ppc/meta-ad-color-palette";
import { formatTypographyStyleForPrompt, type MetaAdTypographyStyle } from "@/lib/ppc/meta-ad-typography-styles";
import { META_ADS_COPY_LIMITS_PROMPT } from "@/lib/ppc/meta-ads-field-limits";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import type { MetaAdBlueprint, MetaAdColorPalette, MetaAdCreativeBrief, MetaAdCreativeMode, MetaAdInstagramGoal, MetaAdPlacement, MetaAdVisualReferenceElement } from "@/lib/ppc/meta-ads-types";
import { metaAdPlacementLabel } from "@/lib/ppc/meta-ads-field-limits";

export function resolveMetaAdvertiserLabel(siteName?: string | null): string {
  const name = siteName?.trim();
  if (!name) {
    throw new Error("Connected site name is required.");
  }
  return name;
}

export function buildMetaBrandRules(siteName?: string | null, colorPalette?: MetaAdColorPalette): string {
  const advertiser = resolveMetaAdvertiserLabel(siteName);
  const colorBlock = formatMetaColorPaletteBlock(colorPalette);
  const accentRule = colorBlock?.includes("accent ")
    ? "- Use the user accent hex from the color palette block below"
    : "- Accent #84BC00 (lime green) as highlight when it fits the brief visualVibe";
  const backgroundRule = colorBlock?.includes("background ")
    ? "- Background from user color palette (exact hex)"
    : "- Background from creative brief backgroundTreatment (vibe-driven, not keyword-driven)";
  return `${advertiser} creative rules:
- Designed Instagram feed sponsored-post creative (modern, engaging, bold type hierarchy)
${accentRule}
${backgroundRule}
- NEVER add logos (no brand logos)
- Voice: speak as we/our/us for ${advertiser}, factual, benefit-focused${colorBlock ? `\n- ${colorBlock}` : ""}`;
}

export const META_IMAGE_TEXT_RULES = `On-image text rules (critical):
- Render ONLY the exact headline and optional subline from the creative brief (once each)
- Never paste the focus keyword verbatim on the image
- Never duplicate the headline
- No body copy, bullets, URLs, CTA buttons, checklist text, or caption on the image
- Meta ad primaryText (caption) belongs in ad fields only, not painted into the creative`;

export const META_IMAGE_LAYOUT_RULES = `Layout rules:
- Must read as a real Instagram feed or story sponsored ad creative
- Designed graphic with bold typography AND visible focal graphic elements from visualConcept (icons, accent bars, shapes, abstract motifs)
- Not text-only on empty, white, or faded photo background
- Photo-hero only when creative brief creativeStyle is photo_hero
- No Instagram UI chrome (no profile bar, Sponsored label, like buttons, or phone bezels)`;

export const META_IMAGE_ANTI_PATTERNS = META_IMAGE_REALISM_RULE;

export const META_IMAGE_NO_PEOPLE_RULES = `People rules (default):
- Do NOT show people, faces, hands holding products, or human silhouettes
- Only include people when allowPeopleInImage is explicitly true`;

export const META_VALUE_PROPOSITION_RULES = `Value proposition (critical):
- Every hook, adAngle, captionHook, onImageHeadline, primaryText, headline, and description must state a concrete outcome, benefit, or next step.
- Never stop at setup alone: audience plus "we help" without what they get is incomplete.
- Bad: "We help Edmonton businesses". Good: "We help Edmonton get found", "Edmonton SEO that ranks", "Book your SEO audit".
- onImageHeadline (max 6 words): include the outcome in the headline, or put it in onImageSubline (3 to 5 words). Headline-only must still imply the result.`;

export const META_INSTAGRAM_CAPTION_RULES = `Instagram sponsored post voice:
- Write like a short feed caption, not a landing page or product spec
- One hook sentence, plain language, local/benefit focused, with a definitive outcome or next step
- For agency service ads: Neo Digital speaks as we/our/us offering help, not anonymous tips
- No jargon: avoid Search Console, actionable tasks, WordPress URLs, dashboard, pipeline
- primaryText is the caption users see; keep it under 2 short sentences
- headline and description are Meta ad fields only: short labels, not duplicate paragraphs`;

export function buildMetaPageContextBlock(page: PpcWpPageContext | undefined): string {
  if (!page) return "No landing page context available.";
  return [
    `URL: ${page.url}`,
    `Title: ${page.title}`,
    page.keyword ? `Keyword: ${page.keyword}` : "",
    page.metaDescription ? `Meta description: ${page.metaDescription}` : "",
    page.excerpt ? `Excerpt: ${page.excerpt.slice(0, 600)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildMetaInstagramGoalSystemPrompt(siteName?: string | null): string {
  const advertiser = resolveMetaAdvertiserLabel(siteName);
  return `You are an Instagram ads strategist for ${advertiser}.

Read all research before writing anything. State what this ad is trying to accomplish.
The landing page defines the offer and click destination. Context URL defines who we are and framing.
primaryTopic must match the landing page offer, not unrelated product UI.
creativeMode:
- agency_service: Neo Digital sells a service (SEO, web design, audits)
- product_saas: FlowbieONE product marketing only when landing/topic is the app
- local_lead: local business lead gen
visualDirection must follow the landing offer and creative strategy. Include visible designed graphic elements (icons, shapes, accent bars, motifs). Include a device or screen UI only when it supports the concept.
visualDirection must describe a designed Instagram feed creative concept (modern, engaging), not ad copy. Not text-only on empty background.
${META_VALUE_PROPOSITION_RULES}
${META_FOCUS_KEYWORD_GRAMMAR_RULES}
referenceQueries: 2 to 4 Google Images search queries for Instagram feed ad graphic design references.
${META_INSTAGRAM_CAPTION_RULES}
Return ONLY valid JSON matching outputSchema.`;
}

export function buildMetaInstagramGoalUserPayload(options: {
  landingPage: PpcWpPageContext | undefined;
  pageContext?: string;
  focusKeyword?: string;
  placement: MetaAdPlacement;
  contextSource?: string;
  landingPageUrl?: string;
  siteName?: string;
}): string {
  return JSON.stringify({
    task: "meta_ad_instagram_goal",
    siteName: options.siteName,
    placement: options.placement,
    placementLabel: metaAdPlacementLabel(options.placement),
    contextSource: options.contextSource ?? "custom",
    landingPageUrl: options.landingPageUrl?.trim() || options.landingPage?.url || "",
    focusKeyword: options.focusKeyword?.trim() || options.landingPage?.keyword?.trim() || "",
    landingPage: options.landingPage,
    pageContext: options.pageContext?.trim() || buildMetaPageContextBlock(options.landingPage),
    brandRules: buildMetaBrandRules(options.siteName),
    outputSchema: {
      goalStatement: "string, 2 to 3 sentences on ad success",
      primaryTopic: "string, one sentence topic aligned to landing page",
      audience: "string",
      adAngle: "string",
      hook: "string",
      visualDirection: "string, detailed art direction for image only",
      creativeMode: "agency_service | product_saas | local_lead",
      onImageTextHint: "string, max 6 words or none",
      referenceQueries: ["string"],
    },
  });
}

export function buildMetaBlueprintSystemPrompt(siteName?: string | null): string {
  const advertiser = resolveMetaAdvertiserLabel(siteName);
  return `You are a senior Meta (Facebook/Instagram) ads strategist for ${advertiser}.

Plan a single feed or story ad grounded in the landing page inventory context.
${META_INSTAGRAM_CAPTION_RULES}
visualDirection must describe photo-real props and environments on white backgrounds only, not ad copy.
Return ONLY valid JSON matching outputSchema.`;
}

export function buildMetaBlueprintUserPayload(options: {
  landingPage: PpcWpPageContext | undefined;
  pageContext?: string;
  focusKeyword?: string;
  placement: MetaAdPlacement;
  siteName?: string;
}): string {
  return JSON.stringify({
    task: "meta_ad_blueprint",
    siteName: options.siteName,
    placement: options.placement,
    placementLabel: metaAdPlacementLabel(options.placement),
    focusKeyword: options.focusKeyword?.trim() || options.landingPage?.keyword?.trim() || "",
    landingPage: options.landingPage,
    pageContext: options.pageContext?.trim() || buildMetaPageContextBlock(options.landingPage),
    brandRules: buildMetaBrandRules(options.siteName),
    outputSchema: {
      angle: "string, campaign angle in one sentence",
      audience: "string, target audience",
      hook: "string, scroll-stopping hook",
      visualDirection: "string, art direction for the ad image (visual only, no ad copy dump)",
    },
  });
}

export function buildMetaCopyChecklistSystemPrompt(siteName?: string | null): string {
  const advertiser = resolveMetaAdvertiserLabel(siteName);
  return `You are a Meta ads copy QA specialist for ${advertiser}.

Build a concise checklist (5 to 8 items) for Meta ad copy before writing the ad.
Each item must validate copy against the creative brief captionHook and goalStatement.
Caption must expand captionHook and must not duplicate onImageHeadline verbatim.
Include a checklist item that rejects setup-only copy with no outcome or next step.
${META_VALUE_PROPOSITION_RULES}
${META_FOCUS_KEYWORD_GRAMMAR_RULES}
${META_ADS_COPY_LIMITS_PROMPT}
Return ONLY valid JSON with this exact shape:
{"items":[{"id":"1","label":"...","detail":"..."}]}
Every item must have a non-empty label.`;
}

export function buildMetaImageChecklistSystemPrompt(options?: {
  allowPeopleInImage?: boolean;
  siteName?: string | null;
}): string {
  const noPeopleBlock =
    options?.allowPeopleInImage === true ? "" : `\n${META_IMAGE_NO_PEOPLE_RULES}`;
  const advertiser = resolveMetaAdvertiserLabel(options?.siteName);
  return `You are a Meta ads creative director for ${advertiser}.

Build an image generation checklist (5 to 8 items) for a Meta ad creative.
Follow creative brief visualConcept and visualReferenceElements exactly. Do not add elements not in the plan.
${META_IMAGE_TEXT_RULES}
${META_IMAGE_LAYOUT_RULES}
${META_IMAGE_ANTI_PATTERNS}${noPeopleBlock}
${buildMetaBrandRules(options?.siteName)}
Checklist items must enforce the creative brief and ${META_IMAGE_REALISM_RULE}
Do not add items that ask to render full ad copy, paragraphs, or CTA buttons in the image.
Return ONLY valid JSON with this exact shape:
{"items":[{"id":"1","label":"...","detail":"..."}]}
Every item must have a non-empty label.`;
}

export function buildMetaCopySystemPrompt(siteName?: string | null): string {
  const advertiser = resolveMetaAdvertiserLabel(siteName);
  return `You are a senior Meta (Facebook/Instagram) ads copywriter for ${advertiser}.

Write ad copy grounded in the Instagram ad goal, creative brief, landing page, and checklist.
Caption (primaryText) must expand creativeBrief.captionHook in sentence 1. Do not paste onImageHeadline as the full caption.
Do not advertise FlowbieONE unless primaryTopic is FlowbieONE.
${META_VALUE_PROPOSITION_RULES}
${META_FOCUS_KEYWORD_GRAMMAR_RULES}
${META_INSTAGRAM_CAPTION_RULES}
${META_ADS_COPY_LIMITS_PROMPT}
finalUrl is provided separately; do not change it.
Return ONLY valid JSON matching outputSchema.`;
}

export function formatMetaChecklistForPrompt(items: { label: string; detail?: string }[]): string {
  return items
    .map((item, index) => `${index + 1}. ${item.label}${item.detail ? `: ${item.detail}` : ""}`)
    .join("\n");
}

export function formatMetaVisualReferenceElementsForPrompt(
  elements: MetaAdVisualReferenceElement[],
): string {
  const lines = elements.map(
    (element) =>
      `- ${element.label} (${element.kind}): attached ref must satisfy "${element.acceptanceBrief}"`,
  );
  const hasDevice = elements.some((element) => element.kind === "device");
  if (hasDevice) {
    lines.push("- Match device refs exactly for hardware shape; do not substitute older models.");
  }
  return lines.join("\n");
}

export function buildMetaImagePromptDescription(options: {
  creativeBrief: MetaAdCreativeBrief;
  focusKeyword?: string;
  placement: MetaAdPlacement;
  allowPeopleInImage?: boolean;
  imagePromptModifier?: string;
  visualReferenceElements?: MetaAdVisualReferenceElement[];
  localityCity?: string;
  typographyStyle?: MetaAdTypographyStyle;
  colorPalette?: MetaAdColorPalette;
}): string {
  const brief = options.creativeBrief;
  const elements = options.visualReferenceElements ?? [];
  const allowPeople = options.allowPeopleInImage === true;
  const modifier = options.imagePromptModifier?.trim();
  const keyword = options.focusKeyword?.trim();
  const typographyLine =
    visualToolIsActive(brief.visualToolPalette.typography)
      ? formatTypographyStyleForPrompt(options.typographyStyle)
      : null;

  const lines = [
    "PROMPT DESCRIPTION (visual only):",
    `- Placement: ${metaAdPlacementLabel(options.placement)}`,
    `- Visual concept: ${brief.visualConcept}`,
    `- Vibe: ${brief.visualVibe}`,
    `- Background: ${brief.backgroundTreatment}`,
    `- Style: ${brief.creativeStyle === "photo_hero" ? "Photo hero" : "Designed Instagram feed graphic"}`,
    `- Mood: modern, engaging, real sponsored post creative`,
    `- ${formatVisualToolPaletteBlock(brief.visualToolPalette)}`,
    typographyLine ? `- ${typographyLine}` : "",
    formatMetaColorPaletteBlock(options.colorPalette)
      ? `- ${formatMetaColorPaletteBlock(options.colorPalette)}`
      : "",
    `- On-image headline (render exactly once): "${brief.onImageHeadline}"`,
    brief.onImageSubline
      ? `- On-image subline (render exactly once): "${brief.onImageSubline}"`
      : "- On-image subline: none",
    keyword ? `- DO NOT render focus keyword on image: "${keyword}"` : "",
    "- DO NOT duplicate the headline",
    "- DO NOT render caption, primaryText, description, CTA, URLs, or checklist text",
    brief.useMapOverlay
      ? "- Map overlay allowed per brief (subtle, designed graphic treatment)"
      : "- No map overlay",
    `- ${META_IMAGE_ANTI_PATTERNS.replace(/\n/g, " ")}`,
  ].filter(Boolean);

  if (!allowPeople) {
    lines.push("- People: none (no faces, hands, or silhouettes)");
  }
  if (modifier) {
    lines.push(`- Modifier: ${modifier}`);
  }
  if (elements.length) {
    lines.push("- Visual reference elements:");
    lines.push(formatMetaVisualReferenceElementsForPrompt(elements));
  }
  const localityCity = options.localityCity?.trim();
  if (localityCity) {
    lines.push(`- Locality context: ${localityCity} (city_skyline degree in palette drives skyline use)`);
  }
  lines.push(
    buildMetaImageRealismSceneSpec({
      creativeBrief: brief,
      placement: options.placement,
      localityCity,
      visualReferenceElements: elements,
    }),
  );
  return lines.join("\n");
}

export function buildMetaImagePromptPreview(options: {
  focusKeyword?: string;
  placement: MetaAdPlacement;
  imagePromptModifier?: string;
  allowPeopleInImage?: boolean;
}): string {
  const keyword = options.focusKeyword?.trim() || "your topic";
  const peopleClause = options.allowPeopleInImage === true ? "" : ", no people";
  const formatLabel = options.placement === "story_9x16" ? "Story" : "Square Instagram";
  let line = `${formatLabel} ad: designed Instagram creative, modern vibe${peopleClause}.`;
  const note = options.imagePromptModifier?.trim();
  if (note) line += ` ${note}`;
  return line;
}

export function buildMetaImagePrompt(options: {
  creativeBrief: MetaAdCreativeBrief;
  focusKeyword?: string;
  checklist: { label: string; detail?: string }[];
  placement: MetaAdPlacement;
  referencePromptSuffix?: string;
  allowPeopleInImage?: boolean;
  imagePromptModifier?: string;
  visualReferenceElements?: MetaAdVisualReferenceElement[];
  goal?: MetaAdInstagramGoal;
  localityCity?: string;
  siteName?: string | null;
  typographyStyle?: MetaAdTypographyStyle;
  colorPalette?: MetaAdColorPalette;
}): string {
  const checklistText = formatMetaChecklistForPrompt(options.checklist);
  const promptDescription = buildMetaImagePromptDescription({
    creativeBrief: options.creativeBrief,
    focusKeyword: options.focusKeyword,
    placement: options.placement,
    allowPeopleInImage: options.allowPeopleInImage,
    imagePromptModifier: options.imagePromptModifier,
    visualReferenceElements: options.visualReferenceElements,
    localityCity: options.localityCity,
    typographyStyle: options.typographyStyle,
    colorPalette: options.colorPalette,
  });
  const noPeopleBlock =
    options.allowPeopleInImage === true ? "" : `\n\n${META_IMAGE_NO_PEOPLE_RULES}`;
  const modifierBlock = options.imagePromptModifier?.trim()
    ? `\n\nPrompt Modifier:\n${options.imagePromptModifier.trim()}`
    : "";
  return [
    `Meta ad image for ${metaAdPlacementLabel(options.placement)} placement.`,
    promptDescription,
    META_IMAGE_TEXT_RULES,
    META_IMAGE_LAYOUT_RULES,
    META_IMAGE_ANTI_PATTERNS,
    META_IMAGE_REALISM_RULE,
    noPeopleBlock,
    buildMetaBrandRules(options.siteName, options.colorPalette),
    "Checklist:",
    checklistText,
    "Caption and Meta ad fields are for setup only. Do not paint them into the image.",
    options.referencePromptSuffix?.trim(),
    modifierBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeMetaChecklistEntry(
  item: unknown,
  index: number,
): { id: string; label: string; detail?: string } | null {
  if (!item || typeof item !== "object") return null;
  const row = item as { id?: string; label?: string; detail?: string; text?: string; title?: string };
  const label = row.label?.trim() || row.text?.trim() || row.title?.trim();
  if (!label) return null;
  return {
    id: row.id?.trim() || `item-${index + 1}`,
    label,
    detail: row.detail?.trim() || undefined,
  };
}

function normalizeMetaChecklistArray(list: unknown): { id: string; label: string; detail?: string }[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item, index) => normalizeMetaChecklistEntry(item, index))
    .filter((item): item is { id: string; label: string; detail?: string } => Boolean(item));
}

export function parseMetaChecklistItems(raw: unknown): { id: string; label: string; detail?: string }[] {
  if (Array.isArray(raw)) {
    const direct = normalizeMetaChecklistArray(raw);
    if (direct.length) return direct;
  }
  if (!raw || typeof raw !== "object") return [];

  const root = raw as Record<string, unknown>;
  const listKeys = ["items", "checklist", "checklistItems", "copyChecklist", "imageChecklist"];
  for (const key of listKeys) {
    const items = normalizeMetaChecklistArray(root[key]);
    if (items.length) return items;
  }
  return [];
}

export function parseMetaInstagramGoal(raw: unknown): MetaAdInstagramGoal {
  const root = raw as Partial<MetaAdInstagramGoal>;
  const goalStatement = root.goalStatement?.trim();
  const primaryTopic = root.primaryTopic?.trim();
  const audience = root.audience?.trim();
  const adAngle = root.adAngle?.trim();
  const hook = root.hook?.trim();
  const visualDirection = root.visualDirection?.trim();
  const creativeMode = root.creativeMode?.trim() as MetaAdCreativeMode | undefined;
  const referenceQueries = Array.isArray(root.referenceQueries)
    ? root.referenceQueries.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (
    !goalStatement ||
    !primaryTopic ||
    !audience ||
    !adAngle ||
    !hook ||
    !visualDirection ||
    !creativeMode ||
    !["agency_service", "product_saas", "local_lead"].includes(creativeMode)
  ) {
    throw new Error("Instagram ad goal returned incomplete JSON.");
  }

  return {
    goalStatement,
    primaryTopic,
    audience,
    adAngle,
    hook,
    visualDirection,
    creativeMode,
    onImageTextHint: root.onImageTextHint?.trim() || undefined,
    referenceQueries,
  };
}

export function parseMetaBlueprint(raw: unknown): MetaAdBlueprint {
  const root = raw as Partial<MetaAdBlueprint>;
  const angle = root.angle?.trim();
  const audience = root.audience?.trim();
  const hook = root.hook?.trim();
  const visualDirection = root.visualDirection?.trim();
  if (!angle || !audience || !hook || !visualDirection) {
    throw new Error("Ad blueprint returned incomplete JSON.");
  }
  return { angle, audience, hook, visualDirection };
}
