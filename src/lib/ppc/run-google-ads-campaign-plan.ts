import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { appendMasterInstructionsToSystemPrompt, ensureMasterInstructionsInMemory } from "@/lib/master-instructions-storage";
import {
  formatPpcGoogleCampaignName,
  GOOGLE_ADS_CAMPAIGN_PLAN_LIMITS_PROMPT,
  GOOGLE_ADS_CAMPAIGN_NAME_MAX,
} from "@/lib/ppc/google-ads-field-limits";
import type { PpcGscPageContext, PpcWpPageContext } from "@/lib/ppc/google-ads-types";

export type PpcCampaignPlanAdGroup = {
  name: string;
  landingPageUrl: string;
  theme: string;
};

export type PpcCampaignPlanAvoidanceInput = {
  focusTheme: string;
  primaryLandingPageUrl: string;
  landingPageUrls: string[];
  adGroupNames: string[];
};

export type PpcCampaignPlanResult = {
  campaignName: string;
  adGroups: PpcCampaignPlanAdGroup[];
};

const SYSTEM = `You are a senior Google Ads Search strategist.

Plan one Search campaign from the site page bucket (WordPress landing pages).
${GOOGLE_ADS_CAMPAIGN_PLAN_LIMITS_PROMPT}
Return ONLY valid JSON matching outputSchema.
Every adGroups[].landingPageUrl MUST be copied exactly from allowedLandingUrls.
Do not assign ad groups to URLs outside allowedLandingUrls.
adGroups.length MUST equal requiredAdGroupCount.

For each ad group, pick the landingPageUrl that best matches that ad group's theme and keyword seed (title, pathname, excerpt, meta, and keyword field). Prefer the most semantically relevant service or product page. Avoid utility pages (terms, privacy, cookies, careers, thank-you) when a relevant offer page exists in allowedLandingUrls.
When adGroupKeywordSeeds has a value for an ad group index, align that ad group's landingPageUrl and theme to that seed.
Different ad groups should use different URLs when allowedLandingUrls contains distinct relevant pages.
When totalCampaigns is greater than 1, each campaignIndex must plan a distinct service line, intent theme, and primary landing page from the page bucket.
When avoidCampaignPlans is non-empty, do not reuse any avoided focusTheme, primaryLandingPageUrl, or ad group name set. Pick a materially different campaign angle from allowedLandingUrls.`;

export async function runGoogleAdsCampaignPlan(options: {
  apiKey: string;
  model: string;
  siteId?: string;
  siteName: string;
  adGroupCount: number;
  focusKeyword?: string;
  adGroupKeywordSeeds?: string[];
  landingPages: PpcWpPageContext[];
  gscPages: PpcGscPageContext[];
  userSelectedLandingUrls?: string[];
  campaignIndex?: number;
  totalCampaigns?: number;
  avoidCampaignPlans?: PpcCampaignPlanAvoidanceInput[];
  signal?: AbortSignal;
}): Promise<PpcCampaignPlanResult> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  await ensureMasterInstructionsInMemory(options.siteId ?? null);

  const allowedLandingUrls = options.landingPages.map((p) => p.url);
  const userSelectedOnly = options.userSelectedLandingUrls?.length > 0;
  const user = JSON.stringify({
    task: "ppc_google_campaign_plan",
    siteName: options.siteName,
    requiredAdGroupCount: options.adGroupCount,
    focusKeyword: options.focusKeyword?.trim() || undefined,
    adGroupKeywordSeeds: (options.adGroupKeywordSeeds ?? [])
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    campaignIndex: options.campaignIndex,
    totalCampaigns: options.totalCampaigns,
    avoidCampaignPlans: (options.avoidCampaignPlans ?? []).map((plan) => ({
      focusTheme: plan.focusTheme,
      primaryLandingPageUrl: plan.primaryLandingPageUrl,
      landingPageUrls: plan.landingPageUrls,
      adGroupNames: plan.adGroupNames,
    })),
    allowedLandingUrls,
    userSelectedLandingUrls: options.userSelectedLandingUrls ?? [],
    landingPageRule: userSelectedOnly
      ? "Use ONLY allowedLandingUrls from the user's landing page selection. Pick the best semantic match per ad group within that set."
      : "Read allowedLandingUrls and pageBucket (url + title). Pick the best semantic landingPageUrl per ad group from the full page bucket.",
    pageBucket: options.landingPages.map((p) => ({
      url: p.url,
      title: p.title,
    })),
    landingPages: options.landingPages.map((p) => ({
      url: p.url,
      title: p.title,
      excerpt: p.excerpt,
      metaDescription: p.metaDescription,
      keyword: p.keyword,
    })),
    gscPages: options.gscPages.map((g) => ({
      url: g.url,
      topQueries: g.queries.slice(0, 12),
    })),
    outputSchema: {
      campaignName: `string, maxLength ${GOOGLE_ADS_CAMPAIGN_NAME_MAX}`,
      adGroups: [
        {
          name: `string, maxLength ${GOOGLE_ADS_CAMPAIGN_NAME_MAX}`,
          landingPageUrl: "exact from allowedLandingUrls",
          theme: "short intent theme",
        },
      ],
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
    throw new Error(`Campaign plan hit max_tokens (${maxTokens}). Reduce ad group count or use a larger model.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Campaign plan returned invalid JSON.");
  }

  const root = parsed as PpcCampaignPlanResult;
  if (!root.campaignName?.trim() || !Array.isArray(root.adGroups)) {
    throw new Error("Campaign plan JSON missing campaignName or adGroups.");
  }
  if (root.adGroups.length !== options.adGroupCount) {
    throw new Error(`Campaign plan returned ${root.adGroups.length} ad groups; expected ${options.adGroupCount}.`);
  }

  const allowed = new Set(allowedLandingUrls);
  for (const ag of root.adGroups) {
    if (!ag.name?.trim() || !ag.landingPageUrl?.trim() || !allowed.has(ag.landingPageUrl.trim())) {
      throw new Error("Campaign plan ad group has invalid name or landingPageUrl.");
    }
  }

  return {
    campaignName: formatPpcGoogleCampaignName(
      options.focusKeyword?.trim() ||
        root.adGroups[0]?.theme?.trim() ||
        root.adGroups[0]?.name?.trim() ||
        "",
    ),
    adGroups: root.adGroups.map((ag) => ({
      name: ag.name.trim(),
      landingPageUrl: ag.landingPageUrl.trim(),
      theme: ag.theme?.trim() || ag.name.trim(),
    })),
  };
}
