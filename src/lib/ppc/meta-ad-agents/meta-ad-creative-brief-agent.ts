import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { appendMasterInstructionsToSystemPrompt, ensureMasterInstructionsInMemory } from "@/lib/master-instructions-storage";
import {
  buildMetaCreativeBriefSystemPrompt,
  buildMetaCreativeBriefUserPayload,
  parseMetaCreativeBrief,
} from "@/lib/ppc/meta-ad-creative-brief";
import { appendFlowbieMetaMarketingContext } from "@/lib/ppc/flowbie-meta-marketing-context";
import { appendMetaInstagramBestPractices } from "@/lib/ppc/load-meta-ad-instagram-best-practices";
import { callMetaAdJsonCompletion } from "@/lib/ppc/meta-ad-openrouter-json";
import type {
  MetaAdColorPalette,
  MetaAdContextSource,
  MetaAdCreativeBrief,
  MetaAdInstagramGoal,
  MetaAdPlacement,
  MetaAdVisualToolPalette,
} from "@/lib/ppc/meta-ads-types";

/** Creative brief agent */
export async function runMetaAdCreativeBriefAgent(options: {
  apiKey: string;
  model: string;
  siteId?: string;
  goal: MetaAdInstagramGoal;
  focusKeyword?: string;
  placement: MetaAdPlacement;
  pageContext?: string;
  teamName?: string | null;
  contextSource?: MetaAdContextSource | null;
  localityCity?: string;
  localityRegion?: string;
  colorPalette?: MetaAdColorPalette;
  visualToolPalette?: MetaAdVisualToolPalette;
  siteName?: string;
  signal?: AbortSignal;
}): Promise<MetaAdCreativeBrief> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  await ensureMasterInstructionsInMemory(options.siteId ?? null);

  const system = appendMasterInstructionsToSystemPrompt(
    appendMetaInstagramBestPractices(
      appendFlowbieMetaMarketingContext(buildMetaCreativeBriefSystemPrompt(options.siteName), options.teamName, {
        contextSource: options.contextSource,
      }),
    ),
    options.siteId ?? null,
  );

  const user = buildMetaCreativeBriefUserPayload({
    goal: options.goal,
    focusKeyword: options.focusKeyword,
    placement: options.placement,
    pageContext: options.pageContext,
    localityCity: options.localityCity,
    localityRegion: options.localityRegion,
    colorPalette: options.colorPalette,
    visualToolPalette: options.visualToolPalette,
  });

  const parsed = await callMetaAdJsonCompletion({
    apiKey: options.apiKey,
    model: options.model,
    system,
    user,
    maxTokens: getCompetitorReportMaxOutputTokens(options.model),
    temperature: 0.35,
    errorLabel: "Creative brief",
    signal: options.signal,
  });

  return parseMetaCreativeBrief(parsed, options.focusKeyword);
}
