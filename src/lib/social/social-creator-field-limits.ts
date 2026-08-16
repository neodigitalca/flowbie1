import {
  clampSocialPostCount,
  META_DEFAULT_AD_COUNT,
  type SocialGenerateConfig,
  type MetaAdPlacement,
} from "@/lib/social/social-creator-types";
import {
  DEFAULT_SOCIAL_LANDING_PAGE_SOURCE,
  normalizeSocialLandingPageSource,
} from "@/lib/social/content-creator-types";
import { resolveMetaTypographyStyle } from "@/lib/ppc/meta-ad-typography-styles";
import {
  createDefaultMetaColorPalette,
  createDefaultMetaVisualToolPalette,
  mergeLegacySocialGenerateConfig,
  resolveSocialVisualToolMode,
} from "@/lib/social/social-creator-generate-config-defaults";

export const META_ADS_COPY_LIMITS_PROMPT = `Field limits (strict):
- primaryText: max 125 characters (display-safe)
- headline: max 40 characters
- description: max 30 characters
- cta: one of Learn More, Sign Up, Contact Us, Get Quote, Book Now`;

export const META_AD_PRIMARY_TEXT_MAX = 125;
export const META_AD_HEADLINE_MAX = 40;
export const META_AD_DESCRIPTION_MAX = 30;

export const META_AD_CTA_OPTIONS = [
  "Learn More",
  "Sign Up",
  "Contact Us",
  "Get Quote",
  "Book Now",
] as const;

export type MetaAdCta = (typeof META_AD_CTA_OPTIONS)[number];

export function clampMetaAdPrimaryText(value: string): string {
  return value.trim().slice(0, META_AD_PRIMARY_TEXT_MAX);
}

export function clampMetaAdHeadline(value: string): string {
  return value.trim().slice(0, META_AD_HEADLINE_MAX);
}

export function clampMetaAdDescription(value: string): string {
  return value.trim().slice(0, META_AD_DESCRIPTION_MAX);
}

export function normalizeMetaAdCta(value: unknown): MetaAdCta {
  const raw = typeof value === "string" ? value.trim() : "";
  const match = META_AD_CTA_OPTIONS.find((option) => option.toLowerCase() === raw.toLowerCase());
  return match ?? "Learn More";
}

export function metaAdPlacementLabel(placement: "feed_1x1" | "feed_4x5" | "story_9x16"): string {
  switch (placement) {
    case "feed_1x1":
      return "Feed 1:1";
    case "feed_4x5":
      return "Feed 4:5";
    case "story_9x16":
      return "Story 9:16";
    default:
      return placement;
  }
}

function storageKey(siteId: string): string {
  return `neo-pulse-social-creator-generate-config:${siteId}`;
}

export function createDefaultSocialGenerateConfig(): SocialGenerateConfig {
  return {
    postCount: META_DEFAULT_AD_COUNT,
    placement: "feed_1x1",
    includeImage: true,
    landingPageSource: DEFAULT_SOCIAL_LANDING_PAGE_SOURCE,
    defaultColorPalette: createDefaultMetaColorPalette(),
    defaultVisualToolPalette: createDefaultMetaVisualToolPalette(),
    defaultVisualToolMode: "fixed",
  };
}

export function readSocialGenerateConfig(siteId: string): SocialGenerateConfig {
  const defaults = createDefaultSocialGenerateConfig();
  try {
    const raw = sessionStorage.getItem(storageKey(siteId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<SocialGenerateConfig> & {
      colorThemeId?: unknown;
      visualToolThemeId?: unknown;
    };
    const placement = parsed.placement;
    const palettes = mergeLegacySocialGenerateConfig(parsed);
    return {
      postCount: clampSocialPostCount(parsed.postCount ?? META_DEFAULT_AD_COUNT),
      placement:
        placement === "feed_4x5" || placement === "story_9x16" || placement === "feed_1x1"
          ? placement
          : defaults.placement,
      includeImage: parsed.includeImage !== false,
      landingPageSource: normalizeSocialLandingPageSource(parsed.landingPageSource),
      defaultColorPalette: palettes.defaultColorPalette,
      defaultVisualToolPalette: palettes.defaultVisualToolPalette,
      defaultVisualToolMode: resolveSocialVisualToolMode(parsed.defaultVisualToolMode),
      defaultTypographyStyle: resolveMetaTypographyStyle(parsed.defaultTypographyStyle),
    };
  } catch {
    return defaults;
  }
}

export function writeSocialGenerateConfig(siteId: string, config: SocialGenerateConfig): void {
  try {
    sessionStorage.setItem(storageKey(siteId), JSON.stringify(config));
  } catch {
    /* ignore */
  }
}
