import {
  clampContentPostCount,
  CONTENT_DEFAULT_POST_COUNT,
  DEFAULT_SOCIAL_LANDING_PAGE_SOURCE,
  normalizeSocialLandingPageSource,
  type ContentCreatorGenerateConfig,
} from "@/lib/social/content-creator-types";

const CONFIG_KEY_PREFIX = "neo-pulse-content-creator-config:";

export function defaultContentCreatorGenerateConfig(): ContentCreatorGenerateConfig {
  return {
    postCount: CONTENT_DEFAULT_POST_COUNT,
    landingPageSource: DEFAULT_SOCIAL_LANDING_PAGE_SOURCE,
  };
}

export function readContentCreatorGenerateConfig(siteId: string): ContentCreatorGenerateConfig {
  try {
    const raw = localStorage.getItem(`${CONFIG_KEY_PREFIX}${siteId}`);
    if (!raw) return defaultContentCreatorGenerateConfig();
    const parsed = JSON.parse(raw) as Partial<ContentCreatorGenerateConfig>;
    return {
      postCount: clampContentPostCount(parsed.postCount ?? CONTENT_DEFAULT_POST_COUNT),
      landingPageSource: normalizeSocialLandingPageSource(parsed.landingPageSource),
    };
  } catch {
    return defaultContentCreatorGenerateConfig();
  }
}

export function writeContentCreatorGenerateConfig(
  siteId: string,
  config: ContentCreatorGenerateConfig,
): void {
  try {
    localStorage.setItem(
      `${CONFIG_KEY_PREFIX}${siteId}`,
      JSON.stringify({
        postCount: clampContentPostCount(config.postCount),
        landingPageSource: normalizeSocialLandingPageSource(config.landingPageSource),
      }),
    );
  } catch {
    // ignore
  }
}
