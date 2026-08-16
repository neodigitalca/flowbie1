import {
  clampPpcAdGroupCount,
  clampPpcAdsPerAdGroup,
  clampPpcCampaignCount,
  PPC_DEFAULT_CAMPAIGN_COUNT,
  type PpcGenerateConfig,
} from "@/lib/ppc/google-ads-types";

function storageKey(siteId: string): string {
  return `neo-pulse-ppc-generate-config-v2:${siteId}`;
}

export function createDefaultPpcGenerateConfig(): PpcGenerateConfig {
  return {
    campaignCount: PPC_DEFAULT_CAMPAIGN_COUNT,
    adGroupCount: 3,
    landingPageUrls: [],
    adsPerAdGroup: 1,
  };
}

export function readPpcGenerateConfig(siteId: string): PpcGenerateConfig {
  const defaults = createDefaultPpcGenerateConfig();
  try {
    const raw = sessionStorage.getItem(storageKey(siteId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PpcGenerateConfig>;
    return {
      ...defaults,
      ...parsed,
      campaignCount: clampPpcCampaignCount(parsed.campaignCount ?? PPC_DEFAULT_CAMPAIGN_COUNT),
      adGroupCount: clampPpcAdGroupCount(parsed.adGroupCount ?? defaults.adGroupCount),
      adsPerAdGroup: clampPpcAdsPerAdGroup(parsed.adsPerAdGroup ?? defaults.adsPerAdGroup),
      landingPageUrls: Array.isArray(parsed.landingPageUrls)
        ? parsed.landingPageUrls.filter((url): url is string => typeof url === "string")
        : defaults.landingPageUrls,
    };
  } catch {
    return defaults;
  }
}

export function writePpcGenerateConfig(siteId: string, config: PpcGenerateConfig): void {
  try {
    sessionStorage.setItem(storageKey(siteId), JSON.stringify(config));
  } catch {
    /* ignore */
  }
}
