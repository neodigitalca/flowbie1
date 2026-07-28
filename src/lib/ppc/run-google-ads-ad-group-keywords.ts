import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { appendMasterInstructionsToSystemPrompt, ensureMasterInstructionsInMemory } from "@/lib/master-instructions-storage";
import { GOOGLE_ADS_KEYWORD_LIMITS_PROMPT, GOOGLE_ADS_KEYWORD_MAX } from "@/lib/ppc/google-ads-field-limits";
import type { PpcGscPageContext, PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import type { PpcCampaignPlanAdGroup } from "@/lib/ppc/run-google-ads-campaign-plan";

export type PpcAdGroupKeywordsResult = {
  keywords: string[];
};

const SYSTEM = `You are a Google Ads keyword strategist.

Pick exact-match and phrase-match style keywords for one Search ad group.
Prefer real GSC queries when provided. Do not invent branded queries unrelated to the page.
${GOOGLE_ADS_KEYWORD_LIMITS_PROMPT}
Return ONLY valid JSON matching outputSchema.
keywords.length MUST be between 5 and 15.`;

export async function runGoogleAdsAdGroupKeywords(options: {
  apiKey: string;
  model: string;
  siteId?: string;
  campaignName: string;
  adGroup: PpcCampaignPlanAdGroup;
  landingPage: PpcWpPageContext | undefined;
  gscPage: PpcGscPageContext | undefined;
  focusKeyword?: string;
  signal?: AbortSignal;
}): Promise<PpcAdGroupKeywordsResult> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  await ensureMasterInstructionsInMemory(options.siteId ?? null);

  const user = JSON.stringify({
    task: "ppc_google_ad_group_keywords",
    campaignName: options.campaignName,
    adGroupName: options.adGroup.name,
    adGroupTheme: options.adGroup.theme,
    landingPageUrl: options.adGroup.landingPageUrl,
    focusKeyword: options.focusKeyword?.trim() || undefined,
    landingPage: options.landingPage,
    gscQueries: options.gscPage?.queries?.slice(0, 20) ?? [],
    outputSchema: {
      keywords: [`string, maxLength ${GOOGLE_ADS_KEYWORD_MAX}`],
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
    temperature: 0.2,
    responseFormat: { type: "json_object" },
    signal: options.signal,
  });

  if (finishReason === "length" || nativeFinishReason === "MAX_TOKENS") {
    throw new Error(`Ad group keywords hit max_tokens (${maxTokens}).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Ad group keywords returned invalid JSON.");
  }

  const root = parsed as PpcAdGroupKeywordsResult;
  const keywords = (root.keywords ?? []).map((k) => k.trim()).filter(Boolean);
  if (keywords.length < 3) {
    throw new Error("Ad group keywords returned too few keywords.");
  }

  return { keywords: keywords.slice(0, 15) };
}
