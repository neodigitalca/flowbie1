import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { appendMasterInstructionsToSystemPrompt, ensureMasterInstructionsInMemory } from "@/lib/master-instructions-storage";
import {
  buildMetaImageChecklistSystemPrompt,
  parseMetaChecklistItems,
} from "@/lib/ppc/meta-ad-prompt-builder";
import { appendFlowbieMetaMarketingContext } from "@/lib/ppc/flowbie-meta-marketing-context";
import { appendMetaInstagramBestPractices } from "@/lib/ppc/load-meta-ad-instagram-best-practices";
import { callMetaAdJsonCompletion } from "@/lib/ppc/meta-ad-openrouter-json";
import type {
  MetaAdBlueprint,
  MetaAdChecklistItem,
  MetaAdContextSource,
  MetaAdCopy,
  MetaAdCreativeBrief,
  MetaAdInstagramGoal,
  MetaAdPlacement,
  MetaAdVisualReferenceElement,
} from "@/lib/ppc/meta-ads-types";

/** Image checklist agent */
export async function runMetaAdImageChecklistAgent(options: {
  apiKey: string;
  model: string;
  siteId?: string;
  goal: MetaAdInstagramGoal;
  blueprint: MetaAdBlueprint;
  creativeBrief: MetaAdCreativeBrief;
  copy: MetaAdCopy;
  pageContext?: string;
  focusKeyword?: string;
  placement: MetaAdPlacement;
  teamName?: string | null;
  contextSource?: MetaAdContextSource | null;
  allowPeopleInImage?: boolean;
  signal?: AbortSignal;
  localityCity?: string;
  siteName?: string;
  visualReferenceElements: MetaAdVisualReferenceElement[];
}): Promise<MetaAdChecklistItem[]> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  if (!options.creativeBrief) {
    throw new Error("Creative brief is required for image checklist.");
  }
  if (options.signal?.aborted) {
    throw new Error("Generation cancelled");
  }

  await ensureMasterInstructionsInMemory(options.siteId ?? null);

  const user = JSON.stringify({
    task: "meta_ad_image_checklist",
    goal: options.goal,
    blueprint: options.blueprint,
    creativeBrief: options.creativeBrief,
    copy: options.copy,
    focusKeyword: options.focusKeyword?.trim() || "",
    placement: options.placement,
    pageContext: options.pageContext?.trim() || "",
    localityCity: options.localityCity?.trim() || "",
    visualReferenceElements: options.visualReferenceElements,
    outputSchema: {
      items: [{ id: "string", label: "string", detail: "optional string" }],
    },
  });

  const system = appendMasterInstructionsToSystemPrompt(
    appendMetaInstagramBestPractices(
      appendFlowbieMetaMarketingContext(
        buildMetaImageChecklistSystemPrompt({
          allowPeopleInImage: options.allowPeopleInImage,
          siteName: options.siteName,
        }),
        options.teamName,
        { contextSource: options.contextSource },
      ),
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
    errorLabel: "Image checklist",
    signal: options.signal,
  });

  const items = parseMetaChecklistItems(parsed);
  if (!items.length) {
    throw new Error("Image checklist returned no items.");
  }
  return items;
}
