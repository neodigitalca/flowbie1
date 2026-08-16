import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { appendMasterInstructionsToSystemPrompt, ensureMasterInstructionsInMemory } from "@/lib/master-instructions-storage";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import {
  buildMetaCopyChecklistSystemPrompt,
  buildMetaPageContextBlock,
  parseMetaChecklistItems,
} from "@/lib/ppc/meta-ad-prompt-builder";
import { appendNeoPulseMetaMarketingContext } from "@/lib/ppc/neo-pulse-meta-marketing-context";
import { appendMetaInstagramBestPractices } from "@/lib/ppc/load-meta-ad-instagram-best-practices";
import { callMetaAdJsonCompletion } from "@/lib/ppc/meta-ad-openrouter-json";
import type {
  MetaAdBlueprint,
  MetaAdChecklistItem,
  MetaAdContextSource,
  MetaAdCreativeBrief,
  MetaAdInstagramGoal,
} from "@/lib/ppc/meta-ads-types";

/** Copy checklist agent */
export async function runMetaAdCopyChecklistAgent(options: {
  apiKey: string;
  model: string;
  siteId?: string;
  goal: MetaAdInstagramGoal;
  blueprint: MetaAdBlueprint;
  creativeBrief: MetaAdCreativeBrief;
  landingPage: PpcWpPageContext | undefined;
  pageContext?: string;
  focusKeyword?: string;
  teamName?: string | null;
  contextSource?: MetaAdContextSource | null;
  siteName?: string;
  signal?: AbortSignal;
}): Promise<MetaAdChecklistItem[]> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  await ensureMasterInstructionsInMemory(options.siteId ?? null);

  const user = JSON.stringify({
    task: "meta_ad_copy_checklist",
    goal: options.goal,
    blueprint: options.blueprint,
    creativeBrief: options.creativeBrief,
    focusKeyword: options.focusKeyword?.trim() || options.landingPage?.keyword?.trim() || "",
    pageContext: options.pageContext?.trim() || buildMetaPageContextBlock(options.landingPage),
    outputSchema: {
      items: [{ id: "string", label: "string", detail: "optional string" }],
    },
  });

  const system = appendMasterInstructionsToSystemPrompt(
    appendMetaInstagramBestPractices(
      appendNeoPulseMetaMarketingContext(buildMetaCopyChecklistSystemPrompt(options.siteName), options.teamName, {
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
    temperature: 0.25,
    errorLabel: "Copy checklist",
    signal: options.signal,
  });

  const items = parseMetaChecklistItems(parsed);
  if (!items.length) {
    throw new Error("Copy checklist returned no items.");
  }
  return items;
}
