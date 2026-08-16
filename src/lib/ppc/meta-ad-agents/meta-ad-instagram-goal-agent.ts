import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { appendMasterInstructionsToSystemPrompt, ensureMasterInstructionsInMemory } from "@/lib/master-instructions-storage";
import { appendNeoPulseMetaMarketingContext } from "@/lib/ppc/neo-pulse-meta-marketing-context";
import { appendMetaInstagramBestPractices } from "@/lib/ppc/load-meta-ad-instagram-best-practices";
import {
  buildMetaInstagramGoalSystemPrompt,
  buildMetaInstagramGoalUserPayload,
  parseMetaInstagramGoal,
} from "@/lib/ppc/meta-ad-prompt-builder";
import { callMetaAdJsonCompletion } from "@/lib/ppc/meta-ad-openrouter-json";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import type { MetaAdContextSource, MetaAdInstagramGoal, MetaAdPlacement } from "@/lib/ppc/meta-ads-types";

/** Instagram ad goal agent */
export async function runMetaAdInstagramGoalAgent(options: {
  apiKey: string;
  model: string;
  siteId?: string;
  siteName?: string;
  landingPage: PpcWpPageContext | undefined;
  pageContext?: string;
  focusKeyword?: string;
  placement: MetaAdPlacement;
  landingPageUrl?: string;
  teamName?: string | null;
  contextSource?: MetaAdContextSource | null;
  signal?: AbortSignal;
}): Promise<MetaAdInstagramGoal> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  await ensureMasterInstructionsInMemory(options.siteId ?? null);

  const system = appendMasterInstructionsToSystemPrompt(
    appendMetaInstagramBestPractices(
      appendNeoPulseMetaMarketingContext(buildMetaInstagramGoalSystemPrompt(options.siteName), options.teamName, {
        contextSource: options.contextSource,
      }),
    ),
    options.siteId ?? null,
  );
  const user = buildMetaInstagramGoalUserPayload({
    landingPage: options.landingPage,
    pageContext: options.pageContext,
    focusKeyword: options.focusKeyword,
    placement: options.placement,
    contextSource: options.contextSource ?? "custom",
    landingPageUrl: options.landingPageUrl,
    siteName: options.siteName,
  });
  const maxTokens = getCompetitorReportMaxOutputTokens(options.model);

  const parsed = await callMetaAdJsonCompletion({
    apiKey: options.apiKey,
    model: options.model,
    system,
    user,
    maxTokens,
    temperature: 0.35,
    errorLabel: "Instagram ad goal",
    signal: options.signal,
  });

  return parseMetaInstagramGoal(parsed);
}
