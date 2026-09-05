import type { AgentConfig } from '@/types/agent-config';
import { flowFreeformSectionsToAgents } from "@/lib/flow-freeform/flow-freeform-types";
import type { FlowFreeformSectionPlan } from "@/lib/flow-freeform/flow-freeform-types";
import type { KeywordData } from '../keyword-types';
import type { CSVRow } from './bulk-csv-parser';
import type { BulkProcessingOptions } from '../bulk-auto-generate';
import {
  buildBulkHarnessOutlineFromAgents,
  formatOutlineTitlesForHarnessPrompt,
  formatPressReleaseOutlineForHarnessPrompt,
  stitchHarnessSections,
} from './bulk-harness-outline';
import { ensurePressReleaseSectionHeading } from '@/lib/press-release/press-release-heading-guard';
import { pressReleaseHarnessSectionLabel } from '@/lib/press-release/press-release-harness-prompts';
import { buildFocusedArticlePurpose } from '@/lib/content-generation/article-length-policy';
import { formatSapPageWriterBlock } from '@/lib/prompt-builders/sap-page-template';
import { getProductionModel } from '@/lib/optimization-settings-storage';
import { resolveHarnessHttpReferer, runHarnessOpenRouterSection } from '@/lib/bulk/harness-openrouter-worker-client';
import {
  HARNESS_SECTION_MAX_ATTEMPTS,
  harnessSectionPreparedValid,
  illustrativeHarnessSectionValid,
  prepareHarnessSectionHtml,
  stitchedArticleHasAnswerH2,
  stitchedHarnessArticleValid,
} from '@/lib/bulk/harness-section-validate';
import { injectBlacklistRagIntoMessages } from '@/lib/content-word-blocklist';
import { findImportedSectionBody } from '@/lib/bulk/blog-import-parser';
import {
  formatImportedToneForHarnessPrompt,
  getImportedToneFromRow,
} from '@/lib/bulk/blog-import-tone';
import {
  ensureBlogHarnessSummaryFirst,
  ensureBlogHarnessSummaryLast,
  splitBlogHarnessBodyAndOverview,
} from '@/lib/bulk/blog-harness-summary-agent';
import { buildBlogHarnessAnswerAgent } from '@/lib/bulk/blog-harness-answer-agent';
import {
  buildHarnessSectionAnchorMap,
  formatHarnessInPageAnchorBlock,
} from '@/lib/bulk/harness-section-anchor-ids';
import {
  assertHarnessTokenBudgetPreflight,
  computeHarnessSectionTokenBudgets,
  isHarnessSeoOpenerBodyAgent,
} from '@/lib/bulk/harness-section-max-tokens';
import { formatMandatoryEntityWikipediaForPrompt } from '@/lib/bulk/entity-wikipedia-prompt';
import { formatAnswerGroundingForIllustrativePromptBlock } from '@/lib/content-optimization/defensible-specificity-prompt';
import {
  extractIllustrativeExample,
  formatResearchAsOfLabel,
  buildIllustrativeExampleResearchQuery,
} from '@/lib/content-optimization/topic-research-fanout';
import { formatIllustrativePersonaPromptBlock, formatOverviewPersonaTeaserBlock, resolveIllustrativeH2Title } from '@/lib/content-optimization/first-party-authority-prompt';
import type { IllustrativeExample } from '@/lib/overview-seo-content-brief';
import {
  formatPageLocalContextPromptBlock,
  resolvePageLocalContext,
} from '@/lib/content-optimization/page-local-context';
import { parseSeoResearchBrief } from '@/lib/content-optimization/seo-research-brief-for-optimize';
import { resolveSiteLocationLabel } from '@/lib/llm-audit/resolve-site-location-label';
import type { WordPressSite } from '@/components/integrations/types';

function agentHasIllustrativeFeature(agent: AgentConfig): boolean {
  return (
    agent.features?.some(
      (f) => typeof f === "string" && f.toLowerCase().trim().startsWith("[illustrative]"),
    ) ?? false
  );
}

/** Extra prompt wiring for WordPress content optimizer (RAG page URL, GSC, shared ACF context). */
export type HarnessPromptEnv = {
  knowledgeBaseContext?: string;
  currentPageUrl?: string;
  gscKeywordsContext?: string;
  /** Overrides CSV row entity logic when set (optimizer blueprint entity). */
  harnessEntity?: string;
  acfContextOverride?: AIDrivenACFContext;
  /** Optimizer: passed to buildSystemPrompt for cache-scoped internal link list. */
  siteId?: string;
  primaryKeyword?: string;
  /** Predetermined page/blog link plan from Link targets harness step. */
  linkTargetsPlan?: import("@/lib/bulk/bulk-generation-wp-inventory").LinkTargetsPlan;
  /** Relaxes blog SEO rules (per-H2 exact keyword, etc.) for press releases */
  contentKind?: "press_release";
  /** Merged multi-platform LLM audit — mandatory local facts in harness sections. */
  llmAuditSummary?: string;
  dfsArticleAuditBlock?: string;
  firstPartyAuthorityBlock?: string;
  llmAuditAuthorityExternalPairs?: import("@/lib/content-generation/external-link-placeholders").ExternalLinkPair[];
  /** Full site record for primary city resolution (not { name, siteUrl } alone). */
  wordpressSite?: WordPressSite;
};

/** Last-line / last-paragraph © or "All rights reserved" blocks (model hallucination). */
function stripTrailingCopyrightBoilerplate(content: string): string {
  let s = content.trimEnd();
  const htmlPs = [
    /<p[^>]*>\s*(?:©|&(?:copy|#169);)\s*\d{2,4}\s*[^<]{0,160}<\/p>\s*$/i,
    /<p[^>]*>\s*Copyright\s*(?:©|&(?:copy|#169);)?\s*\d{2,4}[^<]{0,220}<\/p>\s*$/i,
    /<p[^>]*>[^<]{0,240}All rights reserved\.?\s*<\/p>\s*$/i,
  ];
  const mdLines = [
    /\n(?:©|Copyright)\s*(?:©)?\s*\d{2,4}[^\n]{0,200}\s*$/i,
    /\n[^\n]{0,240}All rights reserved\.?\s*$/i,
  ];
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const re of htmlPs) {
      const n = s.replace(re, "");
      if (n !== s) {
        s = n.trimEnd();
        changed = true;
      }
    }
    for (const re of mdLines) {
      const n = s.replace(re, "");
      if (n !== s) {
        s = n.trimEnd();
        changed = true;
      }
    }
    if (!changed) break;
  }
  return s;
}

export function resolveAgentsForBulk(blueprint: {
  agents?: AgentConfig[];
  blueprintVersion?: number;
  flowFreeform?: { sections: FlowFreeformSectionPlan[] };
}): AgentConfig[] {
  const bp = blueprint as {
    agents?: AgentConfig[];
    blueprintVersion?: number;
    flowFreeform?: { sections: FlowFreeformSectionPlan[] };
  };
  return bp.blueprintVersion === 2 && bp.flowFreeform?.sections?.length
    ? flowFreeformSectionsToAgents(bp.flowFreeform.sections)
    : bp.agents ?? [];
}

/**
 * Generate full markdown blog content from blueprint
 */
export async function generateMarkdownContent(
  blueprint: { title?: string; purpose?: string; agents: AgentConfig[] },
  row: CSVRow,
  keywordData: KeywordData,
  knowledgeFiles: Array<{ name: string; content: string }>,
  activeKnowledgeBaseText: string,
  options: BulkProcessingOptions,
  connectedSite?: { name: string; siteUrl: string },
  wordPressPosts?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>,
  siteSummary?: string,
  semrushKeywordsContext?: string,
  semrushScatterContext?: string,
  semrushExternalUrls?: string[],
): Promise<string> {
  // Import the generation utilities
  const { buildSystemPrompt, buildUserPrompt, generateSectionsPrompt } = await import('../prompt-builders');
  const { streamGeneration } = await import('../api');

  // CRITICAL: Do NOT send knowledge base content - only send the blueprint structure
  // The blueprint already contains all necessary information in agent descriptions and features
  // This prevents "Request too large" errors from OpenRouter
  const knowledgeBaseContext = "";

  const bp = blueprint as {
    agents?: AgentConfig[];
    blueprintVersion?: number;
    flowFreeform?: { sections: FlowFreeformSectionPlan[] };
  };
  const agentsForBulk = ensureBlogHarnessSummaryFirst(resolveAgentsForBulk(bp));
  const sectionsPrompt = generateSectionsPrompt(agentsForBulk, "html");

  // Entity/service-area prompts (near [entity], local phrasing) only when posting to entity sitemap - not blog/post URLs
  const entity =
    row.entity &&
    row.entity.trim() &&
    row.entity.trim() !== "N/A"
      ? row.entity.trim()
      : undefined;

  // Build AI-driven ACF context from row (CSV columns are already semantic; no AI call for bulk)
  const acfContext: AIDrivenACFContext = {
    promptModifier: row.prompt_modifier?.trim() || undefined,
    keywordFocus: row.keyword_focus?.trim() || undefined,
    serviceArea: row.service_area_fields?.trim() || undefined,
  };

    const portfolioBlocked = options.portfolioBlockedHosts;

  const systemPrompt = await buildSystemPrompt(
    knowledgeBaseContext,
    options.openRouterApiKey,
    connectedSite,
    wordPressPosts,
    undefined,
    entity,
    undefined,
    undefined,
    siteSummary,
    semrushExternalUrls,
    portfolioBlocked,
    undefined,
  );
  const userPrompt = buildUserPrompt(
    blueprint.title || row.title,
    blueprint.purpose || buildFocusedArticlePurpose(keywordData.keyword),
    sectionsPrompt,
    connectedSite,
    entity, // Pass entity (or undefined for regular blog posts)
    acfContext, // Pass AI-driven ACF context for prompt (from row; no static key names)
    !!wordPressPosts?.length, // Only instruct internal links when we have WordPress API data
    undefined, // currentPageUrl - new post / bulk
    undefined, // gscKeywordsContext - bulk blog does not fetch GSC here
    semrushKeywordsContext,
    semrushScatterContext,
    semrushExternalUrls,
    portfolioBlocked,
  );

  // Stream generation
  let fullContent = '';
  try {
    // Clamp maxTokens to reasonable value (OpenRouter has limits)
    // 5000000 is way too high - use 16000 max which is the API limit
    const safeMaxTokens = Math.min(options.maxTokens || 16000, 16000);
    
    await streamGeneration({
      apiKey: options.openRouterApiKey,
      model: options.selectedModel || getProductionModel(),
      systemPrompt,
      userPrompt,
      temperature: options.temperature || 1.0,
      maxTokens: safeMaxTokens,
      topP: options.topP || 0.9,
      onContentChunk: (chunk) => {
        fullContent += chunk;
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for common OpenRouter errors
    if (errorMessage.includes('400')) {
      if (errorMessage.includes('invalid_api_key') || errorMessage.includes('Invalid API key')) {
        throw new Error(`OpenRouter API key is invalid or expired. Please check your API key in settings.`);
      }
      if (errorMessage.includes('model') || errorMessage.includes('not found')) {
        throw new Error(`Model "${options.selectedModel || getProductionModel()}" is not available. Please try a different model.`);
      }
      if (errorMessage.includes('rate_limit') || errorMessage.includes('quota')) {
        throw new Error(`OpenRouter rate limit or quota exceeded. Please check your account credits.`);
      }
      if (errorMessage.includes('too large') || errorMessage.includes('token')) {
        throw new Error(`Request too large. The prompt or context is exceeding OpenRouter limits. Try reducing the knowledge base content.`);
      }
    }
    
    throw new Error(`Markdown generation stream failed: ${errorMessage}`);
  }

  // Validate that we got actual content
  if (!fullContent || fullContent.trim().length === 0) {
    throw new Error('Markdown generation returned empty content - stream completed but no content was generated');
  }

  // Ensure minimum content length (at least a few sentences)
  if (fullContent.trim().length < 100) {
    throw new Error(`Markdown generation returned insufficient content (only ${fullContent.trim().length} characters). Expected at least 100 characters.`);
  }

  return stripTrailingCopyrightBoilerplate(fullContent);
}

function isCompletionTruncatedByTokenLimit(finishReason?: string): boolean {
  if (typeof finishReason !== 'string' || !finishReason.trim()) return false;
  const lo = finishReason.trim().toLowerCase().replace(/-/g, '_');
  if (lo === 'length' || lo === 'max_tokens' || lo === 'max_output_tokens') return true;
  if (lo.includes('max_tokens') || lo.includes('length_limit')) return true;
  return false;
}

/**
 * Parallel per-section generation (middle-out harness): one OpenRouter stream per blueprint agent in its own
 * Web Worker (when available), then stitch. Outline titles are task-specific (from blueprint only).
 */
export async function generateMarkdownContentHarnessed(
  blueprint: { title?: string; purpose?: string; agents: AgentConfig[] },
  row: CSVRow,
  keywordData: KeywordData,
  knowledgeFiles: Array<{ name: string; content: string }>,
  activeKnowledgeBaseText: string,
  options: BulkProcessingOptions,
  harnessRowIndex: number,
  connectedSite?: { name: string; siteUrl: string },
  wordPressPosts?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>,
  siteSummary?: string,
  semrushKeywordsContext?: string,
  semrushScatterContext?: string,
  semrushExternalUrls?: string[],
  promptEnv?: HarnessPromptEnv,
): Promise<string> {
  void knowledgeFiles;
  void activeKnowledgeBaseText;
  const { buildSystemPrompt, buildBulkHarnessSectionUserPrompt, generateSingleSectionPrompt } =
    await import('../prompt-builders');
  const knowledgeBaseContext =
    typeof promptEnv?.knowledgeBaseContext === 'string' && promptEnv.knowledgeBaseContext.trim().length > 0
      ? promptEnv.knowledgeBaseContext.trim()
      : '';

  const rawAgentsForBulk = resolveAgentsForBulk(blueprint);
  if (rawAgentsForBulk.length === 0) {
    throw new Error('Harness: blueprint has no agents to generate');
  }
  const agentsForBulk = ensureBlogHarnessSummaryLast(rawAgentsForBulk, promptEnv?.contentKind);

  const isPressReleaseHarness = promptEnv?.contentKind === "press_release";
  const releaseTopic =
    promptEnv?.primaryKeyword?.trim() || row.keyword?.trim() || row.keyword_focus?.trim() || "";

  const entityFromRow =
    row.entity &&
    row.entity.trim() &&
    row.entity.trim() !== 'N/A'
      ? row.entity.trim()
      : undefined;
  const harnessEntity = promptEnv?.harnessEntity?.trim();
  const entity =
    harnessEntity && harnessEntity !== 'N/A'
      ? harnessEntity
      : entityFromRow;
  const entityWikipediaUrl = row.wikipedia_url?.trim() || undefined;

  const harnessKeyword =
    promptEnv?.primaryKeyword?.trim()
    || row.keyword_focus?.trim()
    || row.keyword?.trim()
    || "";
  const harnessPageCtx = promptEnv?.wordpressSite
    ? resolvePageLocalContext({
        keyword: harnessKeyword,
        site: promptEnv.wordpressSite,
        entity,
      })
    : null;
  const harnessPageLocalBlock =
    harnessPageCtx?.primaryCity ? formatPageLocalContextPromptBlock(harnessPageCtx) : "";

  const acfContext: AIDrivenACFContext =
    promptEnv?.acfContextOverride ??
    ({
      promptModifier: row.prompt_modifier?.trim() || undefined,
      keywordFocus: row.keyword_focus?.trim() || undefined,
      serviceArea: row.service_area_fields?.trim() || undefined,
    } satisfies AIDrivenACFContext);

  const portfolioBlocked = options.portfolioBlockedHosts;

  let systemPrompt = await buildSystemPrompt(
    knowledgeBaseContext,
    options.openRouterApiKey,
    connectedSite,
    wordPressPosts,
    promptEnv?.currentPageUrl,
    entity,
    promptEnv?.siteId,
    promptEnv?.primaryKeyword,
    siteSummary,
    semrushExternalUrls,
    portfolioBlocked,
    promptEnv?.contentKind,
    'harness_section',
    '',
    promptEnv?.llmAuditAuthorityExternalPairs,
    promptEnv?.linkTargetsPlan,
  );


  if (entity && !isPressReleaseHarness) {
    systemPrompt += `\n${formatSapPageWriterBlock(entity)}`;
  }

  const totalBudget = options.maxTokens || 16000;
  const httpReferer = resolveHarnessHttpReferer();
  const harnessFormat = isPressReleaseHarness ? ("markdown" as const) : ("html" as const);

  if (isPressReleaseHarness) {
    const outline = buildBulkHarnessOutlineFromAgents(agentsForBulk);
    const outlineBlock = formatPressReleaseOutlineForHarnessPrompt(outline);
    const n = agentsForBulk.length;
    const perSectionMax = Math.min(1400, Math.max(640, Math.floor(totalBudget / Math.max(n, 1))));
    const totalSections = agentsForBulk.length;

    const pieces = await Promise.all(
      agentsForBulk.map(async (agent, i) => {
        const o = outline[i];
        const titleForCb = pressReleaseHarnessSectionLabel(i);

        options.onHarnessSection?.({
          rowIndex: harnessRowIndex,
          sectionIndex: i,
          totalSections,
          title: titleForCb,
          phase: 'start',
        });

        const singleSectionPrompt = generateSingleSectionPrompt(
          agent,
          harnessFormat,
          promptEnv?.contentKind,
          releaseTopic,
        );
        let userPrompt = buildBulkHarnessSectionUserPrompt(
          blueprint.title || row.title,
          blueprint.purpose || buildFocusedArticlePurpose(keywordData.keyword),
          singleSectionPrompt,
          outlineBlock,
          [],
          i,
          agentsForBulk.length,
          connectedSite,
          entity,
          acfContext,
          !!wordPressPosts?.length,
          promptEnv?.currentPageUrl,
          promptEnv?.gscKeywordsContext,
          semrushKeywordsContext,
          semrushScatterContext,
          semrushExternalUrls,
          portfolioBlocked,
          promptEnv?.contentKind,
          releaseTopic,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          promptEnv?.llmAuditSummary,
          promptEnv?.dfsArticleAuditBlock,
          promptEnv?.firstPartyAuthorityBlock,
          promptEnv?.llmAuditAuthorityExternalPairs,
        );
        const importedTone = getImportedToneFromRow(row);
        if (importedTone) {
          userPrompt += `\n\n${formatImportedToneForHarnessPrompt(importedTone)}`;
        }
        const importedExcerpt = findImportedSectionBody(row, o.displayTitle);
        if (importedExcerpt) {
          userPrompt += `\n\n--- Imported draft excerpt ---\n${importedExcerpt}`;
        }

        const result = await runHarnessOpenRouterSection({
          sectionIndex: i,
          apiKey: options.openRouterApiKey,
          model: options.selectedModel || getProductionModel(),
          messages: injectBlacklistRagIntoMessages([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ]),
          temperature: options.temperature || 1.0,
          maxTokens: perSectionMax,
          topP: options.topP || 0.9,
          httpReferer,
        });

        let sectionContent = (result.content || '').trim();
        if (!sectionContent) {
          sectionContent = `# ${titleForCb}\n\n`;
        }

        if (releaseTopic) {
          sectionContent = await ensurePressReleaseSectionHeading({
            sectionMarkdown: sectionContent,
            topic: releaseTopic,
            headlineHint: blueprint.title || row.title,
            sectionIntent: agent.description ?? "",
            apiKey: options.openRouterApiKey,
            model: options.selectedModel,
          });
        }

        const truncated = isCompletionTruncatedByTokenLimit(result.finishReason);
        if (truncated) {
          console.warn(`[Bulk Harness] Section ${i + 1} may be truncated (finish_reason: ${result.finishReason})`);
        }

        options.onHarnessSection?.({
          rowIndex: harnessRowIndex,
          sectionIndex: i,
          totalSections,
          title: titleForCb,
          phase: 'done',
          markdownSlice: sectionContent,
          truncated,
        });

        return sectionContent;
      }),
    );

    const stitched = stitchHarnessSections(pieces);
    if (!stitched?.trim()) {
      return stripTrailingCopyrightBoilerplate(pieces.filter(Boolean).join("\n\n"));
    }
    return stripTrailingCopyrightBoilerplate(stitched);
  }

  const { bodyAgents, overviewAgent } = splitBlogHarnessBodyAndOverview(agentsForBulk);
  if (!overviewAgent) {
    throw new Error('Harness: missing Overview agent');
  }
  if (bodyAgents.length === 0) {
    throw new Error('Harness: no body sections to generate');
  }

  const answerAgent = buildBlogHarnessAnswerAgent();
  const bodyOutline = buildBulkHarnessOutlineFromAgents(bodyAgents);
  const bodyAnchors = buildHarnessSectionAnchorMap(bodyOutline);
  const publishedSectionTitles = ['Answer', 'Overview', ...bodyOutline.map((x) => x.displayTitle)];
  const totalSections = bodyAgents.length + 2;
  const outlineBlock = formatOutlineTitlesForHarnessPrompt(bodyOutline);

  const harnessTokenSlots = computeHarnessSectionTokenBudgets(
    [
      {
        sectionKey: 'Answer',
        agent: answerAgent,
        isOverview: false,
        isAnswer: true,
      },
      {
        sectionKey: 'Overview',
        agent: overviewAgent,
        isOverview: true,
        bodySectionCount: bodyAgents.length,
      },
      ...bodyAgents.map((agent, bi) => ({
        sectionKey: bodyOutline[bi]!.displayTitle,
        agent,
        isOverview: false,
        isSeoOpener: isHarnessSeoOpenerBodyAgent(agent),
        importedExcerptChars: findImportedSectionBody(row, bodyOutline[bi]!.displayTitle)?.length ?? 0,
      })),
    ],
    totalBudget,
  );
  assertHarnessTokenBudgetPreflight(harnessTokenSlots, totalBudget, totalSections);
  const harnessTokenBySectionKey = new Map(
    harnessTokenSlots.map((slot) => [slot.sectionKey, slot.maxTokens]),
  );

  const harnessPrimaryKeyword =
    promptEnv?.primaryKeyword?.trim()
    || row.keyword_focus?.trim()
    || row.keyword?.trim()
    || keywordData.keyword?.trim()
    || "";

  let cachedIllustrativePersonaBlock: string | null = null;
  let cachedOverviewPersonaTeaser: string | null = null;

  const ensureIllustrativePersonaCached = async (answerSectionHtml?: string): Promise<void> => {
    if (cachedIllustrativePersonaBlock) return;
    if (!bodyAgents.some(agentHasIllustrativeFeature)) return;
    const companyName = connectedSite?.name?.trim();
    if (!companyName) {
      throw new Error("Harness: [ILLUSTRATIVE] requires a connected site name");
    }
    const illustrativeAgentIndex = bodyAgents.findIndex(agentHasIllustrativeFeature);
    const illustrativeTitle =
      illustrativeAgentIndex >= 0
        ? bodyOutline[illustrativeAgentIndex]!.displayTitle
        : resolveIllustrativeH2Title("");
    const brief = acfContext?.seoResearch?.trim()
      ? parseSeoResearchBrief(acfContext.seoResearch)
      : null;
    const researchAsOf =
      brief?.queryFanout?.researchAsOf?.trim() || formatResearchAsOfLabel(new Date());
    const pageCtx = resolvePageLocalContext({
      keyword: harnessPrimaryKeyword,
      site: promptEnv?.wordpressSite,
      entity,
    });
    const location =
      pageCtx.prosePlaceLabel
      || pageCtx.primaryCity
      || entity?.trim()
      || acfContext?.serviceArea?.trim()
      || resolveSiteLocationLabel(promptEnv?.wordpressSite, harnessPrimaryKeyword)
      || "";
    const researchTopic = pageCtx.serviceTopic || harnessPrimaryKeyword;
    const illustrativeExampleQuery =
      brief?.queryFanout?.illustrativeExampleQuery?.trim()
      || buildIllustrativeExampleResearchQuery({
        topic: researchTopic,
        location: location || researchTopic,
        asOfLabel: researchAsOf,
      });
    const persona: IllustrativeExample = await extractIllustrativeExample({
      keyword: harnessPrimaryKeyword,
      location,
      researchAsOf,
      companyName,
      illustrativeExampleQuery,
      pageUrl: promptEnv?.currentPageUrl,
      entity,
      serpByQuery: brief?.queryFanout?.serpByQuery,
      chatGptByQuery: brief?.queryFanout?.chatGptByQuery,
      illustrativeH2Title: resolveIllustrativeH2Title(illustrativeTitle),
      pageTitle: blueprint.title || row.title,
      siteId: promptEnv?.siteId,
      site: promptEnv?.wordpressSite,
      pageLocalContext: pageCtx,
      answerSectionHtml,
    });
    cachedIllustrativePersonaBlock = [
      formatPageLocalContextPromptBlock(pageCtx),
      formatIllustrativePersonaPromptBlock(persona, researchAsOf),
    ].join("\n\n");
    cachedOverviewPersonaTeaser = formatOverviewPersonaTeaserBlock(persona.personaName ?? "");
  };

  const runBlogHarnessSection = async (
    agent: AgentConfig,
    sectionIndex: number,
    titleForCb: string,
    opts: {
      maxTokens: number;
      isOverviewSection: boolean;
      isAnswerSection?: boolean;
      inPageAnchorBlock?: string;
      publishedPlanIndex: number;
      otherSectionTitles: string[];
      /** Published Answer HTML — grounds later sections so they do not recap; illustrative also uses economic ceiling. */
      answerSectionHtml?: string;
    },
  ): Promise<string> => {
    options.onHarnessSection?.({
      rowIndex: harnessRowIndex,
      sectionIndex,
      totalSections,
      title: titleForCb,
      phase: 'start',
    });

    const singleSectionPrompt = generateSingleSectionPrompt(
      agent,
      harnessFormat,
      promptEnv?.contentKind,
      releaseTopic,
      harnessPrimaryKeyword || undefined,
    );
    let illustrativePersonaBlock = "";
    if (agentHasIllustrativeFeature(agent)) {
      if (!cachedIllustrativePersonaBlock) {
        throw new Error("Harness: illustrative persona must be pre-extracted before [ILLUSTRATIVE] section");
      }
      illustrativePersonaBlock = cachedIllustrativePersonaBlock;
    }
    let userPrompt = buildBulkHarnessSectionUserPrompt(
      blueprint.title || row.title,
      blueprint.purpose || buildFocusedArticlePurpose(keywordData.keyword),
      singleSectionPrompt,
      outlineBlock,
      opts.otherSectionTitles,
      opts.publishedPlanIndex,
      totalSections,
      connectedSite,
      entity,
      acfContext,
      !!wordPressPosts?.length,
      promptEnv?.currentPageUrl,
      promptEnv?.gscKeywordsContext,
      semrushKeywordsContext,
      semrushScatterContext,
      semrushExternalUrls,
      portfolioBlocked,
      promptEnv?.contentKind,
      releaseTopic,
      opts.inPageAnchorBlock,
      opts.isOverviewSection && entity && entityWikipediaUrl ? entityWikipediaUrl : undefined,
      opts.isOverviewSection || opts.isAnswerSection ? undefined : titleForCb,
      promptEnv?.primaryKeyword?.trim() || row.keyword_focus?.trim() || row.keyword?.trim() || undefined,
      publishedSectionTitles,
      promptEnv?.llmAuditSummary,
      promptEnv?.dfsArticleAuditBlock,
      promptEnv?.firstPartyAuthorityBlock,
      formatAnswerGroundingForIllustrativePromptBlock(
        opts.isAnswerSection ? undefined : opts.answerSectionHtml,
      ),
      promptEnv?.llmAuditAuthorityExternalPairs,
    );
    if (harnessPageLocalBlock) {
      userPrompt += `\n\n${harnessPageLocalBlock}`;
    }
    if (illustrativePersonaBlock) {
      userPrompt += `\n\n${illustrativePersonaBlock}`;
    }
    if (opts.isOverviewSection && cachedOverviewPersonaTeaser) {
      userPrompt += `\n\n${cachedOverviewPersonaTeaser}`;
    }
    if (opts.isOverviewSection && entity && entityWikipediaUrl) {
      const wikiBlock = formatMandatoryEntityWikipediaForPrompt({
        entity,
        wikipediaUrl: entityWikipediaUrl,
        wikipediaTitle: row.wikipedia_title?.trim() || undefined,
      });
      if (wikiBlock) {
        userPrompt += `\n\n${wikiBlock}`;
      }
    }
    const importedTone = getImportedToneFromRow(row);
    if (importedTone) {
      userPrompt += `\n\n${formatImportedToneForHarnessPrompt(importedTone)}`;
    }
    if (!opts.isOverviewSection && !opts.isAnswerSection) {
      const importedExcerpt = findImportedSectionBody(row, titleForCb);
      if (importedExcerpt) {
        userPrompt += `\n\n--- Imported draft excerpt (use facts from this excerpt only for this assigned section; do NOT copy headings, lists, or paragraphs belonging to other sections; output only the assigned ## block) ---\n${importedExcerpt}`;
      }
    }

    const isIllustrative = agentHasIllustrativeFeature(agent);
    let truncated = false;

    for (let attempt = 1; attempt <= HARNESS_SECTION_MAX_ATTEMPTS; attempt++) {
      const attemptMaxTokens = Math.round(opts.maxTokens * (1 + (attempt - 1) * 0.15));
      const result = await runHarnessOpenRouterSection({
        sectionIndex,
        apiKey: options.openRouterApiKey,
        model: options.selectedModel || getProductionModel(),
        messages: injectBlacklistRagIntoMessages([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]),
        temperature: options.temperature || 1.0,
        maxTokens: attemptMaxTokens,
        topP: options.topP || 0.9,
        httpReferer,
      });

      const sectionContent = (result.content || '').trim();
      if (!sectionContent) {
        continue;
      }
      truncated = isCompletionTruncatedByTokenLimit(result.finishReason);

      const prepared = prepareHarnessSectionHtml(sectionContent, {
        title: titleForCb,
        isOverview: opts.isOverviewSection,
        isAnswer: opts.isAnswerSection,
        isIllustrative,
      });
      if (!harnessSectionPreparedValid(prepared, { isIllustrative })) {
      continue;
    }

    options.onHarnessSection?.({
      rowIndex: harnessRowIndex,
      sectionIndex,
      totalSections,
      title: titleForCb,
      phase: 'done',
      markdownSlice: prepared,
      truncated,
    });

    return prepared;
  }

  const sectionLabel = opts.isAnswerSection
      ? "Answer"
      : opts.isOverviewSection
        ? "Overview"
        : isIllustrative
          ? "[ILLUSTRATIVE]"
          : titleForCb;
    throw new Error(`Harness: section "${sectionLabel}" could not be generated after ${HARNESS_SECTION_MAX_ATTEMPTS} attempts`);
  };

  if (options.sequentialHarnessSections) {
    const overviewInPageAnchorBlock = formatHarnessInPageAnchorBlock(bodyAnchors, { contextOnly: true });
    const answerMaxTokens = harnessTokenBySectionKey.get("Answer");
    if (answerMaxTokens == null) {
      throw new Error("Harness: missing token budget for Answer");
    }
    const overviewMaxTokens = harnessTokenBySectionKey.get("Overview");
    if (overviewMaxTokens == null) {
      throw new Error("Harness: missing token budget for Overview");
    }
    const sequentialPieces: string[] = [
      await runBlogHarnessSection(answerAgent, 0, "Answer", {
        maxTokens: answerMaxTokens,
        isOverviewSection: false,
        isAnswerSection: true,
        publishedPlanIndex: 0,
        otherSectionTitles: ["Overview", ...bodyOutline.map((x) => x.displayTitle)],
      }),
    ];
    const answerMd = sequentialPieces[0] ?? "";
    await ensureIllustrativePersonaCached(answerMd);
    sequentialPieces.push(
      await runBlogHarnessSection(overviewAgent, 1, "Overview", {
        maxTokens: overviewMaxTokens,
        isOverviewSection: true,
        inPageAnchorBlock: overviewInPageAnchorBlock,
        publishedPlanIndex: 1,
        otherSectionTitles: bodyOutline.map((x) => x.displayTitle),
        answerSectionHtml: answerMd,
      }),
    );
    for (let bi = 0; bi < bodyAgents.length; bi++) {
      const agent = bodyAgents[bi]!;
      const o = bodyOutline[bi]!;
      const titleForCb = o.displayTitle;
      const otherSectionTitles = bodyOutline.filter((_, j) => j !== bi).map((x) => x.displayTitle);
      const maxTokens = harnessTokenBySectionKey.get(titleForCb);
      if (maxTokens == null) {
        throw new Error(`Harness: missing token budget for section "${titleForCb}"`);
      }
      sequentialPieces.push(
        await runBlogHarnessSection(agent, bi + 2, titleForCb, {
          maxTokens,
          isOverviewSection: false,
          publishedPlanIndex: bi + 2,
          otherSectionTitles,
          answerSectionHtml: answerMd,
        }),
      );
    }
    const requireIllustrative = bodyAgents.some(agentHasIllustrativeFeature);
    let sequentialHtml = stripTrailingCopyrightBoilerplate(stitchHarnessSections(sequentialPieces));

    for (let repair = 0; repair < HARNESS_SECTION_MAX_ATTEMPTS; repair++) {
      if (stitchedHarnessArticleValid(sequentialHtml, { requireIllustrative })) {
        break;
      }
      const currentAnswer = sequentialPieces[0] ?? "";
      if (!stitchedArticleHasAnswerH2(sequentialHtml)) {
        sequentialPieces[0] = await runBlogHarnessSection(answerAgent, 0, "Answer", {
          maxTokens: answerMaxTokens,
          isOverviewSection: false,
          isAnswerSection: true,
          publishedPlanIndex: 0,
          otherSectionTitles: ["Overview", ...bodyOutline.map((x) => x.displayTitle)],
        });
      }
      const repairedAnswer = sequentialPieces[0] ?? currentAnswer;
      const hasOverview =
        /<h2\b[^>]*>\s*overview\s*</i.test(sequentialHtml)
        || /\bid\s*=\s*["']overview["']/i.test(sequentialHtml);
      if (!hasOverview) {
        sequentialPieces[1] = await runBlogHarnessSection(overviewAgent, 1, "Overview", {
          maxTokens: overviewMaxTokens,
          isOverviewSection: true,
          inPageAnchorBlock: overviewInPageAnchorBlock,
          publishedPlanIndex: 1,
          otherSectionTitles: bodyOutline.map((x) => x.displayTitle),
          answerSectionHtml: repairedAnswer,
        });
      }
      if (requireIllustrative) {
        const illustrativeIndex = bodyAgents.findIndex(agentHasIllustrativeFeature);
        if (illustrativeIndex >= 0) {
          const pieceIndex = illustrativeIndex + 2;
          const illustrativePiece = sequentialPieces[pieceIndex] ?? "";
          if (!illustrativeHarnessSectionValid(illustrativePiece)) {
            const agent = bodyAgents[illustrativeIndex]!;
            const o = bodyOutline[illustrativeIndex]!;
            const titleForCb = o.displayTitle;
            const maxTokens = harnessTokenBySectionKey.get(titleForCb);
            if (maxTokens == null) {
              throw new Error(`Harness: missing token budget for section "${titleForCb}"`);
            }
            sequentialPieces[pieceIndex] = await runBlogHarnessSection(agent, pieceIndex, titleForCb, {
              maxTokens,
              isOverviewSection: false,
              publishedPlanIndex: pieceIndex,
              otherSectionTitles: bodyOutline.filter((_, j) => j !== illustrativeIndex).map((x) => x.displayTitle),
              answerSectionHtml: repairedAnswer,
            });
          }
        }
      }
      sequentialHtml = stripTrailingCopyrightBoilerplate(stitchHarnessSections(sequentialPieces));
    }
    return sequentialHtml;
  }

  const overviewInPageAnchorBlock = formatHarnessInPageAnchorBlock(bodyAnchors, { contextOnly: true });
  const answerMaxTokens = harnessTokenBySectionKey.get('Answer');
  if (answerMaxTokens == null) {
    throw new Error('Harness: missing token budget for Answer');
  }
  const overviewMaxTokens = harnessTokenBySectionKey.get('Overview');
  if (overviewMaxTokens == null) {
    throw new Error('Harness: missing token budget for Overview');
  }
  const answerMd = await runBlogHarnessSection(answerAgent, 0, 'Answer', {
    maxTokens: answerMaxTokens,
    isOverviewSection: false,
    isAnswerSection: true,
    publishedPlanIndex: 0,
    otherSectionTitles: ['Overview', ...bodyOutline.map((x) => x.displayTitle)],
  });

  await ensureIllustrativePersonaCached(answerMd);

  const [overviewMd, ...bodyPieces] = await Promise.all([
    runBlogHarnessSection(overviewAgent, 1, 'Overview', {
      maxTokens: overviewMaxTokens,
      isOverviewSection: true,
      inPageAnchorBlock: overviewInPageAnchorBlock,
      publishedPlanIndex: 1,
      otherSectionTitles: bodyOutline.map((x) => x.displayTitle),
      answerSectionHtml: answerMd,
    }),
    ...bodyAgents.map(async (agent, bi) => {
      const o = bodyOutline[bi];
      const titleForCb = o.displayTitle;
      const otherSectionTitles = bodyOutline.filter((_, j) => j !== bi).map((x) => x.displayTitle);
      const maxTokens = harnessTokenBySectionKey.get(titleForCb);
      if (maxTokens == null) {
        throw new Error(`Harness: missing token budget for section "${titleForCb}"`);
      }
      return runBlogHarnessSection(agent, bi + 2, titleForCb, {
        maxTokens,
        isOverviewSection: false,
        publishedPlanIndex: bi + 2,
        otherSectionTitles,
        answerSectionHtml: answerMd,
      });
    }),
  ]);

  const stitched = stitchHarnessSections([answerMd, overviewMd, ...bodyPieces]);
  if (!stitched?.trim()) {
    throw new Error("Harness: stitched article is empty");
  }
  const html = stripTrailingCopyrightBoilerplate(stitched);
  const requireIllustrativeParallel = bodyAgents.some(agentHasIllustrativeFeature);
  if (!stitchedHarnessArticleValid(html, { requireIllustrative: requireIllustrativeParallel })) {
    throw new Error(
      "[Bulk Harness] Stitched article missing Answer, Overview, or illustrative scenario after section retries",
    );
  }
  return html;
}

export { stitchHarnessSections } from './bulk-harness-outline';

/**
 * Resolve the English Wikipedia URL for an entity (knowledge file or API check).
 */
export async function resolveEntityWikipediaUrl(
  entity: string | undefined,
  knowledgeFiles: Array<{ name: string; content: string }>,
  /** When set (e.g. from Local analysis), skip lookup and use this URL. */
  preResolvedUrl?: string
): Promise<string | undefined> {
  if (preResolvedUrl?.trim()) return preResolvedUrl.trim();
  if (!entity?.trim()) return undefined;
  const rowEntity = entity.trim();
  const wikipediaFile = knowledgeFiles.find(
    (file) =>
      file.name.toLowerCase().includes('wikipedia') &&
      file.name.toLowerCase().includes(rowEntity.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_'))
  );
  let wikipediaUrl: string | undefined;
  if (wikipediaFile) {
    const urlMatch = wikipediaFile.content.match(/https?:\/\/en\.wikipedia\.org\/wiki\/[^\s,]+/);
    if (urlMatch) {
      wikipediaUrl = urlMatch[0];
    }
  }
  if (!wikipediaUrl) {
    const { resolveEntityWikipediaMediaWiki } = await import("../wikipedia/resolve-entity-wikipedia-mediawiki");
    const hit = await resolveEntityWikipediaMediaWiki(rowEntity);
    if (hit?.url) {
      wikipediaUrl = hit.url;
    }
  }
  return wikipediaUrl;
}

function wikiTitleFromEnUrl(url: string): string {
  try {
    const seg = new URL(url).pathname.split("/").pop() ?? "";
    return decodeURIComponent(seg.replace(/_/g, " ")).trim();
  } catch {
    return "";
  }
}

/**
 * Add entity Wikipedia links to markdown content
 */
export async function addEntityLinksToContent(
  markdownContent: string,
  row: { entity?: string; wikipedia_url?: string; wikipedia_title?: string },
  rowIndex: number,
  knowledgeFiles: Array<{ name: string; content: string }>,
  options: BulkProcessingOptions,
  onProgress?: (rowIndex: number, totalRows: number, status: string) => void
): Promise<string> {
  if (!options.useEntitySitemapTemplate) {
    return markdownContent;
  }
  // Add entity Wikipedia link and local links if entity exists
  if (row.entity && row.entity.trim()) {
    try {
      let localLinks: Array<{ text: string; url: string }> = [];
      let wikipediaUrl = row.wikipedia_url?.trim();
      let wikiPageTitle = row.wikipedia_title?.trim();

      if (!wikipediaUrl) {
        wikipediaUrl = await resolveEntityWikipediaUrl(
          row.entity,
          knowledgeFiles,
          row.wikipedia_url,
        );
      }
      if (wikipediaUrl && !wikiPageTitle) {
        wikiPageTitle = wikiTitleFromEnUrl(wikipediaUrl) || row.entity.trim();
      }

      if (!wikipediaUrl || !wikiPageTitle) {
        onProgress?.(
          rowIndex,
          0,
          `No Wikipedia link for "${row.entity.trim()}" - continuing without entity wiki links`,
        );
        return markdownContent;
      }

      // Extract local links from Wikipedia content using Wikipedia API
      if (row.entity) {
        try {
          const { getLinksFromWikipediaPage, checkWikipediaPageExists } = await import('../wikipedia-api');
          
          // First verify the entity page exists (use resolved title when Local analysis passed it)
          const entityCheck = await checkWikipediaPageExists(wikiPageTitle);
          if (!entityCheck.exists) {
            console.warn(`[Bulk Generator] Entity "${wikiPageTitle}" does not exist on Wikipedia, skipping link extraction`);
          } else {
            // Get links from the Wikipedia page for the entity (with retry)
            let linkedEntities: string[] = [];
            let retries = 3;
            while (retries > 0) {
              try {
                linkedEntities = await getLinksFromWikipediaPage(wikiPageTitle, { 
                  limit: 100,
                  filterNamespaces: true 
                });
                break; // Success
              } catch (error) {
                retries--;
                if (retries === 0) {
                  console.warn(`[Bulk Generator] Failed to get links from Wikipedia after retries:`, error);
                } else {
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
                }
              }
            }
            
            // Filter and validate entities to get local/related links
            // Prioritize geographic entities (cities, neighborhoods, districts, etc.)
            const geographicKeywords = ['city', 'town', 'neighborhood', 'district', 'county', 'area', 'region', 'beach', 'island', 'park'];
            const relevantEntities = linkedEntities
              .filter(entity => {
                const lower = entity.toLowerCase();
                // Exclude the main entity itself
                if (lower === row.entity!.toLowerCase()) return false;
                // Filter out very short or very long names
                if (entity.length < 3 || entity.length > 50) return false;
                // Prioritize entities that might be geographic (optional - don't filter too strictly)
                return true;
              })
              .slice(0, 10); // Limit to 10 potential links
            
            // Verify and create links for relevant entities (batch check for efficiency)
            const { validateEntitiesExist } = await import('../wikipedia-api');
            const validationResults = await validateEntitiesExist(relevantEntities);
            
            for (const result of validationResults) {
              if (result.exists && result.url) {
                localLinks.push({
                  text: result.entity,
                  url: result.url,
                });
                // Limit to 5 links max
                if (localLinks.length >= 5) break;
              }
            }
          }
        } catch (error) {
          console.warn('[Bulk Generator] Error extracting local links from Wikipedia:', error);
          // Continue without local links - don't fail the entire generation
        }
      }
      
      // Add entity link to content (HTML format so no markdown leaks to WordPress)
      if (wikipediaUrl) {
        const safeUrl = wikipediaUrl.replace(/"/g, '&quot;').replace(/&/g, '&amp;');
        const safeEntity = row.entity.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const entityLink = `<a href="${safeUrl}">${safeEntity}</a>`;
        const entityEscaped = row.entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const entityRegex = new RegExp(`\\b${entityEscaped}\\b`, 'i');

        const linkEntityInFirstTitleLine = (md: string): string =>
          md.replace(/^((?:#+\s+))([^\n]+)/m, (full, prefix, rest) =>
            entityRegex.test(rest) ? prefix + rest.replace(entityRegex, entityLink) : full
          );

        // Find the first paragraph (content before first ## heading, excluding # title)
        const firstParagraphMatch = markdownContent.match(/^(?:#+\s+[^\n]+\n+)?([^#]+?)(?=\n##|\n#\s|$)/s);

        if (firstParagraphMatch) {
          let firstParagraph = firstParagraphMatch[1];
          const entityInParagraph = entityRegex.test(firstParagraph);
          const titleLine = markdownContent.match(/^#+\s+[^\n]+/m)?.[0] ?? '';
          const entityInTitle = titleLine.length > 0 && entityRegex.test(titleLine);
          const trimmedFirst = firstParagraph.trim();

          let applyParagraphReplace = false;

          if (entityInParagraph) {
            firstParagraph = firstParagraph.replace(entityRegex, entityLink);
            applyParagraphReplace = true;
          } else if (trimmedFirst) {
            // Entity not in opener but intro text exists: lead with linked name + em dash (never a line that is only the entity)
            firstParagraph = `${entityLink} - ${trimmedFirst}`;
            applyParagraphReplace = true;
          } else if (entityInTitle) {
            // H1 already names the entity; intro is empty - link the name in the title only (no standalone entity line)
            markdownContent = linkEntityInFirstTitleLine(markdownContent);
          } else if (entityRegex.test(markdownContent)) {
            markdownContent = markdownContent.replace(entityRegex, entityLink);
          }

          if (applyParagraphReplace) {
            markdownContent = markdownContent.replace(
              /^(?:#+\s+[^\n]+\n+)?([^#]+?)(?=\n##|\n#\s|$)/s,
              (match) => {
                const titleMatch = match.match(/^(#+\s+[^\n]+\n+)/);
                return (titleMatch ? titleMatch[1] : '') + firstParagraph;
              }
            );
          }
        } else if (entityRegex.test(markdownContent)) {
          markdownContent = markdownContent.replace(entityRegex, entityLink);
        }
        
        // Local Recommendation / What We Offer H2s come from the SAP blueprint
        // (via blog-template-builder.ts), so we don't need to add it here
        onProgress?.(rowIndex, 0, `Added Wikipedia links for ${row.entity}${localLinks.length > 0 ? ` with ${localLinks.length} knowledge graph entity links` : ''}`);
      }
    } catch (error) {
      console.error('Error adding Wikipedia links:', error);
      onProgress?.(
        rowIndex,
        0,
        `Wikipedia link step failed for "${row.entity?.trim() ?? "entity"}" - continuing without entity wiki links`,
      );
      return markdownContent;
    }
  }

  return markdownContent;
}

