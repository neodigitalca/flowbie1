import type { PpcAdGroup, PpcCampaign } from "@/lib/ppc/google-ads-types";

export function mergePpcGeneratedAdGroupIntoCampaign(params: {
  campaign: PpcCampaign | undefined;
  adGroupCount: number;
  adGroupIndex: number;
  generated: PpcAdGroup;
  keywordSeeds: string[];
  defaultLandingPageUrl: string;
  campaignName: string;
}): PpcCampaign {
  const { campaign, adGroupCount, adGroupIndex, generated, keywordSeeds, defaultLandingPageUrl, campaignName } =
    params;
  const existing = campaign?.adGroups ?? [];

  const adGroups: PpcAdGroup[] = Array.from({ length: adGroupCount }, (_, index) => {
    if (index === adGroupIndex) {
      return { ...generated, id: existing[index]?.id ?? generated.id };
    }
    const current = existing[index];
    if (current && (current.keywords.length > 0 || current.ads.length > 0)) {
      return current;
    }
    return {
      id: current?.id ?? `ppc-ag-shell-${index}`,
      name: keywordSeeds[index]?.trim() || current?.name?.trim() || `Ad group ${index + 1}`,
      landingPageUrl: current?.landingPageUrl?.trim() || defaultLandingPageUrl,
      keywords: current?.keywords ?? [],
      ads: current?.ads ?? [],
    };
  });

  return {
    name: campaignName,
    network: "SEARCH",
    adGroups,
  };
}
