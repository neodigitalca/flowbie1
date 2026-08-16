import type { WordPressSite } from "@/components/integrations/types";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import { loadMetaContextResearch } from "@/lib/ppc/meta-ad-context-assembler";
import {
  formatContentCreatorChecklistFeedback,
  runContentCalendarFbInstagramCopyAgent,
  runContentCalendarKeywordAgent,
  runContentCalendarLinkedinCopyAgent,
  runContentCalendarPromptModifierAgent,
  runContentCalendarSocialBriefAgent,
  runContentCalendarSocialCopyChecklistAgent,
} from "@/lib/social/content-creator-agents";
import { applyManualContentCalendarTools } from "@/lib/social/content-creator-manual-tools";
import {
  createInitialContentGenerateProgress,
  patchContentGenerateGranularStep,
  type ContentGenerateGranularStepId,
  type ContentGenerateProgressState,
} from "@/lib/social/content-creator-progress-types";
import { contentCreatorSocialBriefMarkdown } from "@/lib/social/content-creator-social-brief";
import type {
  ContentCalendarRow,
  ContentCreatorGenerateConfig,
  ContentResearchSection,
} from "@/lib/social/content-creator-types";
import { cellString } from "@/lib/social/content-creator-types";

export type RunContentCreatorGenerateResult = {
  events?: string;
  keyword: string;
  dayOfWeek?: string;
  date?: string;
  fbInstagramContent: string;
  linkedinContent: string;
  landingPageUrl?: string;
  promptModifier?: string;
  researchSections: ContentResearchSection[];
};

export type ContentCreatorGeneratePartialUpdate = Partial<
  Pick<
    ContentCalendarRow,
    | "events"
    | "keyword"
    | "dayOfWeek"
    | "date"
    | "fbInstagramContent"
    | "linkedinContent"
    | "landingPageUrl"
    | "promptModifier"
    | "researchSections"
  >
>;

export type RunContentCreatorGenerateOptions = {
  site: WordPressSite;
  apiKey: string;
  model: string;
  config: ContentCreatorGenerateConfig;
  sourceRow: ContentCalendarRow;
  landingPages: PpcWpPageContext[];
  onProgress: (progress: ContentGenerateProgressState) => void;
  onResearchSections?: (sections: ContentResearchSection[]) => void;
  onPartialUpdate?: (patch: ContentCreatorGeneratePartialUpdate) => void;
  signal?: AbortSignal;
};

function patchStep(
  progress: ContentGenerateProgressState,
  stepId: ContentGenerateGranularStepId,
  status: "running" | "done" | "error",
  statusMessage?: string,
): ContentGenerateProgressState {
  return patchContentGenerateGranularStep(progress, stepId, status, statusMessage);
}

function upsertSection(
  sections: ContentResearchSection[],
  id: string,
  title: string,
  status: ContentResearchSection["status"],
  markdown?: string,
): ContentResearchSection[] {
  const existing = sections.find((s) => s.id === id);
  if (existing) {
    return sections.map((s) =>
      s.id === id ? { ...s, status, markdown: markdown ?? s.markdown } : s,
    );
  }
  return [...sections, { id, title, status, markdown }];
}

export async function runContentCreatorGenerate(
  options: RunContentCreatorGenerateOptions,
): Promise<RunContentCreatorGenerateResult> {
  const { site, apiKey, model, config, sourceRow, landingPages, onProgress, signal } = options;
  let progress = createInitialContentGenerateProgress();
  let researchSections: ContentResearchSection[] = sourceRow.researchSections ?? [];

  const publishSections = (sections: ContentResearchSection[]) => {
    researchSections = sections;
    options.onResearchSections?.(sections);
    options.onPartialUpdate?.({ researchSections: sections });
  };

  progress = patchStep(progress, "schedule", "running");
  onProgress(progress);

  const [manualRow] = applyManualContentCalendarTools([sourceRow], {
    landingPages,
    landingPageSource: config.landingPageSource,
  });

  const rowEvents = cellString(sourceRow.events);
  const hasEventContext = rowEvents.length > 0;
  const siteName = cellString(site.name);
  const siteUrl = cellString(site.siteUrl);

  progress = patchStep(progress, "schedule", "done");
  onProgress(progress);
  options.onPartialUpdate?.({
    landingPageUrl: manualRow.landingPageUrl,
  });

  progress = patchStep(progress, "load-wp", "running");
  onProgress(progress);

  const landingPageUrl = cellString(manualRow.landingPageUrl);
  let pageContext = "";
  if (landingPageUrl.length > 0) {
    try {
      const research = await loadMetaContextResearch(landingPageUrl, { signal });
      const researchContext = cellString(research.pageContext);
      const researchTitle = cellString(research.title);
      pageContext = researchContext || researchTitle;
      researchSections = upsertSection(
        researchSections,
        "landing-context",
        "Landing page context",
        "done",
        pageContext,
      );
      publishSections(researchSections);
    } catch {
      researchSections = upsertSection(
        researchSections,
        "landing-context",
        "Landing page context",
        "error",
      );
      publishSections(researchSections);
    }
  }

  progress = patchStep(progress, "load-seo-context", "done");
  progress = patchStep(progress, "load-wp", "done");
  onProgress(progress);

  progress = patchStep(progress, "keyword", "running");
  onProgress(progress);

  const keywordResult = await runContentCalendarKeywordAgent({
    apiKey,
    model,
    siteId: site.id,
    siteName,
    siteUrl,
    landingPageUrl,
    seedKeyword: cellString(manualRow.keyword) || undefined,
    pageContext,
    signal,
  });

  progress = patchStep(progress, "keyword", "done");
  onProgress(progress);
  options.onPartialUpdate?.({ keyword: keywordResult.keyword });

  progress = patchStep(progress, "social-brief", "running");
  onProgress(progress);

  const socialBrief = await runContentCalendarSocialBriefAgent({
    apiKey,
    model,
    siteId: site.id,
    siteName,
    siteUrl,
    keyword: keywordResult.keyword,
    landingPageUrl,
    events: hasEventContext ? rowEvents : undefined,
    pageContext,
    signal,
  });

  researchSections = upsertSection(
    researchSections,
    "social-strategy-brief",
    "Social strategy brief",
    "done",
    contentCreatorSocialBriefMarkdown(socialBrief),
  );
  publishSections(researchSections);

  progress = patchStep(progress, "social-brief", "done");
  progress = patchStep(progress, "fb-instagram-copy", "running");
  onProgress(progress);

  const manualFb = cellString(manualRow.fbInstagramContent);
  let fbResult = manualFb.length > 0
    ? { fbInstagramContent: manualFb }
    : await runContentCalendarFbInstagramCopyAgent({
        apiKey,
        model,
        siteId: site.id,
        siteName,
        siteUrl,
        keyword: keywordResult.keyword,
        socialBrief,
        landingPageUrl,
        events: hasEventContext ? rowEvents : undefined,
        pageContext,
        signal,
      });

  if (manualFb.length === 0) {
    const checklist = await runContentCalendarSocialCopyChecklistAgent({
      apiKey,
      model,
      siteId: site.id,
      keyword: keywordResult.keyword,
      socialBrief,
      fbInstagramContent: fbResult.fbInstagramContent,
      hasEventContext,
      signal,
    });
    if (checklist.length > 0) {
      fbResult = await runContentCalendarFbInstagramCopyAgent({
        apiKey,
        model,
        siteId: site.id,
        siteName,
        siteUrl,
        keyword: keywordResult.keyword,
        socialBrief,
        landingPageUrl,
        events: hasEventContext ? rowEvents : undefined,
        pageContext,
        checklistFeedback: formatContentCreatorChecklistFeedback(checklist),
        signal,
      });
    }
  }

  progress = patchStep(progress, "fb-instagram-copy", "done");
  progress = patchStep(progress, "linkedin-copy", "running");
  onProgress(progress);

  const manualLi = cellString(manualRow.linkedinContent);
  const liResult = manualLi.length > 0
    ? { linkedinContent: manualLi }
    : await runContentCalendarLinkedinCopyAgent({
        apiKey,
        model,
        siteId: site.id,
        siteName,
        siteUrl,
        keyword: keywordResult.keyword,
        socialBrief,
        landingPageUrl,
        events: hasEventContext ? rowEvents : undefined,
        pageContext,
        signal,
      });

  progress = patchStep(progress, "linkedin-copy", "done");
  onProgress(progress);
  options.onPartialUpdate?.({
    fbInstagramContent: fbResult.fbInstagramContent,
    linkedinContent: liResult.linkedinContent,
  });

  progress = patchStep(progress, "prompt-modifier", "running");
  onProgress(progress);

  const manualMod = cellString(manualRow.promptModifier);
  const modResult = manualMod.length > 0
    ? { promptModifier: manualMod }
    : await runContentCalendarPromptModifierAgent({
        apiKey,
        model,
        siteId: site.id,
        siteName,
        siteUrl,
        keyword: keywordResult.keyword,
        fbInstagramContent: fbResult.fbInstagramContent,
        linkedinContent: liResult.linkedinContent,
        landingPageUrl,
        signal,
      });

  progress = patchStep(progress, "prompt-modifier", "done");
  onProgress(progress);

  return {
    events: hasEventContext ? rowEvents : undefined,
    keyword: keywordResult.keyword,
    dayOfWeek: manualRow.dayOfWeek,
    date: manualRow.date,
    fbInstagramContent: fbResult.fbInstagramContent,
    linkedinContent: liResult.linkedinContent,
    landingPageUrl: landingPageUrl.length > 0 ? landingPageUrl : undefined,
    promptModifier: modResult.promptModifier,
    researchSections,
  };
}
