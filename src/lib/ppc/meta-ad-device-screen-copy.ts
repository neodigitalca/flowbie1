import { resolveMetaAdvertiserLabel } from "@/lib/ppc/meta-ad-prompt-builder";
import type { MetaAdCreativeBrief } from "@/lib/ppc/meta-ads-types";

export type MetaAdDeviceScreenUiStyle = "elementor" | "wordpress" | "flowbie";

export type MetaAdDeviceScreenCopy = {
  uiStyle: MetaAdDeviceScreenUiStyle;
  heroTitle: string;
  heroSubline: string;
  primaryButton: string;
  secondaryButton?: string;
};

const VALID_UI_STYLES = new Set<MetaAdDeviceScreenUiStyle>(["elementor", "wordpress", "flowbie"]);

function trimWords(value: string, max: number): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .join(" ");
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function normalizeMetaDeviceScreenUiStyle(raw: unknown): MetaAdDeviceScreenUiStyle | undefined {
  const value = readString(raw)?.toLowerCase();
  if (!value) return undefined;
  if (VALID_UI_STYLES.has(value as MetaAdDeviceScreenUiStyle)) {
    return value as MetaAdDeviceScreenUiStyle;
  }
  if (value.includes("flowbie")) return "flowbie";
  if (value.includes("elementor")) return "elementor";
  if (value.includes("wordpress") || value.includes("wp admin")) return "wordpress";
  return undefined;
}

export function extractMetaDeviceScreenCopyRoot(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const root = raw as Record<string, unknown>;
  for (const key of [
    "deviceScreenCopy",
    "screenCopy",
    "device_screen_copy",
    "screen_copy",
    "copy",
    "result",
    "output",
  ]) {
    const nested = root[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }
  return root;
}

function readCopyField(root: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readString(root[key]);
    if (value) return value;
  }
  return undefined;
}

export function buildMetaDeviceScreenCopySystemPrompt(siteName?: string | null): string {
  const advertiser = resolveMetaAdvertiserLabel(siteName);
  return `You write exact on-screen UI copy for a device screen shown in a ${advertiser} Instagram ad creative.

Only run when the creative brief visualConcept includes a laptop, monitor, phone, tablet, or similar screen UI.
Output minimal page-builder hero UI copy only: hero title, hero subline, and one or two short button labels.
Sidebars and panels will be icon-only in the image. Do not output sidebar labels, paragraphs, or URLs.
Align copy to the creative brief, landing topic, and city when provided.
Do not use brand logos or the word Elementor on screen.
heroTitle max 4 words. heroSubline max 6 words. Each button max 2 words.
uiStyle must be exactly one of: elementor, wordpress, flowbie.

Return ONLY valid JSON with these exact keys:
{"uiStyle":"elementor","heroTitle":"string","heroSubline":"string","primaryButton":"string","secondaryButton":"string or empty"}`;
}

export function buildMetaDeviceScreenCopyUserPayload(options: {
  creativeBrief: MetaAdCreativeBrief;
  siteName?: string | null;
  localityCity?: string;
  focusKeyword?: string;
}): string {
  return JSON.stringify({
    task: "meta_ad_device_screen_copy",
    siteName: options.siteName?.trim() || "",
    localityCity: options.localityCity?.trim() || "",
    focusKeyword: options.focusKeyword?.trim() || "",
    creativeBrief: {
      visualConcept: options.creativeBrief.visualConcept,
      visualVibe: options.creativeBrief.visualVibe,
      onImageHeadline: options.creativeBrief.onImageHeadline,
      onImageSubline: options.creativeBrief.onImageSubline,
      captionHook: options.creativeBrief.captionHook,
    },
    outputSchema: {
      uiStyle: "elementor | wordpress | flowbie",
      heroTitle: "string, max 4 words",
      heroSubline: "string, max 6 words",
      primaryButton: "string, max 2 words",
      secondaryButton: "string, max 2 words or empty string",
    },
  });
}

export function parseMetaDeviceScreenCopy(raw: unknown): MetaAdDeviceScreenCopy {
  const root = extractMetaDeviceScreenCopyRoot(raw);
  const uiStyle = normalizeMetaDeviceScreenUiStyle(root.uiStyle ?? root.style ?? root.ui_style);
  const heroTitle = readCopyField(root, ["heroTitle", "hero_title", "title", "headline"]);
  const heroSubline = readCopyField(root, ["heroSubline", "hero_subline", "subline", "subtitle"]);
  const primaryButton = readCopyField(root, [
    "primaryButton",
    "primary_button",
    "primaryCta",
    "primary_cta",
    "button",
    "cta",
  ]);
  const secondaryButton =
    readCopyField(root, ["secondaryButton", "secondary_button", "secondaryCta", "secondary_cta"]) ||
    undefined;

  const missing: string[] = [];
  if (!uiStyle) missing.push("uiStyle");
  if (!heroTitle) missing.push("heroTitle");
  if (!heroSubline) missing.push("heroSubline");
  if (!primaryButton) missing.push("primaryButton");
  if (missing.length) {
    throw new Error(`Device screen copy returned incomplete JSON (missing: ${missing.join(", ")}).`);
  }

  const normalizedTitle = trimWords(heroTitle!, 4);
  const normalizedSubline = trimWords(heroSubline!, 6);
  const normalizedPrimary = trimWords(primaryButton!, 2);
  const normalizedSecondary = secondaryButton ? trimWords(secondaryButton, 2) : undefined;

  if (!normalizedTitle || !normalizedSubline || !normalizedPrimary) {
    throw new Error("Device screen copy returned empty required fields.");
  }

  return {
    uiStyle: uiStyle!,
    heroTitle: normalizedTitle,
    heroSubline: normalizedSubline,
    primaryButton: normalizedPrimary,
    secondaryButton: normalizedSecondary,
  };
}

export function formatMetaDeviceScreenCopyForPrompt(copy: MetaAdDeviceScreenCopy): string {
  const lines = [
    "DEVICE SCREEN (only readable text on the device; perfect spelling):",
    `- Hero title: "${copy.heroTitle}"`,
    `- Hero subline: "${copy.heroSubline}"`,
    `- Primary button: "${copy.primaryButton}"`,
  ];
  if (copy.secondaryButton) {
    lines.push(`- Secondary button: "${copy.secondaryButton}"`);
  }
  lines.push(
    "Layout: minimal page-builder hero block on the device screen from the creative brief scene.",
    "Sidebars and panels are icons and color blocks only with no text labels.",
  );
  return lines.join("\n");
}
