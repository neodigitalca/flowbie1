import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { appendMasterInstructionsToSystemPrompt, ensureMasterInstructionsInMemory } from "@/lib/master-instructions-storage";
import {
  GOOGLE_ADS_RSA_COPY_LIMITS_PROMPT,
  GOOGLE_ADS_RSA_DESCRIPTION_COUNT,
  GOOGLE_ADS_RSA_DESCRIPTION_MAX,
  GOOGLE_ADS_RSA_HEADLINE_MAX,
  GOOGLE_ADS_RSA_PATH_MAX,
} from "@/lib/ppc/google-ads-field-limits";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import type { PpcCampaignPlanAdGroup } from "@/lib/ppc/run-google-ads-campaign-plan";

export type PpcRsaCopyResult = {
  headlines: string[];
  descriptions: string[];
  path1?: string;
  path2?: string;
};

const SYSTEM = `You are a senior Google Ads PPC copywriter.

Write responsive search ad copy grounded in the landing page and keywords.
${GOOGLE_ADS_RSA_COPY_LIMITS_PROMPT}
finalUrl is provided separately; do not change it.
Return ONLY valid JSON matching outputSchema.`;

export async function runGoogleAdsRsaCopy(options: {
  apiKey: string;
  model: string;
  siteId?: string;
  campaignName: string;
  adGroup: PpcCampaignPlanAdGroup;
  landingPage: PpcWpPageContext | undefined;
  keywords: string[];
  adIndex: number;
  adsPerAdGroup: number;
  signal?: AbortSignal;
}): Promise<PpcRsaCopyResult> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  await ensureMasterInstructionsInMemory(options.siteId ?? null);

  const user = JSON.stringify({
    task: "ppc_google_rsa_copy",
    campaignName: options.campaignName,
    adGroupName: options.adGroup.name,
    landingPageUrl: options.adGroup.landingPageUrl,
    landingPage: options.landingPage,
    keywords: options.keywords.slice(0, 12),
    adIndex: options.adIndex,
    adsPerAdGroup: options.adsPerAdGroup,
    fieldLimits: {
      headlineMax: GOOGLE_ADS_RSA_HEADLINE_MAX,
      descriptionMax: GOOGLE_ADS_RSA_DESCRIPTION_MAX,
      descriptionCount: GOOGLE_ADS_RSA_DESCRIPTION_COUNT,
      pathMax: GOOGLE_ADS_RSA_PATH_MAX,
    },
    outputSchema: {
      headlines: [`string, maxLength ${GOOGLE_ADS_RSA_HEADLINE_MAX}, count 3 to 5`],
      descriptions: [
        `string, maxLength ${GOOGLE_ADS_RSA_DESCRIPTION_MAX}, count exactly ${GOOGLE_ADS_RSA_DESCRIPTION_COUNT}`,
      ],
      path1: `optional string, maxLength ${GOOGLE_ADS_RSA_PATH_MAX}, lowercase hyphenated slug`,
      path2: `optional string, maxLength ${GOOGLE_ADS_RSA_PATH_MAX}, lowercase hyphenated slug`,
    },
  });

  const system = appendMasterInstructionsToSystemPrompt(SYSTEM, options.siteId ?? null);
  const maxTokens = getCompetitorReportMaxOutputTokens(options.model);

  const { content, finishReason, nativeFinishReason } = await callOpenRouterChatCompletion({
    apiKey: options.apiKey,
    model: options.model,
    system,
    user,
    maxTokens,
    temperature: 0.25,
    responseFormat: { type: "json_object" },
    signal: options.signal,
  });

  if (finishReason === "length" || nativeFinishReason === "MAX_TOKENS") {
    throw new Error(`RSA copy hit max_tokens (${maxTokens}).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("RSA copy returned invalid JSON.");
  }

  const root = parsed as PpcRsaCopyResult;
  const headlines = (root.headlines ?? []).map((h) => h.trim()).filter(Boolean);
  const descriptions = (root.descriptions ?? []).map((d) => d.trim()).filter(Boolean);

  if (headlines.length < 3 || descriptions.length < GOOGLE_ADS_RSA_DESCRIPTION_COUNT) {
    throw new Error(
      `RSA copy returned insufficient headlines or descriptions (need 3+ headlines and ${GOOGLE_ADS_RSA_DESCRIPTION_COUNT} descriptions).`,
    );
  }

  return {
    headlines: headlines.slice(0, 5),
    descriptions: descriptions.slice(0, GOOGLE_ADS_RSA_DESCRIPTION_COUNT),
    path1: root.path1?.trim() || undefined,
    path2: root.path2?.trim() || undefined,
  };
}
