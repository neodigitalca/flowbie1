import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { callMetaAdJsonCompletion } from "@/lib/ppc/meta-ad-openrouter-json";
import { appendMetaInstagramBestPractices } from "@/lib/ppc/load-meta-ad-instagram-best-practices";
import {
  buildMetaVisualReferencePlanSystemPrompt,
  buildMetaVisualReferencePlanUserPayload,
  getMetaReferencePlanYear,
  parseMetaVisualReferencePlan,
} from "@/lib/ppc/meta-ad-visual-reference-plan";
import type {
  MetaAdContextSource,
  MetaAdCreativeBrief,
  MetaAdInstagramGoal,
  MetaAdPlacement,
  MetaAdVisualReferenceElement,
} from "@/lib/ppc/meta-ads-types";
import { metaAdPlacementLabel } from "@/lib/ppc/meta-ads-field-limits";

/** Visual reference plan agent */
export async function runMetaAdVisualReferencePlanAgent(options: {
  apiKey: string;
  model: string;
  goal: MetaAdInstagramGoal;
  creativeBrief: MetaAdCreativeBrief;
  placement: MetaAdPlacement;
  focusKeyword?: string;
  contextSource?: MetaAdContextSource;
  programBrief?: string;
  localityCity?: string;
  signal?: AbortSignal;
}): Promise<MetaAdVisualReferenceElement[]> {
  if (options.signal?.aborted) {
    throw new Error("Generation cancelled");
  }
  if (!options.creativeBrief) {
    throw new Error("Creative brief is required for visual reference plan.");
  }

  const currentYear = getMetaReferencePlanYear();
  const contextSource = options.contextSource ?? "custom";
  const parsed = await callMetaAdJsonCompletion({
    apiKey: options.apiKey,
    model: options.model,
    system: appendMetaInstagramBestPractices(
      buildMetaVisualReferencePlanSystemPrompt({
        contextSource,
        creativeMode: options.goal.creativeMode,
        creativeBrief: options.creativeBrief,
      }),
    ),
    user: buildMetaVisualReferencePlanUserPayload({
      creativeBrief: options.creativeBrief,
      goal: {
        visualDirection: options.goal.visualDirection,
        primaryTopic: options.goal.primaryTopic,
        creativeMode: options.goal.creativeMode,
      },
      placement: options.placement,
      placementLabel: metaAdPlacementLabel(options.placement),
      focusKeyword: options.focusKeyword,
      currentYear,
      contextSource,
      programBrief: options.programBrief,
      localityCity: options.localityCity,
    }),
    maxTokens: getCompetitorReportMaxOutputTokens(options.model),
    temperature: 0.2,
    errorLabel: "Visual reference plan",
    signal: options.signal,
  });

  return parseMetaVisualReferencePlan(parsed, currentYear, {
    creativeBrief: options.creativeBrief,
    localityCity: options.localityCity,
  });
}
