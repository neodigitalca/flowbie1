import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { appendMasterInstructionsToSystemPrompt, ensureMasterInstructionsInMemory } from "@/lib/master-instructions-storage";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import {
  clampMetaAdDescription,
  clampMetaAdHeadline,
  clampMetaAdPrimaryText,
  META_AD_DESCRIPTION_MAX,
  META_AD_HEADLINE_MAX,
  META_AD_PRIMARY_TEXT_MAX,
  normalizeMetaAdCta,
} from "@/lib/ppc/meta-ads-field-limits";
import {
  buildMetaCopySystemPrompt,
  buildMetaPageContextBlock,
  formatMetaChecklistForPrompt,
} from "@/lib/ppc/meta-ad-prompt-builder";
import { appendNeoPulseMetaMarketingContext } from "@/lib/ppc/neo-pulse-meta-marketing-context";
import { appendMetaInstagramBestPractices } from "@/lib/ppc/load-meta-ad-instagram-best-practices";
import { callMetaAdJsonCompletion } from "@/lib/ppc/meta-ad-openrouter-json";
import type {
  MetaAdBlueprint,
  MetaAdChecklistItem,
  MetaAdContextSource,
  MetaAdCopy,
  MetaAdCreativeBrief,
  MetaAdInstagramGoal,
} from "@/lib/ppc/meta-ads-types";

export function validateMetaAdCopyPayload(
  raw: unknown,
  finalUrl: string,
): MetaAdCopy {
  const root = raw as Partial<MetaAdCopy>;
  const primaryText = clampMetaAdPrimaryText(root.primaryText ?? "");
  const headline = clampMetaAdHeadline(root.headline ?? "");
  const description = clampMetaAdDescription(root.description ?? "");
  const cta = normalizeMetaAdCta(root.cta);

  if (!primaryText) throw new Error("Meta copy missing primaryText.");
  if (!headline) throw new Error("Meta copy missing headline.");
  if (!description) throw new Error("Meta copy missing description.");

  return {
    primaryText,
    headline,
    description,
    cta,
    finalUrl: finalUrl.trim(),
  };
}

/** Meta ad copy agent */
export async function runMetaAdCopyAgent(options: {
  apiKey: string;
  model: string;
  siteId?: string;
  goal: MetaAdInstagramGoal;
  blueprint: MetaAdBlueprint;
  creativeBrief: MetaAdCreativeBrief;
  checklist: MetaAdChecklistItem[];
  landingPage: PpcWpPageContext | undefined;
  pageContext?: string;
  finalUrl: string;
  focusKeyword?: string;
  teamName?: string | null;
  contextSource?: MetaAdContextSource | null;
  siteName?: string;
  fbInstagramContent?: string;
  signal?: AbortSignal;
}): Promise<MetaAdCopy> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  if (!options.finalUrl.trim()) {
    throw new Error("Landing page URL is required for Meta ad copy.");
  }
  await ensureMasterInstructionsInMemory(options.siteId ?? null);

  const user = JSON.stringify({
    task: "meta_ad_copy",
    goal: options.goal,
    blueprint: options.blueprint,
    creativeBrief: options.creativeBrief,
    checklist: formatMetaChecklistForPrompt(options.checklist),
    focusKeyword: options.focusKeyword?.trim() || options.landingPage?.keyword?.trim() || "",
    pageContext: options.pageContext?.trim() || buildMetaPageContextBlock(options.landingPage),
    finalUrl: options.finalUrl.trim(),
    ...(options.fbInstagramContent?.trim()
      ? {
          importedFbInstagramContent: options.fbInstagramContent.trim(),
          calendarCopyInstruction:
            "Refine importedFbInstagramContent into Meta ad copy. Keep the calendar intent; do not ignore it.",
        }
      : {}),
    outputSchema: {
      primaryText: `string, maxLength ${META_AD_PRIMARY_TEXT_MAX}`,
      headline: `string, maxLength ${META_AD_HEADLINE_MAX}`,
      description: `string, maxLength ${META_AD_DESCRIPTION_MAX}`,
      cta: "Learn More | Sign Up | Contact Us | Get Quote | Book Now",
    },
  });

  const system = appendMasterInstructionsToSystemPrompt(
    appendMetaInstagramBestPractices(
      appendNeoPulseMetaMarketingContext(buildMetaCopySystemPrompt(options.siteName), options.teamName, {
        contextSource: options.contextSource,
      }),
    ),
    options.siteId ?? null,
  );
  const maxTokens = getCompetitorReportMaxOutputTokens(options.model);

  const parsed = await callMetaAdJsonCompletion({
    apiKey: options.apiKey,
    model: options.model,
    system,
    user,
    maxTokens,
    temperature: 0.3,
    errorLabel: "Meta copy",
    signal: options.signal,
  });

  return validateMetaAdCopyPayload(parsed, options.finalUrl);
}
