import type { PpcAdGroup, PpcCampaign, PpcGenerateConfig } from "@/lib/ppc/google-ads-types";
import type { PpcCampaignPlanAvoidanceInput, PpcCampaignPlanResult } from "@/lib/ppc/run-google-ads-campaign-plan";

export type PpcCampaignGenerateJobInput = {
  config: PpcGenerateConfig;
  adGroupKeywords?: string[];
  focusKeyword?: string;
};

export type PpcCampaignPlanAvoidance = {
  focusTheme: string;
  primaryLandingPageUrl: string;
  landingPageUrls: string[];
  adGroupNames: string[];
};

export function ppcCampaignJobHasUserDirection(job: PpcCampaignGenerateJobInput): boolean {
  if (job.focusKeyword?.trim()) return true;
  if (job.config.landingPageUrls.some((url) => url.trim())) return true;
  if (job.adGroupKeywords?.some((keyword) => keyword.trim())) return true;
  return false;
}

export function summarizePpcCampaignPlanForAvoidance(
  plan: PpcCampaignPlanResult,
): PpcCampaignPlanAvoidance {
  const landingPageUrls = [...new Set(plan.adGroups.map((adGroup) => adGroup.landingPageUrl.trim()).filter(Boolean))];
  const primary = plan.adGroups[0];
  return {
    focusTheme: primary?.theme?.trim() || primary?.name?.trim() || "",
    primaryLandingPageUrl: primary?.landingPageUrl?.trim() || landingPageUrls[0] || "",
    landingPageUrls,
    adGroupNames: plan.adGroups.map((adGroup) => adGroup.name.trim()).filter(Boolean),
  };
}

export function summarizePpcAdGroupForAvoidance(adGroup: PpcAdGroup): PpcCampaignPlanAvoidanceInput {
  return {
    focusTheme: adGroup.name.trim(),
    primaryLandingPageUrl: adGroup.landingPageUrl.trim(),
    landingPageUrls: [adGroup.landingPageUrl.trim()],
    adGroupNames: [adGroup.name.trim()],
  };
}

export function summarizePpcCampaignForAvoidance(campaign: PpcCampaign): PpcCampaignPlanAvoidance {
  const landingPageUrls = [...new Set(campaign.adGroups.map((adGroup) => adGroup.landingPageUrl.trim()).filter(Boolean))];
  const primary = campaign.adGroups[0];
  return {
    focusTheme: primary?.name?.trim() || "",
    primaryLandingPageUrl: primary?.landingPageUrl?.trim() || landingPageUrls[0] || "",
    landingPageUrls,
    adGroupNames: campaign.adGroups.map((adGroup) => adGroup.name.trim()).filter(Boolean),
  };
}
