import { formatPpcGoogleCampaignName } from "@/lib/ppc/google-ads-field-limits";

export type PpcCampaignRowStatus = "idle" | "generating" | "ready" | "error";

export type PpcResponsiveSearchAd = {
  id: string;
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  path1?: string;
  path2?: string;
};

export type PpcAdGroup = {
  id: string;
  name: string;
  landingPageUrl: string;
  keywords: string[];
  ads: PpcResponsiveSearchAd[];
};

export type PpcCampaign = {
  name: string;
  network: "SEARCH";
  adGroups: PpcAdGroup[];
};

export type PpcGenerateConfig = {
  campaignCount: number;
  adGroupCount: number;
  landingPageUrls: string[];
  adsPerAdGroup: number;
};

export type PpcCampaignRow = {
  id: string;
  campaignName: string;
  /** @deprecated use adGroupKeywords */
  focusKeyword?: string;
  adGroupKeywords?: string[];
  landingPageUrl?: string;
  status: PpcCampaignRowStatus;
  createdAt: string;
  config?: PpcGenerateConfig;
  campaign?: PpcCampaign;
  errorMessage?: string;
};

export type PpcWpPageContext = {
  url: string;
  title: string;
  excerpt: string;
  metaDescription: string;
  keyword: string;
};

export type PpcGscQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type PpcGscPageContext = {
  url: string;
  queries: PpcGscQueryRow[];
};

export const PPC_CAMPAIGN_COUNT_MIN = 1;
export const PPC_CAMPAIGN_COUNT_MAX = 20;
export const PPC_DEFAULT_CAMPAIGN_COUNT = 1;
export const PPC_AD_GROUP_COUNT_MIN = 1;
export const PPC_AD_GROUP_COUNT_MAX = 20;
export const PPC_DEFAULT_AD_GROUP_COUNT = 3;
export const PPC_ADS_PER_GROUP_MIN = 1;
export const PPC_ADS_PER_GROUP_MAX = 20;

export function clampPpcCampaignCount(n: number): number {
  return Math.min(PPC_CAMPAIGN_COUNT_MAX, Math.max(PPC_CAMPAIGN_COUNT_MIN, Math.round(n)));
}

export function clampPpcAdGroupCount(n: number): number {
  return Math.min(PPC_AD_GROUP_COUNT_MAX, Math.max(PPC_AD_GROUP_COUNT_MIN, Math.round(n)));
}

export function clampPpcAdsPerAdGroup(n: number): number {
  return Math.min(PPC_ADS_PER_GROUP_MAX, Math.max(PPC_ADS_PER_GROUP_MIN, Math.round(n)));
}

export function syncPpcAdGroupKeywordsToCount(
  keywords: string[] | undefined,
  count: number,
): string[] {
  const target = clampPpcAdGroupCount(count);
  const next = [...(keywords ?? [])];
  while (next.length < target) next.push("");
  return next.slice(0, target);
}

export function resolvePpcRowAdGroupCount(row: PpcCampaignRow, configAdGroupCount: number): number {
  if (row.campaign?.adGroups.length) return row.campaign.adGroups.length;
  return clampPpcAdGroupCount(configAdGroupCount);
}

export function resolvePpcRowAdGroupKeywords(
  row: PpcCampaignRow,
  configAdGroupCount: number,
): string[] {
  const count = resolvePpcRowAdGroupCount(row, configAdGroupCount);
  let seeds: string[] | undefined;

  if (row.campaign?.adGroups.length) {
    seeds = row.campaign.adGroups.map((adGroup) => adGroup.name);
  } else if (row.adGroupKeywords?.some((keyword) => keyword.trim())) {
    seeds = [...row.adGroupKeywords];
  } else if (row.focusKeyword?.trim()) {
    seeds = [row.focusKeyword];
  }

  const synced = syncPpcAdGroupKeywordsToCount(seeds, count);

  if (row.focusKeyword !== undefined) {
    const next = [...synced];
    next[0] = row.focusKeyword;
    return next;
  }

  return synced;
}

export function resolvePpcRowFocusKeyword(row: PpcCampaignRow): string {
  if (row.focusKeyword !== undefined) return row.focusKeyword;
  const fromAdGroupKeywords = row.adGroupKeywords?.find((keyword) => keyword.trim())?.trim();
  if (fromAdGroupKeywords) return fromAdGroupKeywords;
  const firstAdGroup = row.campaign?.adGroups[0];
  const fromGeneratedKeyword = firstAdGroup?.keywords.find((keyword) => keyword.trim())?.trim();
  if (fromGeneratedKeyword) return fromGeneratedKeyword;
  return firstAdGroup?.name?.trim() ?? "";
}

export function resolvePpcRowLandingPageUrl(row: PpcCampaignRow): string {
  if (row.landingPageUrl !== undefined) return row.landingPageUrl;
  return row.campaign?.adGroups[0]?.landingPageUrl?.trim() ?? "";
}

export function resolvePpcRowCampaignName(row: PpcCampaignRow): string {
  if (row.campaignName !== undefined) return row.campaignName;
  if (row.campaign?.name !== undefined) return row.campaign.name;
  const keyword = resolvePpcRowFocusKeyword(row);
  return keyword.trim() ? formatPpcGoogleCampaignName(keyword) : "";
}

export function ppcRowPatchFromGeneratedCampaign(
  campaign: PpcCampaign,
  preserve?: Partial<Pick<PpcCampaignRow, "focusKeyword" | "adGroupKeywords" | "landingPageUrl" | "campaignName">>,
): Pick<PpcCampaignRow, "focusKeyword" | "adGroupKeywords" | "landingPageUrl" | "campaignName"> {
  const generatedFocusKeyword = resolvePpcRowFocusKeyword({
    id: "",
    campaignName: "",
    status: "ready",
    createdAt: "",
    campaign,
    adGroupKeywords: campaign.adGroups.map((adGroup) => adGroup.name),
  });
  const generatedLandingPageUrl = campaign.adGroups[0]?.landingPageUrl?.trim() ?? "";

  const focusKeyword =
    preserve?.focusKeyword !== undefined ? preserve.focusKeyword : generatedFocusKeyword;
  const landingPageUrl =
    preserve?.landingPageUrl !== undefined ? preserve.landingPageUrl : generatedLandingPageUrl;
  const campaignName =
    preserve?.campaignName !== undefined
      ? preserve.campaignName
      : focusKeyword.trim()
        ? formatPpcGoogleCampaignName(focusKeyword)
        : formatPpcGoogleCampaignName(generatedFocusKeyword);

  const fromCampaignAdGroupKeywords = campaign.adGroups.map((adGroup) => adGroup.name);
  let resolvedAdGroupKeywords = preserve?.adGroupKeywords ?? fromCampaignAdGroupKeywords;
  if (preserve?.focusKeyword !== undefined && resolvedAdGroupKeywords.length) {
    resolvedAdGroupKeywords = [...resolvedAdGroupKeywords];
    resolvedAdGroupKeywords[0] = preserve.focusKeyword;
  }

  return {
    focusKeyword,
    adGroupKeywords: resolvedAdGroupKeywords,
    landingPageUrl,
    campaignName,
  };
}

export function ppcRowUserInputPreserve(
  row: PpcCampaignRow,
): Partial<Pick<PpcCampaignRow, "focusKeyword" | "campaignName" | "landingPageUrl">> {
  return {
    focusKeyword: row.focusKeyword,
    campaignName: row.campaignName,
    landingPageUrl: row.landingPageUrl,
  };
}

export function createEmptyPpcCampaignRow(): PpcCampaignRow {
  return {
    id: "",
    campaignName: "",
    status: "idle",
    createdAt: "",
  };
}

export function createPpcCampaignRowId(): string {
  return `ppc-campaign-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createIdlePpcCampaignRow(adGroupCount = PPC_DEFAULT_AD_GROUP_COUNT): PpcCampaignRow {
  return {
    id: createPpcCampaignRowId(),
    campaignName: "",
    focusKeyword: "",
    landingPageUrl: "",
    adGroupKeywords: syncPpcAdGroupKeywordsToCount(undefined, adGroupCount),
    status: "idle",
    createdAt: "",
  };
}

export function ppcCampaignStatusLabel(status: PpcCampaignRowStatus): string {
  switch (status) {
    case "idle":
      return "Not generated";
    case "generating":
      return "Generating";
    case "ready":
      return "";
    case "error":
      return "Error";
    default:
      return "Not generated";
  }
}
