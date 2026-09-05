/**
 * Regenerate only the [ILLUSTRATIVE] body H2 in existing post HTML.
 */

import type { AgentConfig } from "@/types/agent-config";
import type { WordPressSite } from "@/components/integrations/types";
import { buildSystemPrompt, buildBulkHarnessSectionUserPrompt, generateSingleSectionPrompt } from "@/lib/prompt-builders";
import { runHarnessOpenRouterSection, resolveHarnessHttpReferer } from "@/lib/bulk/harness-openrouter-worker-client";
import { prepareHarnessSectionHtml } from "@/lib/bulk/harness-section-validate";
import { injectBlacklistRagIntoMessages } from "@/lib/content-word-blocklist";
import { getProductionModel } from "@/lib/optimization-settings-storage";
import {
  extractIllustrativeExample,
  buildIllustrativeExampleResearchQuery,
  formatResearchAsOfLabel,
} from "@/lib/content-optimization/topic-research-fanout";
import {
  firstPartyAuthorityBlockFromBrief,
  formatIllustrativePersonaPromptBlock,
} from "@/lib/content-optimization/first-party-authority-prompt";
import {
  formatPageLocalContextPromptBlock,
  resolvePageLocalContext,
} from "@/lib/content-optimization/page-local-context";
import { formatAnswerGroundingForIllustrativePromptBlock } from "@/lib/content-optimization/defensible-specificity-prompt";
import { ILLUSTRATIVE_DEFAULT_H2 } from "@/lib/content-optimization/first-party-authority-prompt";
import { parseSeoResearchBrief, llmAuditSummaryFromSeoResearchBrief } from "@/lib/content-optimization/seo-research-brief-for-optimize";
import { formatEntityReferencePromptBlock } from "@/lib/entity-place-reference";
import { normalizeEntityHintCommaLabel } from "@/lib/comma-place-label";
import {
  findH2OpenPositions,
  extractAnswerSectionHtml,
  looksLikeBlockedHostHtml,
  outlineFromBodyH2Titles,
  type OverviewHarnessPageKind,
} from "@/lib/overview/overview-blog-overview-prepend";
import { extractH2TextsFromHtml } from "@/lib/overview/overview-blog-headers-extract";
import { formatOutlineTitlesForHarnessPrompt } from "@/lib/bulk/bulk-harness-outline";

export type IllustrativeH2Bounds = {
  openAt: number;
  endAt: number;
  title: string;
};

function sectionLooksIllustrative(htmlSlice: string, title: string): boolean {
  const hasRecommendationH3 = /<h3[^>]*>\s*recommendation\s*:/i.test(htmlSlice);
  const hasBlockquote = /<blockquote/i.test(htmlSlice);
  const hasLegacyScenarioH3 = /<h3[^>]*>\s*scenario\s*:/i.test(htmlSlice);
  const titleKey = title.trim().toLowerCase();
  const titleLooksIllustrative =
    titleKey.includes("local homeowner example") ||
    titleKey.includes("realistic local") ||
    titleKey.includes("local situation") ||
    titleKey.includes("local scenario");
  return (hasRecommendationH3 && hasBlockquote) || hasLegacyScenarioH3 || titleLooksIllustrative;
}

/** Locate the body H2 whose section is the [ILLUSTRATIVE] block (blockquote + Recommendation h3, or legacy Scenario h3). */
export function findIllustrativeH2Bounds(html: string): IllustrativeH2Bounds | null {
  const src = (html ?? "").trim();
  if (!src) return null;
  const positions = findH2OpenPositions(src);
  for (let i = 0; i < positions.length; i += 1) {
    const openAt = positions[i]!;
    const endAt = i + 1 < positions.length ? positions[i + 1]! : src.length;
    const slice = src.slice(openAt, endAt);
    const titles = extractH2TextsFromHtml(slice);
    const title = titles[0]?.trim() ?? "";
    if (!sectionLooksIllustrative(slice, title)) continue;
    return { openAt, endAt, title };
  }
  return null;
}

export function extractIllustrativeSectionHtml(html: string): string {
  const bounds = findIllustrativeH2Bounds(html);
  if (!bounds) return "";
  return html.slice(bounds.openAt, bounds.endAt).trim();
}

export function replaceIllustrativeSectionHtml(fullHtml: string, newSectionHtml: string): string {
  const bounds = findIllustrativeH2Bounds(fullHtml);
  if (!bounds) {
    throw new Error("No [ILLUSTRATIVE] H2 found in body HTML.");
  }
  const replacement = newSectionHtml.trim();
  if (!replacement) {
    throw new Error("Scenario section generator returned empty HTML.");
  }
  return `${fullHtml.slice(0, bounds.openAt)}${replacement}${fullHtml.slice(bounds.endAt)}`;
}

function buildIllustrativeRegenAgent(h2Title: string): AgentConfig {
  return {
    id: "illustrative-scenario-regen",
    step: 0,
    title: h2Title,
    description:
      "[ILLUSTRATIVE]: one genderless named persona scenario with titled site recommendation. [BLOCKQUOTE]: scenario prose in blockquote after the intro paragraph, grounded in brief research when available.",
    features: [
      "[ILLUSTRATIVE]: copy injected persona block exactly",
      "[BLOCKQUOTE]: scenario narrative in blockquote only",
    ],
    headingLevel: 2,
    h3Enabled: true,
  };
}

export type GenerateScenarioSectionArgs = {
  sourceHtml: string;
  articleTitle: string;
  focusKeyword: string;
  illustrativeH2Title: string;
  pageUrl?: string;
  site: WordPressSite;
  entity?: string;
  pageKind?: OverviewHarnessPageKind;
  seoResearchBrief?: string;
  apiKey: string;
  model?: string;
};

async function generateIllustrativeSectionHtml(args: GenerateScenarioSectionArgs): Promise<string> {
  const keyword = args.focusKeyword.trim() || args.articleTitle.trim() || "this topic";
  const h2Title = args.illustrativeH2Title.trim();
  if (!h2Title) throw new Error("Illustrative H2 title is required.");

  const bodyH2Titles = extractH2TextsFromHtml(args.sourceHtml).filter(
    (t) => t.trim().toLowerCase() !== "answer" && t.trim().toLowerCase() !== "overview",
  );
  const outline = outlineFromBodyH2Titles(bodyH2Titles);
  const outlineBlock = formatOutlineTitlesForHarnessPrompt(outline);
  const siblingTitles = bodyH2Titles.filter((t) => t.trim() !== h2Title);
  const sectionIndex = Math.max(0, bodyH2Titles.findIndex((t) => t.trim() === h2Title));
  const totalSections = bodyH2Titles.length + 2;
  const publishedTitles = ["Answer", "Overview", ...bodyH2Titles];

  const brief = args.seoResearchBrief?.trim() ? parseSeoResearchBrief(args.seoResearchBrief) : null;
  const researchAsOf =
    brief?.queryFanout?.researchAsOf?.trim() || formatResearchAsOfLabel(new Date());
  const pageCtx = resolvePageLocalContext({
    keyword,
    site: args.site,
    entity: args.pageKind === "entity" ? args.entity : undefined,
  });
  const location =
    pageCtx.prosePlaceLabel || pageCtx.primaryCity || "";
  const researchTopic = pageCtx.serviceTopic || keyword;
  const illustrativeExampleQuery =
    brief?.queryFanout?.illustrativeExampleQuery?.trim()
    || buildIllustrativeExampleResearchQuery({
      topic: researchTopic,
      location: location || researchTopic,
      asOfLabel: researchAsOf,
    });

  const persona = await extractIllustrativeExample({
    keyword,
    location,
    researchAsOf,
    companyName: args.site.name.trim(),
    illustrativeExampleQuery,
    pageUrl: args.pageUrl,
    entity: args.pageKind === "entity" ? args.entity : undefined,
    serpByQuery: brief?.queryFanout?.serpByQuery,
    chatGptByQuery: brief?.queryFanout?.chatGptByQuery,
    illustrativeH2Title: h2Title,
    pageTitle: args.articleTitle,
    siteId: args.site.id,
    site: args.site,
    pageLocalContext: pageCtx,
    answerSectionHtml: extractAnswerSectionHtml(args.sourceHtml),
  });

  const personaBlock = [
    formatPageLocalContextPromptBlock(pageCtx),
    formatIllustrativePersonaPromptBlock(persona, researchAsOf),
  ].join("\n\n");

  const agent = buildIllustrativeRegenAgent(h2Title);
  const sectionPrompt = generateSingleSectionPrompt(agent, "html");
  const connectedSite = { name: args.site.name, siteUrl: args.site.siteUrl };
  const entity = args.pageKind === "entity" ? args.entity?.trim() : undefined;

  let userPrompt = buildBulkHarnessSectionUserPrompt(
    args.articleTitle.trim() || keyword,
    `Regenerate the [ILLUSTRATIVE] body section "${h2Title}" with a fresh persona scenario for "${keyword}".`,
    sectionPrompt,
    outlineBlock,
    siblingTitles,
    sectionIndex + 2,
    totalSections,
    connectedSite,
    entity,
    { keywordFocus: keyword, seoResearch: args.seoResearchBrief },
    true,
    args.pageUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    h2Title,
    keyword,
    publishedTitles,
    args.seoResearchBrief ? llmAuditSummaryFromSeoResearchBrief(args.seoResearchBrief) : undefined,
    undefined,
    args.seoResearchBrief ? firstPartyAuthorityBlockFromBrief(brief, "") : undefined,
    formatAnswerGroundingForIllustrativePromptBlock(extractAnswerSectionHtml(args.sourceHtml)),
  );
  userPrompt += `\n\n${personaBlock}`;

  if (entity) {
    const canonical = normalizeEntityHintCommaLabel(entity);
    const referenceBlock = formatEntityReferencePromptBlock({
      entity: canonical,
      keyword,
    });
    if (referenceBlock) userPrompt += `\n\n${referenceBlock}`;
  }

  const systemPrompt = await buildSystemPrompt(
    "",
    args.apiKey,
    connectedSite,
    undefined,
    args.pageUrl,
    entity,
    args.site.id,
    keyword,
    undefined,
    undefined,
    undefined,
    undefined,
    "harness_section",
    "",
    undefined,
  );

  const model = args.model?.trim() || getProductionModel();
  const result = await runHarnessOpenRouterSection({
    sectionIndex: sectionIndex + 2,
    apiKey: args.apiKey,
    model,
    messages: injectBlacklistRagIntoMessages([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]),
    temperature: 0.85,
    maxTokens: 1400,
    topP: 0.9,
    httpReferer: resolveHarnessHttpReferer(),
    signal: args.signal,
  });

  return (
    prepareHarnessSectionHtml((result.content || "").trim(), {
      title: ILLUSTRATIVE_DEFAULT_H2,
      isOverview: false,
      isAnswer: false,
      isIllustrative: true,
    }) ?? ""
  );
}

export type ReplaceScenarioResult = {
  html: string;
  scenarioHtml: string;
  illustrativeH2Title: string;
};

/** One OR persona extract + one section write; replace illustrative H2 in place. */
export async function generateAndReplaceScenarioSectionHtml(
  args: Omit<GenerateScenarioSectionArgs, "illustrativeH2Title"> & { sourceHtml: string },
): Promise<ReplaceScenarioResult | null> {
  const sourceHtml = args.sourceHtml.trim();
  if (!sourceHtml) return null;
  if (looksLikeBlockedHostHtml(sourceHtml)) {
    throw new Error(
      "Page body looks like a Cloudflare block page, not WordPress content. Re-scrape or reload inventory, then retry Scenario.",
    );
  }

  const bounds = findIllustrativeH2Bounds(sourceHtml);
  if (!bounds) {
    throw new Error("No [ILLUSTRATIVE] H2 found in body HTML.");
  }

  const scenarioHtml = await generateIllustrativeSectionHtml({
    ...args,
    illustrativeH2Title: ILLUSTRATIVE_DEFAULT_H2,
  });

  const html = replaceIllustrativeSectionHtml(sourceHtml, scenarioHtml);
  return {
    html,
    scenarioHtml,
    illustrativeH2Title: ILLUSTRATIVE_DEFAULT_H2,
  };
}
