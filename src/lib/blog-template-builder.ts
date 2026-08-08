import { streamChatCompletion, loadApiKey } from "./api";
import type { KeywordData, BlogTemplateChecklist, PeopleAlsoAsk } from "./keyword-types";
import type { AgentConfig } from "@/types/agent-config";
import {
  BULK_WORDPRESS_POST_TITLE_RULE,
  CRITICAL_LINK_RULE,
  NO_FAKE_TESTIMONIALS_RULE,
  TITLE_WELL_KNOWN_ACRONYMS_RULE,
} from "./prompt-builders";
import { getResearchModel } from "./optimization-settings-storage";
import { searchSiteCache, getSiteCache } from "./wordpress-site-cache";
import { getLocalEntityPhraseExamples, getLocalExpertisePhrase, getLocalGeneralPhrase } from "./local-entity-phrases";
import { truncateTitleForSEO } from "./content-generation/content-sanitizer";
import type { CheckedExternalLink } from "./external-research";
import { formatImportedDraftLinksForPrompt, type ImportedDraftLink } from "./bulk/blog-import-draft-links";
import {
  formatModifierExternalLinksForPrompt,
  type ModifierExternalLink,
} from "./bulk/modifier-external-links";
import type { ExternalLinkPair } from "./content-generation/external-link-placeholders";
import { formatMandatoryEntityWikipediaForPrompt } from "./bulk/entity-wikipedia-prompt";
import {
  formatImportedToneForChecklistPrompt,
  type ImportedBlogToneProfile,
} from "@/lib/bulk/blog-import-tone";
import {
  ARTICLE_MAX_WORDS,
  buildArticleLengthChecklistBlock,
  buildBlueprintArticleLengthBlock,
} from "@/lib/content-generation/article-length-policy";
import {
  INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX,
} from "@/lib/content-generation/internal-link-placeholders";
import {
  appendUniversalContentRulesToSystemPrompt,
  enforceForbiddenWordsOnBlueprint,
  sanitizeBlueprintAgentsForPipeline,
  sanitizeForbiddenHeadingTitle,
  sanitizeForbiddenWordsInChecklistItem,
} from "@/lib/content-word-blocklist";
import { isFaqStyleHeadingTitle } from "@/lib/content-generation/faq-heading-policy";
import { parseJsonWithRepair } from "@/lib/json-repair-utility";
import { openRouterWebAppHeaders } from "@/lib/openrouter-attribution";

const LINK_FEATURE_PLACEHOLDER = `[LINK]: ${INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX}`;

/**
 * Converts a keyword to proper/title case
 * Capitalizes the first letter of each word, except for common prepositions/articles
 */
function toProperCase(keyword: string): string {
  if (!keyword) return keyword;
  
  // Words that should remain lowercase (unless at the start)
  const lowercaseWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'near', 'of', 'on', 'or', 'the', 'to', 'with'];
  
  return keyword
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      // Always capitalize first word, or if word is not in lowercase list
      if (index === 0 || !lowercaseWords.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(' ');
}

export interface BlogTemplateContext {
  flowTitle?: string;
  flowPurpose?: string;
  keywordData?: KeywordData;
  userPrompt?: string;
  /** Prefilled CSV fields — use verbatim in blueprint (do not invent title/meta/wiki/slug). */
  prefilledRowContract?: string;
}

/** User-specified or Semrush external link prompt parts for checklist / blueprint */
function buildSemrushExactPromptParts(options: {
  semrushApprovedExternalUrls?: string[];
  semrushAnchorPhrases?: string[];
  userExternalLinks?: ExternalLinkPair[];
  normalizedSiteUrl: string;
}): {
  semrushExactBlock: string;
  hasSemrushExactMode: boolean;
  externalLinksPolicyBlock: string;
  linksBulletExternal: string;
  externalCompetitorBlock: string;
} {
  const userLinks = (options.userExternalLinks ?? []).filter(
    (link) => link.url.trim() && link.anchor.trim(),
  );
  const semrushUrlList =
    userLinks.length > 0
      ? userLinks.map((link) => link.url.trim())
      : (options.semrushApprovedExternalUrls ?? [])
          .map((u) => String(u).trim())
          .filter(Boolean)
          .slice(0, 80);
  const semrushAnchorList =
    userLinks.length > 0
      ? userLinks.map((link) => link.anchor.trim())
      : (options.semrushAnchorPhrases ?? [])
          .map((a) => String(a).trim())
          .filter(Boolean)
          .slice(0, 150);
  const hasSemrushExactMode = semrushUrlList.length > 0 && semrushAnchorList.length > 0;
  const siteRef = options.normalizedSiteUrl || "the target website";

  const semrushExactBlock = hasSemrushExactMode
    ? `
=== SEMRUSH - CONTENT OPTIMIZATION (EXACT URL + ANCHOR LOCK) ===
**HREF**: Copy URLs below character-for-character for every third-party external link. No edits to scheme, host, path, or query.
**ANCHOR**: For each Semrush external link, anchor text MUST be copied EXACTLY from the anchor phrase list below (verbatim spelling, spacing, casing). Use the full phrase even if longer than 5 words. For internal links, keep anchors short (2-5 words) as usual.
**SEMRUSH - APPROVED EXTERNAL URLs**
${semrushUrlList.map((u, i) => `${i + 1}. ${u}`).join("\n") || "(none)"}
**SEMRUSH - APPROVED ANCHOR PHRASES (KEYWORDS)**
${semrushAnchorList.map((a, i) => `${i + 1}. ${a}`).join("\n") || "(none)"}

**CHECKLIST / BLUEPRINT - NO HALLUCINATED EXTERNAL URLS (NON-NEGOTIABLE)**:
- Do NOT type, guess, paraphrase, or invent any third-party https:// URL in checklist or blueprint output unless it is **copied character-for-character** from the numbered **SEMRUSH - APPROVED EXTERNAL URLs** list above (same string, including scheme and path).
- **FORBIDDEN**: placeholder domains, "e.g." external URLs, competitor sites not in the list, nytimes.com/hunterdouglas.com or any domain unless that **exact** URL string appears in the list above.
- **ALLOWED**: (1) Paste the full URL verbatim from the list into a checklist item; OR (2) Reference by index only, e.g. "[EXTERNAL_SEMRUSH]: use SEMRUSH approved URL #2 and anchor phrase #2 from the lists above" - **without writing a URL string you did not copy from the list**.
- Anchor phrases in checklists: same rule - only verbatim copies from **SEMRUSH - APPROVED ANCHOR PHRASES**, or reference by index; never invent anchor text for external sites.
- Feature tag form (when listing concrete pairs): "[EXTERNAL_SEMRUSH]: href=<paste exact URL from list> | anchor=<paste exact phrase from list>" - both sides must be **lifted from the lists**, not improvised. Section body must insert **[[EXTERNAL:exact-url|exact-anchor]]** (same pair) woven mid-sentence — never <a href> for third-party URLs.

=== END SEMRUSH EXACT ===
`
    : "";

  const externalLinksPolicyBlock = hasSemrushExactMode
    ? `**EXTERNAL LINKS - SEMRUSH APPROVED + ENTITY WIKIPEDIA**:
- Third-party links: ONLY URLs from the "SEMRUSH - APPROVED EXTERNAL URLs" section above (exact href). Anchor text: ONLY exact strings from the "SEMRUSH - APPROVED ANCHOR PHRASES" section above.
- When an entity exists, you may also link to its Wikipedia page when provided in context above.
- Do NOT link to any other external domain. Do NOT invent or hallucinate URLs.
- NEVER create "External Resources" sections for random sites.
- **ABSOLUTELY FORBIDDEN: example.com** - NEVER use example.com, example.org, or any placeholder domain.
- Internal links to ${siteRef} are REQUIRED (3-5 per section) from the WordPress posts list.
- **CHECKLIST (CRITICAL)**: Every numbered checklist item MUST require BOTH internal links AND at least one Semrush external citation - never output items that only say "internal links" or "WordPress URLs only". Use the tags **[LINK]** (internal) and **[EXTERNAL_SEMRUSH]** (outbound) in each item.
- **NEVER hallucinate external URLs in the checklist**: Any third-party URL shown in a checklist item must be copied verbatim from **SEMRUSH - APPROVED EXTERNAL URLs** above, or omit the URL string and only reference "URL #N from Semrush list".
- **Tone**: In blueprint/checklist instructions, describe Semrush links as **neutral reference / knowledge-base** citations only - not as retail recommendations, "where to buy", or "where not to buy".`
    : `**EXTERNAL LINKS - WIKIPEDIA ONLY**:
- The ONLY allowed external link is the entity's Wikipedia page (when an entity exists).
- NO other external sites. Do NOT invent, hallucinate, or fabricate any external URL.
- NEVER create "External Resources" sections.
- NEVER link to competitors, manufacturers, or any other external domain.
- **ABSOLUTELY FORBIDDEN: example.com** - NEVER use example.com, example.org, or any placeholder domain.
- Internal links to ${siteRef} are REQUIRED (3-5 per section).`;

  const linksBulletExternal = hasSemrushExactMode
    ? `- Every section MUST specify BOTH:
  - **${LINK_FEATURE_PLACEHOLDER}**
  - **[EXTERNAL_SEMRUSH]: at least 1 outbound citation** - href MUST be the **exact string** from a line in "SEMRUSH - APPROVED EXTERNAL URLs" above (copy-paste only), OR say "SEMRUSH URL #N and anchor #N" without typing a URL you did not copy from that list. Anchor: exact phrase from "SEMRUSH - APPROVED ANCHOR PHRASES" only.
- **Spread outbound links**: include **[EXTERNAL_SEMRUSH]** in the majority of H2 sections (at least half the checklist items, or 6+ items when the checklist is long). Rotate different **numbered** Semrush URLs across sections - do not cite only one external domain in the whole article.
- Internal links: WordPress posts ONLY. Third-party externals: Semrush lists ONLY (plus entity Wikipedia when provided in context). **Never fabricate or example third-party URLs.**`
    : `- Every section: "${LINK_FEATURE_PLACEHOLDER}"
- Internal links come from WordPress posts ONLY. External links come ONLY from the pre-validated AI Mode research list above (if provided).`;

  const externalCompetitorBlock = `**CRITICAL - NEVER MENTION EXTERNAL SITES OR COMPETITORS**:
- **NEVER create H2 or H3 headings that mention external websites** (e.g., "Topic - Houzz", "Topic - Reddit", "Topic - Pinterest", "According to [Site Name]")
- **NEVER create dedicated sections about external platforms** like Houzz, Reddit, Pinterest, Yelp, Amazon, or any third-party website
- **NEVER mention competitor business names** in headings or as focal points of sections
- **NEVER reference people's names** (bloggers, influencers, experts from other sites) in headings or dedicated content
- The blog is ONLY about the target site's products/services - external citations are brief supporting links only; do not promote third-party sites as the main topic
- If research mentions external sources, do NOT create sections dedicated to what those external sites say
${
  hasSemrushExactMode
    ? `- Third-party external links: ONLY Semrush-approved URLs from the "SEMRUSH - APPROVED EXTERNAL URLs" block above (exact href) with anchor text copied EXACTLY from the "SEMRUSH - APPROVED ANCHOR PHRASES" block. You may also use the entity Wikipedia link when provided in context above. Do NOT link to any other external domain.
- Semrush external links may be used for authority in body copy but NEVER as the topic of an H2 or H3 heading`
    : `- ONLY Wikipedia links are allowed as external links - NO OTHER EXTERNAL SITES (pfwbs.org, cpsc.gov, nbcnews.com, windowcoverings.org, manufacturers, etc. are FORBIDDEN)
- External links (Wikipedia only) can be used for authority but NEVER as the topic of a heading or section`
}
- Focus ONLY on the target site's expertise, products, services, and value proposition
- Example of FORBIDDEN headings: "What Houzz Says About...", "Topic - Reddit Community", "According to [Competitor]..."
- Example of ALLOWED headings: "Types of Window Treatments", "Benefits of Professional Installation", "How to Choose the Right Blinds"
- **SEO HEADING HIERARCHY**: H2 = main sections. H3 = subsections under H2. H4 = sub-subsections. NEVER use H3 for main sections. NEVER flatten everything to H3. Each heading = one short phrase (3-10 words).
${NO_FAKE_TESTIMONIALS_RULE}`;

  return {
    semrushExactBlock,
    hasSemrushExactMode,
    externalLinksPolicyBlock,
    linksBulletExternal,
    externalCompetitorBlock,
  };
}

/**
 * Uses AI to analyze and select the best PAA questions for FAQ section relative to target site/entity
 */
async function selectBestPAAQuestionsWithAI(
  allPaaQuestions: Array<{ question: string; answer?: string; url?: string }>,
  entity?: string,
  primaryKeyword?: string,
  postTitle?: string,
  connectedSite?: { name: string; siteUrl: string },
  apiKey?: string,
  model?: string,
  temperature?: number,
  maxTokens?: number,
  topP?: number
): Promise<Array<{ question: string; answer?: string; url?: string }>> {
  // If no API key or fewer than 10 questions, return all (no need for AI analysis)
  if (!apiKey || allPaaQuestions.length <= 10) {
    return allPaaQuestions.slice(0, 10);
  }

  try {
    const siteContext = connectedSite 
      ? `Target Site: ${connectedSite.name} (${connectedSite.siteUrl})`
      : '';
    const entityContext = entity ? `Target Entity: ${entity}` : '';
    const keywordContext = primaryKeyword ? `Primary Keyword: ${primaryKeyword}` : '';
    const titleContext = postTitle ? `Post Title: ${postTitle}` : '';

    const systemPrompt = `You are an SEO expert analyzing People Also Ask (PAA) questions to select the BEST ones for an FAQ section that will appear on a specific website.

Your task is to rank and select up to 10 questions that are:
1. **MOST ALIGNED WITH THE POST TITLE** - This is CRITICAL. Questions must directly relate to the main topic of the post title
2. Most relevant to the target entity/site context
3. Most valuable for users searching for information about the entity/topic
4. Most likely to convert visitors into customers or engage them with the content
5. Best suited for a customer-service oriented FAQ section
6. Relevant to the primary keyword and search intent

Consider:
- **TITLE ALIGNMENT IS THE #1 PRIORITY** - If a question is not directly related to the post title's main topic, exclude it
- Questions directly related to the entity/topic AND the post title are highest priority
- Questions that showcase services, products, or location relevance are valuable
- Questions that demonstrate expertise and authority are important
- Questions about pricing, services, locations, comparisons, or practical information rank higher
- Generic or off-topic questions should be DEPRIORITIZED - especially if they don't align with the post title
- If a question is about a completely different topic than the post title, DO NOT include it

Return a JSON object with a "questions" field containing an array of question texts (strings) in order of best to least best, maximum 10 questions.

Example format:
{
  "questions": ["Question 1 text", "Question 2 text", "Question 3 text", ...]
}`;

    const questionsList = allPaaQuestions.map((paa, idx) => 
      `${idx + 1}. "${paa.question}"${paa.answer ? ` (Answer context: ${paa.answer.substring(0, 150)}...)` : ''}`
    ).join('\n');

    const userPrompt = `Analyze these ${allPaaQuestions.length} PAA questions and select the BEST ones for an FAQ section.

${siteContext ? `${siteContext}\n` : ''}${entityContext ? `${entityContext}\n` : ''}${keywordContext ? `${keywordContext}\n` : ''}${titleContext ? `${titleContext}\n` : ''}

**CRITICAL: TITLE ALIGNMENT CHECK**
${postTitle ? `Before selecting ANY question, ask yourself: "Is this question directly aligned with the post title: '${postTitle}'?"\n- If NO, exclude it immediately\n- Only select questions that clearly relate to the main topic in the post title\n` : ''}

Available PAA Questions:
${questionsList}

Select the BEST up to 10 questions that:
1. **ARE DIRECTLY ALIGNED WITH THE POST TITLE** ${postTitle ? `("${postTitle}")` : ''}
2. Are most relevant to ${entity || primaryKeyword || 'the target site'}
3. Are most valuable for the FAQ section

MANDATORY EXCLUSIONS - NEVER include questions that:
- Are NOT in English (no Spanish, French, or any other language - ENGLISH ONLY)
- Contain any person's name (first name, last name, or full name) - generic product/service questions ONLY

Return a JSON object with this exact format:
{
  "questions": ["Question 1 text", "Question 2 text", "Question 3 text", ...]
}

The questions array should contain the question texts in order from best to least best, maximum 10 questions.
DO NOT include explanations, numbering, or any other text. ONLY return the JSON object.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: openRouterWebAppHeaders(apiKey),
      body: JSON.stringify({
        model: model || "google/gemini-2.0-flash-exp",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 2000,
        top_p: topP ?? 0.9,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.warn('[PAA Selection] AI analysis failed, using fallback selection');
      return allPaaQuestions.slice(0, 10);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.warn('[PAA Selection] No content in AI response, using fallback selection');
      return allPaaQuestions.slice(0, 10);
    }

    // Parse the JSON response
    let selectedQuestions: string[] = [];
    try {
      const parsed = JSON.parse(content);
      // Handle both {questions: [...]} and direct array formats
      if (Array.isArray(parsed)) {
        selectedQuestions = parsed;
      } else if (parsed.questions && Array.isArray(parsed.questions)) {
        selectedQuestions = parsed.questions;
      } else if (parsed.selectedQuestions && Array.isArray(parsed.selectedQuestions)) {
        selectedQuestions = parsed.selectedQuestions;
      } else {
        // Try to find any array in the response
        const values = Object.values(parsed);
        const arrayValue = values.find(v => Array.isArray(v));
        if (arrayValue) {
          selectedQuestions = arrayValue as string[];
        }
      }
    } catch (parseError) {
      console.warn('[PAA Selection] Failed to parse AI response, trying to extract array from text:', parseError);
      // Fallback: try to extract JSON array from text
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        try {
          selectedQuestions = JSON.parse(jsonMatch[0]);
        } catch {
          console.warn('[PAA Selection] Could not parse extracted JSON, using fallback selection');
          return allPaaQuestions.slice(0, 10);
        }
      } else {
        console.warn('[PAA Selection] No JSON array found in response, using fallback selection');
        return allPaaQuestions.slice(0, 10);
      }
    }

    // Map selected questions back to full PAA objects
    const selectedPaaQuestions: Array<{ question: string; answer?: string; url?: string }> = [];
    const questionMap = new Map(
      allPaaQuestions.map(paa => [paa.question.toLowerCase().trim(), paa])
    );

    for (const selectedQuestion of selectedQuestions.slice(0, 10)) {
      const normalized = selectedQuestion.toLowerCase().trim();
      const match = questionMap.get(normalized) || 
        Array.from(questionMap.values()).find(paa => 
          paa.question.toLowerCase().trim().includes(normalized) ||
          normalized.includes(paa.question.toLowerCase().trim())
        );
      
      if (match && !selectedPaaQuestions.find(p => p.question.toLowerCase().trim() === match.question.toLowerCase().trim())) {
        selectedPaaQuestions.push(match);
      }
    }

    // If AI didn't select enough, fill with remaining questions in original order
    if (selectedPaaQuestions.length < 10) {
      const remaining = allPaaQuestions.filter(paa => 
        !selectedPaaQuestions.find(selected => selected.question.toLowerCase().trim() === paa.question.toLowerCase().trim())
      );
      selectedPaaQuestions.push(...remaining.slice(0, 10 - selectedPaaQuestions.length));
    }

    return selectedPaaQuestions.slice(0, 10);
  } catch (error) {
    console.warn('[PAA Selection] Error during AI analysis, using fallback selection:', error);
    return allPaaQuestions.slice(0, 10);
  }
}

/**
 * Builds a system prompt for blog template checklist generation
 */
export const buildBlogTemplateSystemPrompt = (
  flowTitle: string,
  flowPurpose: string,
  keywordData?: KeywordData
): string => {
  const keywordSection = keywordData
    ? `
--- Keyword Context ---
Primary Keyword: ${keywordData.keyword}
Search Volume: ${keywordData.searchVolume?.toLocaleString() || "N/A"}
Difficulty: ${keywordData.difficulty || "N/A"}/100
Intent: ${keywordData.intent || "N/A"}
`
    : "";

  return `You are an expert blog content strategist and blueprint architect. Your role is to analyze user requirements and create a detailed checklist for generating a blog template blueprint.

Flow Context:
- Title: ${flowTitle || "Untitled"}
- Purpose: ${flowPurpose || "Not specified"}
${keywordSection}

Your task is to:
1. Analyze the user's description of their blog template needs
2. Create a focused, actionable checklist (5-6 items) that will guide blueprint generation
3. Each checklist item should specify what section/agent should be included and what it should cover
4. The checklist will be used to generate a blueprint with multiple agents (sections)

CRITICAL FORMAT REQUIREMENT:
Format your response as a numbered list, one item per line. Each item should be a clear, actionable instruction.

Example format:
1. Create an introduction section that hooks the reader and introduces the main topic
2. Add a section covering [specific topic] with examples and practical tips
3. Include a comparison section between [options]
4. Add a conclusion section that summarizes key points and includes a call-to-action

Output ONLY the numbered checklist items, no additional text or explanations.`;
};

/**
 * Builds a user prompt for blog template checklist generation
 */
export const buildBlogTemplateUserPrompt = (
  context: BlogTemplateContext
): string => {
  const parts: string[] = [];

  parts.push("Generate a focused checklist (max 2000-word article) for creating a blog template blueprint based on the following requirements:\n");

  if (context.userPrompt && context.userPrompt.trim()) {
    parts.push(`User Requirements: ${context.userPrompt.trim()}\n`);
  }

  parts.push("\nThe checklist should specify:");
  parts.push("1. What sections/agents should be included in the blog");
  parts.push("2. What content each section should cover");
  parts.push("3. How sections should be structured");
  parts.push("4. Any specific features or requirements for each section");

  parts.push("\nGenerate 5-6 detailed, actionable checklist items that will guide the blueprint generation.");
  parts.push("Each item should be a clear instruction for what to include in the blog template.");

  return parts.join("\n");
};

/**
 * Parses checklist from AI response
 */
export function parseBlogTemplateChecklist(aiResponse: string, keywords: string[] = []): string[] {
  // Extract numbered list items
  const lines = aiResponse.split("\n");
  const checklist: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match numbered list items (1., 2., etc.) or bullet points
    const match = trimmed.match(/^(?:\d+\.|\-|\*)\s+(.+)$/);
    if (match && match[1]) {
      checklist.push(match[1].trim());
    }
  }

  // If no numbered items found, try splitting by lines and filtering
  if (checklist.length === 0) {
    const items = lines
      .map((line) => line.trim())
      .filter((line) => line.length > 10 && !line.startsWith("#"));
    return validateAndEnforceMandatoryElements(items.slice(0, 10)).map(sanitizeForbiddenWordsInChecklistItem);
  }

  return validateAndEnforceMandatoryElements(checklist).map(sanitizeForbiddenWordsInChecklistItem);
}

/**
 * Validates checklist for mandatory content structure elements and adds them if missing
 * MANDATORY: Every blog must have at least 1 TABLE, 1 BULLETED LIST, and 1 NUMBERED LIST
 */
function validateAndEnforceMandatoryElements(checklist: string[]): string[] {
  if (checklist.length === 0) return checklist;
  
  const checklistText = checklist.join('\n').toLowerCase();
  
  // Check for mandatory elements
  const hasTable = checklistText.includes('[table]');
  const hasBulletedList = 
    checklistText.includes('[list]: bullet') || 
    checklistText.includes('[list]:bullet') ||
    checklistText.includes('[list]: unordered') ||
    checklistText.includes('bulleted list');
  const hasNumberedList = 
    checklistText.includes('[list]: number') || 
    checklistText.includes('[list]:number') ||
    checklistText.includes('[list]: ordered') ||
    checklistText.includes('numbered list');
  
  const missingElements: string[] = [];
  if (!hasTable) missingElements.push('TABLE');
  if (!hasBulletedList) missingElements.push('BULLETED LIST');
  if (!hasNumberedList) missingElements.push('NUMBERED LIST');
  
  if (missingElements.length === 0) {
    console.log('[Checklist Validation] All mandatory elements present: TABLE, BULLETED LIST, NUMBERED LIST');
    return checklist;
  }
  
  console.warn(`[Checklist Validation] Missing mandatory elements: ${missingElements.join(', ')} - adding defaults`);
  
  // Find suitable sections to add missing elements (not intro/conclusion)
  const modifiedChecklist = [...checklist];
  let tableAdded = hasTable;
  let bulletedAdded = hasBulletedList;
  let numberedAdded = hasNumberedList;
  
  for (let i = 0; i < modifiedChecklist.length; i++) {
    const item = modifiedChecklist[i].toLowerCase();
    const isIntroOrConclusion = 
      item.includes('introduction') || 
      item.includes('conclusion') || 
      item.includes('intro') ||
      item.includes('faq');
    
    if (isIntroOrConclusion) continue;
    
    // Add TABLE to a section that doesn't already have one
    if (!tableAdded && !item.includes('[table]')) {
      modifiedChecklist[i] = modifiedChecklist[i] + ' [TABLE]: Comparison or feature table to visualize key information.';
      tableAdded = true;
      console.log(`[Checklist Validation] Added TABLE to section ${i + 1}`);
      continue;
    }
    
    // Add NUMBERED LIST to a section that doesn't already have a list
    if (!numberedAdded && !item.includes('[list]')) {
      modifiedChecklist[i] = modifiedChecklist[i] + ' [LIST]: Numbered list of key steps or process order.';
      numberedAdded = true;
      console.log(`[Checklist Validation] Added NUMBERED LIST to section ${i + 1}`);
      continue;
    }
    
    // Add BULLETED LIST to a section that doesn't already have a list
    if (!bulletedAdded && !item.includes('[list]')) {
      modifiedChecklist[i] = modifiedChecklist[i] + ' [LIST]: Bulleted list of features or benefits.';
      bulletedAdded = true;
      console.log(`[Checklist Validation] Added BULLETED LIST to section ${i + 1}`);
      continue;
    }
    
    // All elements added
    if (tableAdded && numberedAdded && bulletedAdded) break;
  }
  
  // If we still couldn't add elements (all sections were intro/conclusion), add to first available
  if (!tableAdded || !numberedAdded || !bulletedAdded) {
    console.warn('[Checklist Validation] Could not find suitable sections, adding to available sections');
    for (let i = 0; i < modifiedChecklist.length && (!tableAdded || !numberedAdded || !bulletedAdded); i++) {
      const item = modifiedChecklist[i].toLowerCase();
      if (!tableAdded && !item.includes('[table]')) {
        modifiedChecklist[i] = modifiedChecklist[i] + ' [TABLE]: Key data table.';
        tableAdded = true;
      } else if (!numberedAdded && !item.includes('[list]')) {
        modifiedChecklist[i] = modifiedChecklist[i] + ' [LIST]: Numbered list of steps.';
        numberedAdded = true;
      } else if (!bulletedAdded && !item.includes('[list]')) {
        modifiedChecklist[i] = modifiedChecklist[i] + ' [LIST]: Bulleted list of items.';
        bulletedAdded = true;
      }
    }
  }
  
  return modifiedChecklist;
}

/**
 * Auto-generates checklist from selected keywords, H2 sections, title, and keyword data
 * No manual user prompt needed - the selections ARE the prompt context
 */
export async function generateChecklistFromSelections(
  selectedKeywords: string[],
  selectedH2Sections: string[],
  title: string,
  keywordData: KeywordData,
  options: {
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    userPrompt?: string;
    entity?: string; // Optional entity for content optimization
    entityAnalysis?: string; // AI analysis of the entity for context
    serpData?: any; // Full SERP JSON response for context
    selectedPeopleAlsoAsk?: string[]; // Selected People Also Ask questions
    peopleAlsoAskItems?: PeopleAlsoAsk[]; // Full PAA items (question + url/answer) for linking
    selectedResearchLinks?: string[]; // Selected research links for external linking
    checkedExternalLinks?: CheckedExternalLink[]; // Pre-validated external links from Google AI Mode (3-5 per blog)
    runExternalResearch?: boolean; // When true, run Google AI Mode research and inject 3-5 checked external links (uses locationName/languageCode)
    locationName?: string; // For external research (default United States)
    languageCode?: string; // For external research (default en)
    connectedSite?: { name: string; siteUrl: string }; // Connected WordPress site (target topic)
    wordPressPosts?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>; // WordPress posts for context
    wordPressPagesForOfferTable?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>;
    setProgress?: (progress: { step: string; progress: number; message?: string }) => void; // For AI Mode research micro-step
    currentPageUrl?: string; // URL of the page currently being optimized
    /** Semrush url_organic + phrase_related keywords JSON (RAG); optional */
    semrushKeywordsContext?: string;
    /** Semrush cluster/scatter JSON for phrasing spread; optional */
    semrushScatterContext?: string;
    /** Server-filtered Semrush external URLs - third-party hrefs must match exactly when provided */
    semrushApprovedExternalUrls?: string[];
    /** Semrush keyword phrases - external anchor text must match exactly when provided */
    semrushAnchorPhrases?: string[];
    /** Local Analysis CSV: each `selectedPeopleAlsoAsk` string is one H2 title verbatim (+ H3 + table/list under it). */
    verbatimQuestionH2Outline?: boolean;
    /** Blog import: preserve imported H2 headings verbatim; use `importedSectionBriefs` for draft excerpts. */
    verbatimImportedH2Outline?: boolean;
    importedSectionBriefs?: Array<{ h2: string; body: string }>;
    /** Blog import tone analysis — match voice without reducing sophistication. */
    importedToneProfile?: ImportedBlogToneProfile;
    /** Blog import: exact hyperlinks from source draft — mandatory in checklist. */
    importedDraftLinks?: ImportedDraftLink[];
    /** Per-row Modifications field URLs — mandatory external links from DataForSEO research. */
    modifierExternalLinks?: ModifierExternalLink[];
    /** Entity SAP row: verified English Wikipedia URL (mandatory for entity bulk). */
    wikipediaUrl?: string;
    /** Entity SAP row: verified Wikipedia article title. */
    wikipediaTitle?: string;
    /** Prefixed CSV field contract — use title/meta/wiki/slug verbatim. */
    prefilledRowContract?: string;
    /** Row-only external links (modifier_links_json + imported_links_json). */
    userExternalLinks?: ExternalLinkPair[];
  }
): Promise<string[]> {
  const {
    apiKey,
    model = getResearchModel(),
    temperature = 1.0,
    maxTokens = 4000,
    topP = 0.9,
  } = options;

  const resolvedCheckedLinks = options.checkedExternalLinks;
  const optionsWithCheckedLinks = resolvedCheckedLinks?.length
    ? { ...options, checkedExternalLinks: resolvedCheckedLinks }
    : options;
  // Keep keywords in their natural form (lowercase) - do NOT capitalize them
  // Keywords should only be capitalized when they're proper nouns, geographic locations, or at sentence starts
  const primaryKeywordNatural = keywordData.keyword.toLowerCase();
  const selectedKeywordsNatural = selectedKeywords.map(kw => kw.toLowerCase());

  // Define proper case versions for display purposes (used in template strings)
  const primaryKeywordProper = toProperCase(keywordData.keyword);
  const selectedKeywordsProper = selectedKeywords.map(kw => toProperCase(kw));

  const keywordSection = `
--- Keyword Context ---
Primary Keyword: ${primaryKeywordNatural}
Search Volume: ${keywordData.searchVolume?.toLocaleString() || "N/A"}
Difficulty: ${keywordData.difficulty || "N/A"}/100
Intent: ${keywordData.intent || "N/A"}
Selected Keywords: ${selectedKeywordsNatural.join(", ") || "None"}

CRITICAL: Each selected keyword listed above MUST be used as anchor text in internal links within relevant sections. When creating checklist items, explicitly specify which keywords should be used as anchor text in each section's internal links.

CRITICAL KEYWORD CAPITALIZATION RULE:
- Keywords should be used in their NATURAL FORM (typically lowercase for generic terms)
- DO NOT randomly capitalize generic keywords like "blinds", "shades", "windows", "roller", "modern", etc.
- Only capitalize keywords when they are:
  * Proper nouns (brand names, product names like "Zebra Blinds", "Roller Shades" as product names)
  * Geographic locations (cities, states, countries)
  * At the start of sentences
- Examples:
  * CORRECT: "blinds for windows near me", "custom blinds near me", "modern roller shades"
  * WRONG: "Blinds for Windows near Me", "Custom Blinds near Me", "Modern Roller Shades"
  * CORRECT: "Zebra Blinds" (product name), "New York" (location), "Blinds are essential" (sentence start)

FOCUS KEYWORD DENSITY (EXPLICIT - THE CHECKLIST MUST STATE THIS IN PLAIN LANGUAGE):
- Target **at least ~1.0%** focus keyword density for the primary phrase (plus word-order combinations), **not** staying near **0.5%**.
- Every generated checklist MUST include an explicit line such as: **[FOCUS KEYWORD DENSITY]**: Target **minimum ~1.0%** focus keyword density across the **full article** (exact phrase + word-order combinations). **Do not** ship content around **~0.5%** when the goal is **~1%** or higher.
- Require **multiple** natural placements across **introduction, several H2 sections, body paragraphs, and conclusion** - spread usage, do not cram everything into one paragraph.
- If density is still low despite many mentions, the checklist should say to **weave the exact focus phrase** and close combinations in a few more sections until **~1%** is met, without robotic repetition in one block.

EXACT PRIMARY KEYWORD - ONCE PER EVERY H2 SECTION (NON-NEGOTIABLE - CHECKLIST MUST STATE THIS):
- The **exact** Primary Keyword string above (same words, same order as **Primary Keyword**; normal sentence capitalization is fine) MUST appear **at least once in the body** of **every** section that is an **H2** main block: introduction (first H2), **each** selected H2 topic, conclusion (final H2), and any mandatory H2s (e.g. service-area **What We Offer**, **Next Steps**).
- Every generated checklist item for an H2 section MUST include an explicit line: **[EXACT PRIMARY PER H2]**: Include the **exact** primary keyword phrase **at least once** in this section's body copy (paragraphs and/or list/table text under that H2). **Not** only synonyms or partials - the **full exact phrase** must appear **somewhere** under that H2.
- The exact phrase does **not** need to appear inside the H2 **heading title**; it **must** appear in the **content** under that H2 (including inside H3 subsections that belong to that H2).
- Do **not** skip an H2: if one section lacks the exact phrase, the checklist is incomplete.

READABILITY - PARAGRAPH LENGTH (CHECKLIST SHOULD STATE **[PARAGRAPH LENGTH]**):
- Prefer **moderately short** paragraphs: typically **2–4 sentences** per paragraph on average. **Split** content when a paragraph would become a long wall of text (roughly **5+ sentences** or one dominant block) - this addresses SEO/readability feedback like “paragraph is long.”
- **Do not** default to **only** one-sentence paragraphs (over-choppy); **do not** leave **overly long** single paragraphs. Balance scannability with natural flow.

CRITICAL KEYWORD USAGE - NATURAL LANGUAGE PRIORITY (2026 SEO STANDARDS):
- AVOID KEYWORD STUFFING: Never repeat the exact-match phrase in every sentence or stack it unnaturally. Modern search engines penalize repetitive, robotic-sounding content.
- Use semantic variations **and** word-order combinations to reach **~1%** density:
  * If primary keyword is "Wood Window Blinds Seagrove Beach", use variations like:
    - "wood blinds" (often)
    - "wood window treatments in Seagrove Beach" (varied)
    - "wooden blinds for coastal homes" (natural alternative)
    - "wood blinds in the Seagrove Beach area" (natural phrasing)
  * Distribute **exact** and **partial** matches across the whole article so total focus-keyword presence meets **~1%** - do **not** rely on "1–2 exact uses only" if that leaves density at **~0.5%**
  * Split multi-word keywords naturally across sentences where it reads well, but ensure components still appear often enough overall for density targets
- Natural language patterns:
  * Write as a human would speak, not as SEO software would generate
  * Use conversational, engaging language that prioritizes reader experience
  * If non-focus wording feels forced, rephrase; the **exact** Primary Keyword must still appear once per H2 per **[EXACT PRIMARY PER H2]** - place it where it reads naturally (often mid-sentence)
  * Vary sentence structure - avoid repetitive patterns that make content feel formulaic
- Anchor text variety (CRITICAL for modern SEO):
  * Mix keyword-rich (20%), branded (30%), and natural descriptive (50%) anchor text
  * Branded examples: "In The Shade's collection", "our showroom", "contact our team"
  * Natural descriptive: "this guide to humidity-resistant blinds", "learn more about motorization", "explore your options"
  * Avoid overusing exact keyword phrase as anchor text - this signals over-optimization
- Keyword density guidance (for SEO):
  * Target **at least ~1.0%** focus keyword density (exact phrase + word-order combinations). **Avoid** finishing around **~0.5%** when the target is **~1%** or higher.
  * Prefer spreading exact and partial matches across sections over a single paragraph stuffed with repeats
  * Use partial matches and semantic variations for readability, but **do not** use "variations only" as an excuse for **below ~1%** total focus-keyword score
  * Focus on topical relevance **and** meeting the explicit density bar the checklist states
- Content quality over keyword matching:
  * Readability, user value, and natural flow matter - but the checklist must still **explicitly** require **~1%** focus keyword density, not **~0.5%**
  * Content should sound like it was written by a human expert, not an SEO tool
  * If a paragraph feels stuffed, **redistribute** mentions to other sections rather than dropping below **~1%** overall
`;

  const h2Section = selectedH2Sections.length > 0
    ? `
--- Selected H2 Sections ---
${selectedH2Sections.map((h2, idx) => `${idx + 1}. ${h2}`).join("\n")}
`
    : "";

  // Extract full PAA data from SERP if available, or use selected questions
  let paaQuestions: Array<{ question: string; answer?: string; url?: string }> = [];
  let paaItems: PeopleAlsoAsk[] = Array.isArray(options.peopleAlsoAskItems) ? options.peopleAlsoAskItems : [];
  if (paaItems.length === 0 && options.serpData) {
    // Best-effort: derive PAA items from SERP JSON so we can link sources in the FAQ section.
    try {
      const { extractPeopleAlsoAskFromSerp } = await import("./paa-extractor");
      const extracted = extractPeopleAlsoAskFromSerp(options.serpData);
      paaItems = extracted.items || [];
    } catch {
      // ignore – links are optional, questions can still be used
    }
  }

  const selectedProvided = Array.isArray(options.selectedPeopleAlsoAsk) && options.selectedPeopleAlsoAsk.length > 0;

  if (options.verbatimImportedH2Outline && options.importedSectionBriefs?.length) {
    paaQuestions = options.importedSectionBriefs.map((s) => ({
      question: s.h2.trim(),
      answer: s.body?.trim() || undefined,
      url: undefined,
    }));
  } else if (options.verbatimQuestionH2Outline && selectedProvided) {
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const q of options.selectedPeopleAlsoAsk!) {
      const t = q?.trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(t);
    }
    paaQuestions = deduped.map((question) => ({ question, answer: undefined, url: undefined }));
  } else if (selectedProvided || paaItems.length > 0) {
    const selected = selectedProvided
      ? options.selectedPeopleAlsoAsk!.map((q) => q?.trim()).filter((q): q is string => !!q)
      : paaItems.map((p) => p.question).filter((q): q is string => !!q);

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const q of selected) {
      const k = q.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        deduped.push(q);
      }
      // Don't break early - collect all questions for AI analysis if entity is provided
      if (!options.entity && deduped.length >= 10) break; // top 10 "most popular" (SERP order / user-selected order) - only if no entity
    }

    // Create full PAA question objects and filter out international references
    let allPaaQuestions = deduped
      .map((question) => {
        const match = paaItems.find(
          (p) => p?.question && p.question.toLowerCase().trim() === question.toLowerCase().trim()
        );
        return {
          question,
          answer: match?.answer,
          url: match?.url,
        };
      })
      .filter((paa) => {
        // Filter out questions with non-North American location references
        const lowerQuestion = paa.question.toLowerCase();
        const blockedTerms = ['australia', 'uk', 'united kingdom', 'europe', 'asia', 'london', 'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'canberra', 'england', 'scotland', 'wales', 'ireland', 'new zealand', 'singapore', 'hong kong', 'tokyo', 'paris', 'berlin', 'rome', 'madrid'];
        const hasInternationalRef = blockedTerms.some(term => lowerQuestion.includes(term));
        if (hasInternationalRef) {
          console.log(`[PAA Filter] Filtered out question with international reference: ${paa.question}`);
          return false;
        }
        return true;
      });

    // If entity is provided, use AI to select the BEST questions for the FAQ section
    if (options.entity && allPaaQuestions.length > 10) {
      try {
        const apiKey = options.apiKey || loadApiKey();
        if (apiKey) {
          paaQuestions = await selectBestPAAQuestionsWithAI(
            allPaaQuestions,
            options.entity,
            keywordData.keyword,
            title,
            options.connectedSite,
            apiKey,
            options.model,
            options.temperature,
            options.maxTokens,
            options.topP
          );
        } else {
          // No API key, use fallback (top 10)
          paaQuestions = allPaaQuestions.slice(0, 10);
        }
      } catch (error) {
        console.warn('[PAA Selection] Error in AI selection, using fallback:', error);
        paaQuestions = allPaaQuestions.slice(0, 10);
      }
    } else {
      // No entity or not enough questions - use simple selection (top 10)
      paaQuestions = allPaaQuestions.slice(0, 10);
    }
  }

  // Normalize siteUrl: remove trailing slash to prevent double slashes in links
  // Define this early as it's used in template strings below
  const normalizedSiteUrl = options.connectedSite?.siteUrl ? options.connectedSite.siteUrl.replace(/\/+$/, '') : '';

  const semrushParts = buildSemrushExactPromptParts({
    semrushApprovedExternalUrls: options.semrushApprovedExternalUrls,
    semrushAnchorPhrases: options.semrushAnchorPhrases,
    userExternalLinks: options.userExternalLinks,
    normalizedSiteUrl,
  });

  const paaSectionLabel = options.verbatimImportedH2Outline
    ? "Imported draft headings (verbatim — optimize body only)"
    : "People Also Ask (appended flo-faq only — not body H2 sections)";
  const paaSection = paaQuestions.length > 0
    ? `
--- ${paaSectionLabel} ---
These questions feed the appended flo-faq FAQ block at upload. Do NOT create a dedicated FAQ, Q&A, or "Answering Your Questions" body H2. Weave topical answers into normal topic H2s only when natural.
${paaQuestions.map((paa, idx) => {
  const label = options.verbatimImportedH2Outline ? "Heading" : "Question";
  let item = `${idx + 1}. ${label}: "${paa.question}"`;
  if (paa.answer) {
    const excerptLabel = options.verbatimImportedH2Outline ? "Existing draft excerpt" : "Answer context";
    const answerText =
      options.verbatimImportedH2Outline
        ? paa.answer
        : `${paa.answer.substring(0, 400)}${paa.answer.length > 400 ? "..." : ""}`;
    item += `\n   ${excerptLabel}: ${answerText}`;
  }
  if (paa.url) item += `\n   Source URL: ${paa.url}`;
  return item;
}).join("\n\n")}

`
    : "";

  // External links: Wikipedia for entity only - no other external research
  const entityName = optionsWithCheckedLinks.entity?.trim();
  const explicitWikiUrl = optionsWithCheckedLinks.wikipediaUrl?.trim();
  const entityWikiUrl = explicitWikiUrl
    ? explicitWikiUrl
    : entityName
      ? optionsWithCheckedLinks.selectedResearchLinks?.find((url) => {
          try {
            const u = new URL(url.startsWith('http') ? url : `https://${url}`);
            if (!u.hostname.includes('wikipedia.org')) return false;
            const pathLower = u.pathname.toLowerCase().replace(/_/g, ' ');
            return entityName.split(/[\s,]+/).filter(Boolean).some(w => pathLower.includes(w.toLowerCase()));
          } catch { return false; }
        })
      : undefined;
  const entityWikiTitle = optionsWithCheckedLinks.wikipediaTitle?.trim();
  const mandatoryEntityWikiBlock =
    entityName && entityWikiUrl
      ? formatMandatoryEntityWikipediaForPrompt({
          entity: entityName,
          wikipediaUrl: entityWikiUrl,
          wikipediaTitle: entityWikiTitle,
        })
      : "";
  const validResearchLinks = entityWikiUrl ? [entityWikiUrl] : [];

  const researchLinksSection = entityWikiUrl
    ? semrushParts.hasSemrushExactMode
      ? `
--- External reference (Semrush + mandatory Wikipedia) ---
${mandatoryEntityWikiBlock}
Entity Wikipedia (MANDATORY): ${entityWikiUrl}${entityWikiTitle ? ` (${entityWikiTitle})` : ""}

**EXTERNAL LINK RULES**:
- **Primary**: Outbound third-party links MUST follow the "SEMRUSH - APPROVED EXTERNAL URLs" and "SEMRUSH - APPROVED ANCHOR PHRASES" blocks in the prompt above (exact href + exact anchor).
- **Mandatory**: Link "${entityName}" to the entity Wikipedia URL above in intro and at least one body section.
- Do NOT invent URLs. Do NOT use sites outside Semrush (+ mandatory Wikipedia as noted).
`
      : `
--- External Links (MANDATORY WIKIPEDIA) ---
${mandatoryEntityWikiBlock}
Entity Wikipedia (MANDATORY): ${entityWikiUrl}${entityWikiTitle ? ` (${entityWikiTitle})` : ""}

**EXTERNAL LINK RULES**:
- You MUST link "${entityName}" to the entity Wikipedia URL above in the intro and at least one body section.
- The ONLY allowed external link is this entity Wikipedia page (unless imported draft links or modifier external links are listed elsewhere in this prompt).
- NO other external sites. Do NOT invent, hallucinate, or fabricate any external URL.
- NEVER create "External Resources" sections. Integrate the Wikipedia link contextually.
- NEVER link to competitors, manufacturers, or any other external domain.
`
    : "";

  const userPromptSection = options.userPrompt && options.userPrompt.trim()
    ? `\n--- USER-SPECIFIED REQUIREMENTS (MUST BE EXPLICITLY REFERENCED) ---\n${options.userPrompt.trim()}\n\nCRITICAL: If the user has provided specific requirements above, you MUST explicitly note and incorporate them in the checklist items. For example, if the user mentions "include a table", "use 3-5 links", or any specific features, you MUST explicitly state these requirements in the relevant checklist items. NOTE: Only include [IMAGE] features if the user explicitly requests images with a specific image link or markdown format.\n\nWhen the requirement is a thematic focus or modifier (e.g. "creative structures only", "focus on X"), checklist items should tie section content to that theme so the blog stays on-topic. Do not require the exact modifier phrase in every section heading - that causes keyword stuffing. Vary how sections reference the theme: some headings can imply it; only one or two section titles may use the phrase if it fits naturally. Content should support the focus without repeating the phrase in every H2.`
    : "";

  const prefilledRowContractSection = options.prefilledRowContract?.trim()
    ? `\n${options.prefilledRowContract.trim()}\n`
    : "";

  const entityContext = options.entity && options.entity.trim()
    ? (() => {
        const entityName = options.entity.trim();
        const generalExamples = getLocalEntityPhraseExamples(entityName, 'general', 6);
        const expertiseExamples = getLocalEntityPhraseExamples(entityName, 'expertise', 4);
        
        return `\n--- Entity/Location Optimization Context ---
Target Entity/Location: ${entityName}
${mandatoryEntityWikiBlock}
${options.entityAnalysis ? `Entity Analysis: ${options.entityAnalysis}\n\nUse this analysis to naturally scatter entity context throughout the content.` : ''}

CRITICAL TITLE FORMAT: For entity pages, the word "near" MUST appear in the title - never omit it. Format: [keyword] near [entity]. The [keyword] is the service/product ONLY - no city or location in keyword. Entity only after "near". Never [entity] [keyword] or [entity] [keyword] Services. Apply when generating or updating the blueprint title.

CRITICAL LOCATION VARIATION REQUIREMENTS:
- VARY location mentions - do NOT repeat exact location name repeatedly (e.g., "Edmonton" over and over)
- **CRITICAL: USE VARIED PHRASES FOR ENTITY REFERENCES** - Instead of repeatedly saying "for ${entityName}" or "in ${entityName}", rotate through diverse phrases:
  * ${generalExamples.map(ex => `"${ex}"`).join(', ')}
  * Use different phrases in different sections to avoid obvious repetition
- Use geographic variations naturally:
  * Exact location name: Use 2-3 times maximum in entire article (e.g., "Edmonton", "New York", "Toronto")
  * Broader geographic terms: Use frequently (e.g., "Alberta area", "New York region", "Ontario region")
  * Neighboring/regional references: Use naturally (e.g., "local area", "regional", "area")
  * General area references: Use often (e.g., "local homes", "area residences", "regional properties")
- IMPORTANT: Use ONLY generic city names (e.g., "Edmonton", "New York", "Toronto") - DO NOT use specific neighborhoods or directional qualifiers (e.g., "West Edmonton", "North Toronto", "East New York")
- Natural location integration:
  * Use exact location name in title/intro (1-2 times)
  * Use broader geographic terms in body content (most common)
  * Use exact location sparingly in conclusion (1 time maximum)
  * Example: Instead of "${entityName} home" repeatedly, use "local area home", "regional residence", "${entityName} properties" (varied)
- Location density: Target 1-2% for exact location name, 3-5% for broader geographic variations

**CRITICAL: PREVENT OVER-OPTIMIZATION**:
- Remove 15-20% of primary keyword mentions and replace with natural variations
- Instead of repeating exact keyword phrases, use alternatives like "local experts", "our team", "specialists", "professionals"
- Example: Instead of "Edmonton SEO experts" repeatedly, use "local experts", "our team", "SEO specialists in the area", "local professionals"
- This prevents keyword stuffing and makes content feel more natural and human-written

**CRITICAL: SHORTEN ANCHOR TEXT**:
- Keep anchor text SHORT (2-5 words maximum) - only link the key phrase, NOT entire sentences
- Example CORRECT: "Learn more about [window treatment SEO](link) from our experts"
- Example WRONG: "[Learn more about window treatment SEO and how it can help your business](link) from our experts"
- Extract only the essential keyword phrase for linking, leave the rest of the sentence unlinked

**CRITICAL: PREVENT DOUBLE ANCHOR TAGS**:
- NEVER nest anchor tags - this creates invalid HTML like <a><a>text</a></a>
- Each link must be independent and properly closed
- If multiple terms need linking, create separate links with proper spacing between them

**CRITICAL: ADD ENGAGING ENTITY DETAILS**:
- Include at least ONE specific "Fun Fact" or unique detail about ${entityName} that demonstrates real local knowledge
- Examples: proximity to landmarks (e.g., "near the Whitemud"), historical significance, geographic features, nearby neighborhoods, local characteristics
- This detail should be specific, verifiable, and prove the content wasn't written by generic AI
- Place it naturally in the content - could be in introduction, a blockquote, or integrated into a section
- Make readers feel like someone with genuine local knowledge wrote this

CRITICAL: Include REAL-WORLD EXPERTISE EXAMPLES in at least one section:
- Add authentic experience statements that demonstrate expertise (EEAT signals)
- Use natural, conversational phrasing that shows hands-on experience
- **USE VARIED PHRASES** - Rotate through different expertise phrases to avoid repetition:
  * ${expertiseExamples.map(ex => `"${ex}"`).join(', ')}
  * Use different phrases in different sections - don't repeat the same expertise phrase
- Place real-world examples naturally in relevant sections (Benefits, Features, or How-To sections work best)
- Make it sound authentic and specific - avoid generic statements
- Real-world examples should feel like genuine expertise, not forced SEO content

Entity optimization: Ensure checklist items reference the entity/location naturally with variations, not exact matches repeatedly. Use only generic city names, never specific neighborhoods or directional qualifiers. Use varied phrases like ${generalExamples.slice(0, 3).map(ex => `"${ex}"`).join(', ')} instead of repeatedly saying "for ${entityName}" or "in ${entityName}".`;
      })()
    : "";

  const targetSiteContext = options.connectedSite
    ? `\n=== TARGET SITE CONTEXT ===
Target Website: ${options.connectedSite.name} (${normalizedSiteUrl})

IMPORTANT: This website is the target topic for all generated content. Use information about this site as a source of truth for generating relevant, on-brand blog content. However, do NOT use the site name as an entity - use it only to inform the topics, tone, and context of the content.

All generated checklist items and content should be relevant to ${options.connectedSite.name} and aligned with its content focus, audience, and brand positioning. Ensure all content suggestions are suitable for publication on ${options.connectedSite.name}.
=== END TARGET SITE CONTEXT ===`
    : "";

  // Get WordPress posts from cache if siteId and primaryKeyword provided, otherwise use provided wordPressPosts
  let postsToUse: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }> = [];
  
  if ((options as any).siteId && (options as any).primaryKeyword) {
    // Try to use cache search
    try {
      const cache = getSiteCache((options as any).siteId);
      if (cache) {
        // Search cache for relevant posts based on primary keyword
        const searchResults = searchSiteCache((options as any).siteId, (options as any).primaryKeyword, 50);
        postsToUse = searchResults.map(p => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          link: p.link,
          date_gmt: p.date_gmt
        }));
        console.log(`[Blog Template Builder] Using ${postsToUse.length} posts from cache search for keyword: ${(options as any).primaryKeyword}`);
      } else {
        // Fallback to provided wordPressPosts if cache not available
        postsToUse = options.wordPressPosts || [];
        console.log(`[Blog Template Builder] Cache not available, using provided wordPressPosts (${postsToUse.length} posts)`);
      }
    } catch (error) {
      console.warn('[Blog Template Builder] Error using cache, falling back to provided wordPressPosts:', error);
      postsToUse = options.wordPressPosts || [];
    }
  } else {
    // Use provided wordPressPosts
    postsToUse = options.wordPressPosts || [];
  }

  const wordPressPostsContext = postsToUse.length > 0
    ? `\n=== WORDPRESS POSTS SOURCE (CRITICAL - INTERNAL LINKS ONLY) ===
Available WordPress Posts from ${options.connectedSite?.name || 'target site'} (${postsToUse.length} total${(options as any).siteId && (options as any).primaryKeyword ? ` - filtered by keyword: ${(options as any).primaryKeyword}` : ''}):

${postsToUse.slice(0, 30).map((post, idx) => {
  return `${idx + 1}. "${post.title}"\n   URL: ${post.link || post.slug}`;
}).join('\n\n')}

CRITICAL REQUIREMENT: Your checklist items MUST be INFORMED BY these WordPress posts' internal links. The checklist should reflect content themes, topics, and structure patterns found in these existing posts' titles and URL structures.

- Analyze the available WordPress posts' titles and internal link URLs to understand the site's content themes and topics
- Generate checklist items that are RELATED to these posts based on title keywords and URL path patterns
- Ensure checklist items align with the content style and topics suggested by these WordPress post titles and URLs
- Use post titles and internal link URL structures as inspiration for generating relevant checklist items
- Focus on URL patterns, path structure, and title keywords rather than full content analysis
- The goal is to create checklist items that would naturally fit alongside these existing posts based on their link structure

CRITICAL: You are ONLY provided with post titles and internal link URLs. Use these to determine relevance - focus on URL structure, path patterns, and title keywords. This saves tokens and improves quality by focusing on link structure.

Do NOT create checklist items that are completely unrelated to these WordPress posts. All checklist items must be contextually relevant to the titles and internal links shown above.
=== END WORDPRESS POSTS SOURCE ===\n`
    : "";

  const currentPageContext = options.currentPageUrl
    ? `\n=== CRITICAL: CURRENT PAGE BEING OPTIMIZED ===
Current Page URL: ${options.currentPageUrl}

**ABSOLUTELY CRITICAL - NEVER SELF-LINK**:
- This is the URL of the existing post/page currently being optimized
- NEVER link this URL to itself in the content
- NEVER include this URL in any internal link suggestions
- NEVER reference this URL in checklist items
- Self-referential links (linking a page to itself) are bad for SEO and must be avoided
- When suggesting internal links, exclude this URL from all link suggestions
- Only suggest links to OTHER pages/posts, never to this current page

This instruction applies to ALL checklist items that mention links or internal links.
=== END CURRENT PAGE CONTEXT ===\n`
    : "";

  const serpDataContext = options.serpData
    ? `
--- SERP Data (Full JSON Response) ---
Below is the complete SERP (Search Engine Results Page) data from DataForSEO API. Use this data to inform your checklist generation:

1. **Top Ranking Content Patterns**: Analyze the top organic results to understand what content structure and topics are ranking well
2. **SERP Features**: Note any featured snippets, People Also Ask, related searches, or other SERP features that indicate content opportunities
3. **Content Gaps**: Identify what top-ranking pages are covering and suggest checklist items that address gaps or improve upon existing content
4. **User Intent Signals**: Use the SERP data to better understand user search intent and create checklist items that match that intent

SERP Data (JSON):
${JSON.stringify(options.serpData, null, 2)}
`
    : "";

  const semrushKeywordsContextBlock = options.semrushKeywordsContext?.trim()
    ? `
--- Semrush keyword research (JSON) ---
Use for topical coverage and search-intent signals only. Do NOT paste this JSON into checklist items. Weave phrasings naturally; avoid keyword stuffing.
${options.semrushKeywordsContext}
`
    : "";

  const semrushScatterContextBlock = options.semrushScatterContext?.trim()
    ? `
--- Semrush cluster scatter plan (JSON) ---
Use zone hints to spread related phrases across sections. Do NOT paste this JSON into checklist items.
${options.semrushScatterContext}
`
    : "";

  const importedToneSection =
    options.verbatimImportedH2Outline && options.importedToneProfile
      ? formatImportedToneForChecklistPrompt(options.importedToneProfile)
      : "";

  const importedLinksSection = formatImportedDraftLinksForPrompt(options.importedDraftLinks ?? []);
  const modifierLinksSection = formatModifierExternalLinksForPrompt(options.modifierExternalLinks ?? []);

  const verbatimImportedH2Section =
    options.verbatimImportedH2Outline && paaQuestions.length > 0
      ? `
=== VERBATIM IMPORTED H2 MODE (MANDATORY - OVERRIDES GENERIC H2 SUGGESTIONS ABOVE) ===
The user imported a draft blog. Each listed H2 heading MUST become **exactly one** main body section:

- **H2 heading text** must equal the imported heading **verbatim** (same wording, punctuation, and casing). Do not rewrite, shorten, merge, or "SEO clean" the heading.
- **Preserve factual claims** from "Existing draft excerpt" where present; rewrite for SEO, readability, focus keyword density, links, and structure.
- **Voice**: Match the imported draft's tone and sophistication (see TONE & VOICE block). Do **not** dumb down, casualize, or rewrite into generic SEO-blog voice.
- **No duplicate H2s** for the same heading string.
- Under **each** H2: **at most 2 H3** subsections with **1-2 short paragraphs** each, and **either** a **[TABLE]** or a **[LIST]** when needed — state both explicitly in the checklist line for that section.
- Harness writes **one H2 per pass**; imported excerpt is **fact source only** — never copy sibling H2 headings or their body HTML into this pass.
- Produce **one numbered checklist item per imported H2** (same order as listed). Each item must quote the exact H2 title and require matching source voice at the same sophistication level.
- The Blog Title is the WordPress post title only. Body HTML starts with the first imported H2. Never write an H1 in the article body.
- Do **not** replace these with generic topic H2s from "Selected H2 Sections".
=== END VERBATIM IMPORTED H2 MODE ===

`
      : "";

  const verbatimQuestionH2Section =
    !options.verbatimImportedH2Outline && options.verbatimQuestionH2Outline && paaQuestions.length > 0
      ? `
=== VERBATIM QUESTION H2 MODE (MANDATORY - OVERRIDES GENERIC H2 SUGGESTIONS ABOVE) ===
The user supplied **verbatim** research questions (see "Selected People Also Ask Questions" below). Each question MUST become **exactly one** main body section in the final article blueprint:

- **H2 heading text** must equal the question string **verbatim** (same wording, punctuation, and casing as listed). Do not rewrite, shorten, merge, or "SEO clean" the question.
- **No duplicate H2s** for the same question string.
- Under **each** question H2: **at least one H3** subsection, and **either** a **[TABLE]** or a **[LIST]** (bulleted or numbered) - state both explicitly in the checklist line for that section.
- Produce **one numbered checklist item per question** (in the same order as listed). Each item must quote the exact H2 title.
- Do **not** replace these with generic topic H2s from "Selected H2 Sections" when those conflict - question H2s take priority for the body.
=== END VERBATIM QUESTION H2 MODE ===

`
      : "";

  const systemPrompt = `You are an expert blog content strategist and blueprint architect. Your role is to create a detailed, robust checklist for generating a blog template blueprint based on the provided selections.

${keywordSection}

CRITICAL: Use natural, conversational language - avoid stuffing one paragraph. **Focus keyword**: The checklist MUST explicitly require **minimum ~1.0%** focus keyword density (exact phrase + counted combinations), **not ~0.5%**. Distribute the focus keyword across intro, multiple H2s, body, and conclusion. Use semantic variations where they help readability, but do not leave total density below **~1%** just to avoid exact matches. **[EXACT PRIMARY PER H2]**: The checklist MUST require the **exact** Primary Keyword phrase **at least once in the body of every H2 section** (see Keyword Context above).

**FORBIDDEN BODY H2 HEADERS (NON-NEGOTIABLE)**: NEVER use FAQ-style section titles in the article body. FAQ is appended later as flo-faq with H2 id="faq". Forbidden titles include: "FAQ", "Frequently Asked Questions", "Answering Your Questions…", "Common Questions…", "Q&A", or any dedicated Question/Answer section H2. PAA questions are NOT standalone body sections.

--- Blog Title ---
${title}
${importedToneSection}${importedLinksSection}${modifierLinksSection}${verbatimImportedH2Section}${verbatimQuestionH2Section}${targetSiteContext}${wordPressPostsContext}${currentPageContext}${h2Section}${paaSection}${researchLinksSection}${userPromptSection}${prefilledRowContractSection}${entityContext}${serpDataContext}${semrushKeywordsContextBlock}${semrushScatterContextBlock}${semrushParts.semrushExactBlock}

${buildArticleLengthChecklistBlock(!!options.entity)}

Create a checklist (5-6 items for blog, 6-7 for service area SAP) based on selected H2 sections. Each item must include:

**Harness contract (mandatory)**:
- Each checklist item becomes **exactly one H2** written in a **separate harness pass**. State: "Output is ONLY this H2 block (~${Math.floor(ARTICLE_MAX_WORDS / 6)} words)." **Never** instruct writing other H2 sections in the same pass.
- **No duplicate H2 titles** and **no duplicate topics** (merge overlapping service/location sections into one H2).
- Entire article: **at most 2** [TABLE] items across all checklist lines—not every section gets a table.

**Structure** (SEO HIERARCHY MANDATORY):
- H2 = main section titles ONLY. H3 = subsections under H2. H4 = sub-subsections. NEVER use H3 for a main section.
- **[EXACT PRIMARY PER H2]**: Every checklist item that creates an H2 section MUST state that the **exact** Primary Keyword (from Keyword Context) appears **at least once** in that section's body - **every** H2, no exceptions.
- **[PARAGRAPH LENGTH]**: Every checklist item should require **moderately short** paragraphs (**~2–3 sentences** typical); **avoid long** single paragraphs; **avoid** all-one-sentence choppiness unless a line truly needs emphasis.
- H2 sections: 1-2 paragraphs. If more needed: "[STRUCTURE]: Include at most 2 H3 subheadings with 1-2 short paragraphs under each covering [specific subtopics]"
- Mix content: Include [TABLE] or [LIST] where appropriate—but **entire article: max 2 [TABLE] items total**. For lists, suggest bulleted or numbered lists depending on content type
- Block quotes: You can creatively present entity facts using [BLOCKQUOTE]: [entity fact description] - use these sparingly, MAXIMUM 1-2 block quotes per entire blueprint, only where entity facts would add value and visual interest

**Links**:
${semrushParts.linksBulletExternal}
- Distribute selected keywords across sections as anchor text
- If no keywords: "[LINK]: 3–5 [[LINK:query|anchor]] placeholders per section (no raw https:// internal URLs)"
- Weave keywords elegantly into anchor text - integrate them naturally within sentence structure using semantic variations and natural syntax
- **Include in the checklist**: **[FOCUS KEYWORD DENSITY]**: **minimum ~1.0%** focus keyword density (exact + combinations); **not** **~0.5%** when the target is **~1%** or higher. **[EXACT PRIMARY PER H2]**: **exact** Primary Keyword phrase **once per H2** section body (minimum). **[PARAGRAPH LENGTH]**: **moderately short** paragraphs (**~2–4 sentences**); no long walls of text; not all single-sentence paragraphs.
- Use semantic variations for flow, but spread exact/partial matches across the article so focus keyword density clears **~1%**
- Vary anchor text: 50% natural descriptive, 30% branded, 20% keyword-rich - avoid identical anchor every time, not "never use exact phrase"
- If one paragraph feels repetitive, **redistribute** focus-keyword usage to other sections instead of dropping below **~1%** overall
- **CRITICAL: Keep anchor text SHORT (2-5 words maximum)** - only link the key phrase, NOT entire sentences. Extract only the essential keyword phrase for linking
- **CRITICAL: NEVER nest anchor tags** - prevent double <a> tags that create invalid HTML
${options.currentPageUrl ? `\n**CRITICAL: NEVER SELF-LINK**:
- When optimizing an existing post, NEVER link the post's URL to itself in the content
- The current page URL (${options.currentPageUrl}) must NEVER appear in any internal link suggestions
- Self-referential links are bad for SEO and must be completely avoided
- Only suggest links to OTHER pages/posts, never to the current page being optimized
- This applies to ALL checklist items that mention links or internal links` : ""}

${semrushParts.externalLinksPolicyBlock}

**Location/Entity Variation**:
- VARY location mentions - use exact location name sparingly (2-3 times maximum)
- Use broader geographic terms frequently (Tampa Bay area, Pinellas County, coastal Florida, etc.)
- Mix location references: exact name (rare), broader region (common), general area (frequent)
- Example: "Oldsmar" (2-3 times) → "Tampa Bay area" (frequent) → "Pinellas County" (frequent) → "local homes" (most common)

**Real-World Expertise Examples** (CRITICAL - MUST include in at least one section):
- Add authentic experience statements demonstrating expertise (EEAT signals)
- Use natural phrasing showing hands-on experience
- Include statements like: "After installing hundreds of systems in [location/variation], we've found..." or "Our experience serving [broader area] has shown..."
- Place in Benefits, Features, or How-To sections naturally
- Make it sound specific and genuine - avoid generic statements
- Format: "[REAL-WORLD EXAMPLE]: Include natural expertise statement demonstrating hands-on experience with [topic] in [location variation]"

**Other**:
- DO NOT include [IMAGE] unless user requests it
- Block quotes: Use [BLOCKQUOTE] for entity facts creatively, but MAXIMUM 1-2 block quotes per entire blueprint

${semrushParts.externalCompetitorBlock}

**EXPLICIT USER REQUIREMENTS**:
${options.userPrompt && options.userPrompt.trim() 
  ? `The user has provided specific requirements. You MUST explicitly note these in the checklist. CRITICAL RULES:
- If user provides an EXACT TABLE STRUCTURE (with markdown table format, columns, rows, and data), you MUST include the COMPLETE table structure in the checklist item, preserving the exact format, column headers, and all row data
- If user provides an EXACT IMAGE LINK in markdown format (![ ](url)), you MUST include the COMPLETE markdown image format in the checklist item
- If user mentions "table", include "[TABLE]: [description]" AND if they provide the exact table structure, include the full table markdown
- DO NOT include [IMAGE] features unless the user explicitly provides an image link in markdown format (![ ](url)) - in that case, preserve it exactly as provided
- If user mentions "list", include "[LIST]: [description]" in relevant checklist items, specifying whether it should be a bulleted list (unordered) or numbered list (ordered) based on the content type
- If user mentions "block quote" or "blockquote", include "[BLOCKQUOTE]: [entity fact description]" in relevant checklist items, but remember MAXIMUM 1-2 block quotes per entire blueprint
- If user mentions specific content requirements, explicitly state them in the checklist items
- Add a note like "Note: User specified [requirement]" when incorporating user requirements
- If user provides exact URLs or links in tables, preserve them exactly as provided`
  : "No specific user requirements provided."}

CRITICAL FORMAT REQUIREMENT:
Format your response as a numbered list, one item per line. Each item should be a clear, actionable instruction with explicit feature requirements.

Example format (NOTE: This example shows ALL 3 MANDATORY elements - 1 TABLE, 1 NUMBERED LIST, 1 BULLETED LIST - distributed across sections):
1. Create a first section agent with a SEO-friendly, descriptive header (NEVER use "Introduction", "Intro", "Understanding [Topic]", or "Navigating [Topic]" - use active titles like "Why [Topic] Matters", "[Topic]: Key Rules", or "Complete Guide to [Topic]"). [STRUCTURE]: 3 short split paragraphs (each paragraph should be 2-3 sentences only, keep paragraphs concise and well-spaced). **FOCUS KEYWORD AT START (focus keyword)**: The first paragraph (or first 1-2 sentences) MUST include the Focus Keyword (or a natural variation) near the beginning. **[EXACT PRIMARY PER H2]**: Include the **exact** Primary Keyword phrase **at least once** in this H2's body. **[FOCUS KEYWORD DENSITY]**: Target **minimum ~1.0%** focus keyword density across the **full** article (exact phrase + combinations) - **not ~0.5%**. ${entityWikiUrl && entityName ? `[EXTERNAL_WIKI]: Link "${entityName}" to ${entityWikiUrl} (mandatory Wikipedia). ` : ""}[LINK]: Minimal linking - ${entityWikiUrl && entityName ? `include the mandatory entity Wikipedia link above and ` : `link the entity name to its Wikipedia page (if entity exists) and `}the main service/product name to its service page. Do NOT include excessive links - keep the opening section clean and readable. Note: Distribute focus-keyword usage across sections; write natural sentences. Note: Do NOT create sublists, bullet lists, or 'Key Features' lists unless the [LIST] feature is explicitly specified in this checklist item. Write content in flowing paragraphs only. Only include lists when [LIST] is explicitly mentioned as a feature requirement.
2. Create an agent for H2 "${selectedH2Sections[0] || "Section 1"}". **[EXACT PRIMARY PER H2]**: **Exact** Primary Keyword phrase **≥1×** in this section's body. [STRUCTURE]: 1-2 paragraphs, include **[TABLE]: Feature comparison table** (MANDATORY - every blog needs at least 1 table). [LINK]: 3-5 internal links with varied anchor text (natural descriptive phrases like "learn more about humidity-resistant options", branded like "our showroom", keyword-rich where appropriate). [REAL-WORLD EXAMPLE]: Include natural expertise statement demonstrating hands-on experience (e.g., "After installing hundreds of systems in the local area, we've found that..."). **[FOCUS KEYWORD DENSITY]**: Contribute to **~1%+** combined focus-keyword presence across the post. Vary location mentions (use broader geographic terms, not exact location repeatedly). IMPORTANT: Use ONLY generic city names - NEVER use specific neighborhoods or directional qualifiers. Avoid repetitive keyword patterns in one paragraph.
3. Create an agent for H2 "${selectedH2Sections[1] || "Section 2"}". **[EXACT PRIMARY PER H2]**: **Exact** Primary Keyword phrase **≥1×** in this section's body (any H3 under this H2 counts). [STRUCTURE]: **max 2 H3** subheadings with **1-2 short paragraphs** under each covering [specific subtopics]. **H3 FEATURES**: Each H3 can include [LINK]: 1-2 internal links, [LIST]: Bulleted or Numbered lists, and [TABLE] where appropriate - distribute these across H3s. [LINK]: 1-2 internal links to other blog posts with natural anchor text variety. Note: Use partial keyword matches and semantic equivalents while keeping overall focus keyword density **≥ ~1%**. Vary location references (use "local area", "regional", "local homes" - mix exact location name sparingly with broader terms). IMPORTANT: Use ONLY generic city names (e.g., "Edmonton", "New York") - NEVER use specific neighborhoods or directional qualifiers. Write as a human expert would, not as SEO software generates.
4. Create an agent for H2 "${selectedH2Sections[2] || "Section 3"}". **[EXACT PRIMARY PER H2]**: **Exact** Primary Keyword phrase **≥1×** in this section's body. [STRUCTURE]: 1-2 paragraphs, include **[LIST]: Numbered list of key steps** (MANDATORY - every blog needs at least 1 numbered list for processes/rankings/sequences). [LINK]: 3-5 internal links using descriptive, natural anchor text (mix branded and keyword-rich). Note: If focus density is thin, add natural focus-keyword/combination mentions in this section toward **~1%** total. Use location variation naturally (broader geographic terms frequently, exact location name sparingly). IMPORTANT: Use ONLY generic city names - NEVER use specific neighborhoods or directional qualifiers. Note: This checklist item explicitly includes [LIST] feature, so a numbered list IS required here.
5. Create an agent for H2 "${selectedH2Sections[3] || "Section 4"}". **[EXACT PRIMARY PER H2]**: **Exact** Primary Keyword phrase **≥1×** in this section's body. [STRUCTURE]: 1-2 paragraphs, include **[LIST]: Bulleted list of features/benefits** (MANDATORY - every blog needs at least 1 bulleted list for items/features/benefits). [LINK]: 3-5 internal links with varied anchor text types (natural descriptive, branded, keyword-rich). Note: Natural content - avoid stuffing one paragraph; **still** meet **[FOCUS KEYWORD DENSITY]** **~1%+** across the full article. Mix location references (exact name rare, broader region common, general area frequent). IMPORTANT: Use ONLY generic city names - NEVER use specific neighborhoods or directional qualifiers. Note: This checklist item explicitly includes [LIST] feature, so a bulleted list IS required here.${options.entity && options.entity.trim() ? `\n6. Create an agent for H2 "${selectedH2Sections[4] || "Section 5"}". **[EXACT PRIMARY PER H2]**: **Exact** Primary Keyword phrase **≥1×** in this section's body. [STRUCTURE]: 1-2 paragraphs, include [BLOCKQUOTE]: Entity fact about ${options.entity.trim()}. [LINK]: 3-5 internal links using natural anchor text variety. Note: **[FOCUS KEYWORD DENSITY]**: whole-article **~1%+** focus keyword presence. Vary location mentions (use broader geographic terms frequently, exact location name sparingly - 2-3 times maximum). IMPORTANT: Use ONLY generic city names - NEVER use specific neighborhoods or directional qualifiers. Use semantic variations and natural phrasing throughout. (Note: Only use 1-2 block quotes maximum per blueprint)` : ''}

Output ONLY the numbered checklist items, no additional text or explanations.`;

  // Detect if this is an entity page (has entity parameter)
  const isServiceArea = !!options.entity;

  let userPrompt = `Generate a focused checklist for creating a blog template blueprint.

${buildArticleLengthChecklistBlock(isServiceArea)}

CRITICAL: Weave keywords elegantly into content using natural, human-like syntax. Keywords should flow organically within sentences. **Focus keyword**: The checklist MUST state **[FOCUS KEYWORD DENSITY]**: **minimum ~1.0%** focus keyword density (exact phrase + counted combinations), **not ~0.5%** - distribute across the article. **EXACT PRIMARY PER H2**: The checklist MUST state that the **exact** Primary Keyword phrase appears **at least once in the body of every H2** (intro, each topic H2, conclusion, mandatory H2s). Use semantic variations where they help readability; if a phrase feels forced in one spot, place the **exact** primary phrase in another sentence within that same H2.

**PARAGRAPH LENGTH**: The checklist MUST state **[PARAGRAPH LENGTH]** - **moderately short** paragraphs (**~2–4 sentences** typical); **split** long blocks (avoid “paragraph is long” warnings); **do not** use only one-sentence paragraphs throughout (too choppy).

CRITICAL LOCATION VARIATION: Vary location mentions naturally - do NOT repeat exact location name repeatedly (e.g., "Edmonton" over and over). Use exact location name sparingly (2-3 times maximum in entire article). Use broader geographic terms frequently (regional, local, area). IMPORTANT: Use ONLY generic city names (e.g., "Edmonton", "New York", "Toronto") - NEVER use specific neighborhoods or directional qualifiers (e.g., "West Edmonton", "North Toronto", "East New York"). Mix location references: exact name (rare), broader region (common), general area (frequent). Example: Instead of "Edmonton home" repeatedly, use "local area home", "regional residence", "Edmonton properties" (varied).

MANDATORY REAL-WORLD EXAMPLES: Include [REAL-WORLD EXAMPLE] in at least one section (Benefits, Features, or How-To work best). Add authentic expertise statements demonstrating hands-on experience - examples: "After installing hundreds of systems in [location variation], we've found..." or "Our experience serving [broader area] has shown..." or "Having worked with [location variation] homeowners for over [time period], we've learned..." Make it sound specific and genuine, not generic.
${isServiceArea ? `\n\n--- MANDATORY SERVICE AREA REQUIREMENTS ---
CRITICAL: This is a SERVICE AREA page. You MUST include the following three sections in the checklist:

1. "What We Offer" Section (MANDATORY):
   - Create a dedicated agent for a section titled "What We Offer" (or similar variation like "Our Services" or "What We Provide")
   - [STRUCTURE]: 1-2 short paragraphs introducing the services/products offered
   - [TABLE]: Create a **compact** table listing **top** products and services (not every offering). The table should have ONLY TWO columns: Product Category or Service/Product Name (with internal link embedded in the name itself), and Key Benefits or Description (one short sentence each)
   - [LINK]: Every product/service name in the first column MUST link to a **Pages bucket** URL only (WordPress pages inventory below). Use HTML format in generated content: <a href="EXACT_URL" title="EXACT_PAGE_TITLE">anchor text</a> - **title attribute is mandatory** on every table link. Never link table rows to blog posts or entity/service-area URLs.
   - Match each row label to the closest page title from the Pages inventory list when provided. Copy href and title character-for-character from that list.
   - **ABSOLUTELY FORBIDDEN: NEVER use formats like [URL: https://...] or [url: ...] - these are NOT proper markdown links and will be removed. Links must be in proper markdown format: [anchor text](url)**
   - **ABSOLUTELY FORBIDDEN: NEVER append links at the end of table cell descriptions like "...description. [URL: https://...]" - links must be integrated contextually into the text, not appended**
   - Keep the table scannable and brief (roughly 4-8 rows); counts toward the ${ARTICLE_MAX_WORDS}-word cap
   - Use natural, descriptive language for service/product names and descriptions
   - Ensure the table is well-organized and easy to scan
   - CRITICAL: The table must have exactly TWO columns: "Service/Product Name" (with embedded links) and "Description" - NO separate link column
   - **ABSOLUTELY FORBIDDEN: NEVER create a column with headers like 'Relevant Internal Links', 'Links', 'Link', 'Direct Link', 'View Product', or ANY column that serves only to display links. Links must be contextually integrated into the content columns (like embedding links in product names or descriptions) for better SEO.**

2. "We Care About [Entity]" + MAIN TOPICS AS H2s (MANDATORY):
   - Create ONE short agent "We Care About ${options.entity || '[Location/Entity]'}" (1-2 paragraphs + short bullet list). NO H3s. Place after introduction.
   - Merge overlapping topics into fewer H2s (pick the 2-3 strongest main topics only). Each major concept = its own H2 agent when essential. Do NOT nest "What is" or "Core Principles" under "We Care About" as H3s.
   - CRITICAL: Every agent for a main topic MUST use headingLevel: 1 in the blueprint JSON, which renders as H2. NEVER use headingLevel: 2 (H3) for main topics. The ONLY things that should be H3 are sub-sections WITHIN an H2 agent (via h3Enabled/h3Count).
   - [LIST]: "We Care About" section: bullet list explaining local market knowledge and how we serve businesses in the area.
   - [LINK]: 3-5 internal links per section.
   - Use natural, authentic language throughout

3. "Next Steps" Section (MANDATORY):
   - Create a dedicated agent with a CUSTOMER SERVICE AGENT persona for a section titled "Next Steps" (or similar variations like "How to Get Started", "Book Your Appointment", "Take the Next Step")
   - [AGENT PERSONA]: Write from the perspective of a friendly, helpful customer service representative who guides prospective clients through the booking/appointment process
   - [STRUCTURE]: 1-2 introductory paragraphs written in a warm, welcoming customer service tone that invites prospective clients to take action
   - [LIST]: Create a NUMBERED list (ordered list) of 3-4 clear, actionable steps that a prospective client can take to book an appointment or get started. Each step should be specific and easy to follow. Examples: "1. Call our office at [phone number] during business hours", "2. Fill out our online contact form on our website", "3. Schedule a consultation through our booking system", etc.
   - Use encouraging, supportive language that makes the process feel simple and accessible
   - Include specific contact methods (phone, online form, booking link, etc.) when available
   - [LINK]: 2-3 internal links to relevant pages (contact page, booking page, appointment scheduling page, etc.)
   - Make it feel like a helpful guide from a customer service representative who genuinely wants to help clients get started

These three sections are MANDATORY and must be included in the checklist regardless of other H2 sections selected.` : ""}

Blog Details:
- Title: "${title}"
- H2 Sections to cover: ${selectedH2Sections.join(", ")}
- Primary Keyword: "${primaryKeywordProper}"
- Related Keywords: ${selectedKeywordsProper.slice(0, 5).join(", ")}
${paaQuestions.length > 0 ? `- People Also Ask (flo-faq append only, not body H2s): ${paaQuestions.map(p => `"${p.question}"`).join(", ")}` : ""}

Requirements:
1. Create ${isServiceArea ? "6-7" : "5-6"} checklist items maximum: introduction-style first H2, ${isServiceArea ? "'What We Offer', 'We Care About [Entity]', 2-3 body topics, 'Next Steps'," : "3-4 body topics,"} conclusion. **DEPTH IN FEWER H2s**: Cover main topics in fewer, tighter sections. One H2 per major topic when essential - NOT nested as H3s. Meet SEO with concise copy, not extra sections.
2. Each checklist item must include:
   - [STRUCTURE]: Use 1-2 paragraphs per H2 (each paragraph **moderately short**: **~2–3 sentences**; split long blocks). If more content is needed, use H3 subheadings: "[STRUCTURE]: Include at most 2 H3 subheadings with 1-2 short paragraphs under each covering [specific subtopics]"
   - **DEPTH**: Main topics = H2 agents when essential. H3 = only for minor subtopics under an H2. **MAX 2 H3s** per H2.
   - **[ARTICLE LENGTH]**: Entire published article MUST NOT exceed ${ARTICLE_MAX_WORDS} words.
   - Mix content types: Include [TABLE] or [LIST] where appropriate for variety. For lists, suggest both bulleted lists (unordered) and numbered lists (ordered) depending on the content type - use numbered lists for step-by-step processes, rankings, or sequences, and bulleted lists for features, benefits, or general items. For entity facts, you can creatively use [BLOCKQUOTE]: [entity fact description], but MAXIMUM 1-2 block quotes per entire blueprint
   - ${semrushParts.hasSemrushExactMode
      ? `**[LINK] + [EXTERNAL_SEMRUSH]**: MANDATORY for EVERY section. **${LINK_FEATURE_PLACEHOLDER}**. **[EXTERNAL_SEMRUSH]**: at least 1 outbound citation per section - exact href from SEMRUSH APPROVED EXTERNAL URLs and exact anchor from SEMRUSH APPROVED ANCHOR PHRASES in the system prompt. Spread citations across many sections (majority of H2 items); rotate different Semrush URLs.`
      : "**[LINK]: 3-5 internal links to other blog posts/pages** - This is MANDATORY for EVERY section. Use anchor text with keywords integrated naturally into sentences. Link to related blog posts, service pages, and relevant content from knowledge files. Every H2 and H3 section MUST have internal links."}
   - CRITICAL: Always add a note in each checklist item including **[FOCUS KEYWORD DENSITY]**, **[EXACT PRIMARY PER H2]**, and **[PARAGRAPH LENGTH]**: **minimum ~1.0%** focus keyword density across the **full article**; **exact** Primary Keyword **≥1× per H2** body; paragraphs **moderately short** (**~2–4 sentences**), **not** long walls of text, **not** all one-sentence choppiness. **Do not** aim for **~0.5%** when the target is **~1%** or higher. Also note: natural, conversational language - avoid stuffing **one** paragraph; **distribute** focus-keyword usage across intro, H2s, body, conclusion. Mix anchor text: 50% natural descriptive, 30% branded, 20% keyword-rich."
   - CRITICAL: PREVENT UNNECESSARY SUBLISTS: Explicitly state in each checklist item: "Note: Do NOT create sublists, bullet lists, or 'Key Features' lists unless the [LIST] feature is explicitly specified in this checklist item. Write content in flowing paragraphs only. Only include lists when [LIST] is explicitly mentioned as a feature requirement."
3. Distribute keywords naturally across sections - semantic variations **and** enough exact/combination usage to hit **[FOCUS KEYWORD DENSITY] ~1%+** (not ~0.5%)
4. **FOCUS KEYWORD DENSITY (NON-NEGOTIABLE IN CHECKLIST)**: Every checklist must explicitly require **minimum ~1.0%** focus keyword density (exact phrase + word-order combinations). Avoid **~0.5%** totals when the target is **~1%** or higher. Avoid stuffing one paragraph: **spread** mentions across the article. Mix anchor text types (descriptive, branded, keyword-rich).
5. **EXACT PRIMARY PER H2 (NON-NEGOTIABLE)**: Every checklist item that defines an **H2** section must require the **exact** Primary Keyword string (**"${primaryKeywordProper}"** / same words and order as **Primary Keyword**) **at least once** in that section's body copy - **every** H2 including intro and conclusion. State it explicitly as **[EXACT PRIMARY PER H2]** in each such item.
6. Include first section and conclusion agents. For the first section agent: **CRITICAL - NEVER use "Introduction", "Intro", "Understanding [Topic]", or "Navigating [Topic]" as the header**. Use an active, SEO-friendly header like "Why [Topic] Matters", "[Topic]: Key Rules", or "Complete Guide to [Topic]". [STRUCTURE]: 2 short paragraphs (each paragraph should be 2-3 sentences only, keep paragraphs concise and well-spaced). **FOCUS KEYWORD AT START (focus keyword)**: The first paragraph (or first 1-2 sentences) MUST include the Focus Keyword (or a natural variation) near the beginning. **[EXACT PRIMARY PER H2]**: **Exact** Primary Keyword phrase **≥1×** in this H2's body. ${semrushParts.hasSemrushExactMode ? `${LINK_FEATURE_PLACEHOLDER}. [EXTERNAL_SEMRUSH]: at least 1 Semrush outbound citation (exact href + anchor from SEMRUSH blocks). Keep prose readable - integrate links naturally.` : "[LINK]: Minimal linking - only link the entity name to its Wikipedia page (if entity exists) and the main service/product name to its service page. Do NOT include excessive links - keep the opening section clean and readable."} For the conclusion agent: [STRUCTURE]: 1-2 paragraphs; **[EXACT PRIMARY PER H2]** applies to the conclusion H2 as well.${semrushParts.hasSemrushExactMode ? " [LINK] + [EXTERNAL_SEMRUSH] as in other sections." : ""}
7. CRITICAL: Include [REAL-WORLD EXAMPLE] in at least one section (Benefits, Features, or How-To work best). Add authentic expertise statements demonstrating hands-on experience - examples: "After installing hundreds of systems in [location variation], we've found..." or "Our experience serving [broader area] has shown..." Make it sound specific and genuine, not generic
8. **MANDATORY CONTENT STRUCTURE ELEMENTS (NON-NEGOTIABLE)** - Every blog MUST include ALL THREE of the following elements to break up text and improve readability:
   - **AT LEAST 1 TABLE**: You MUST include [TABLE] in at least one section. Use for comparisons, features, specifications, or data. When comparing Pros/Cons or Manual vs Motorized: use an HTML table (<table><thead><tr><th>Pros</th><th>Cons</th></tr></thead><tbody>...</tbody></table>), NOT Pros/Cons sub-headings with bullet lists. NEVER markdown tables.
   - **AT LEAST 1 BULLETED LIST (Unordered)**: You MUST include [LIST]: Bulleted list in at least one section. Use for features, benefits, items, or options. Example: "[LIST]: Bulleted list of key benefits"
   - **AT LEAST 1 NUMBERED LIST (Ordered)**: You MUST include [LIST]: Numbered list in at least one section. Use for step-by-step processes, rankings, or sequences. Example: "[LIST]: Numbered list of installation steps"
   - These THREE elements are MANDATORY and non-negotiable. A blog without all three is INCOMPLETE.
   - Distribute them across DIFFERENT sections for variety - do not put all three in one section.
   - With only 5-7 sections total, one of each element type is sufficient; do not add extra sections just for structure.
   - **VALIDATION**: Before submitting your checklist, verify that you have included at least 1 [TABLE], 1 [LIST]: Bulleted list, and 1 [LIST]: Numbered list across your sections.${semrushParts.hasSemrushExactMode ? " Also verify every checklist item includes both [LINK] (internal) and [EXTERNAL_SEMRUSH] (Semrush outbound)." : ""}`;
  
  // Add user prompt modifier if provided - emphasize it must be explicitly referenced
  if (options.userPrompt && options.userPrompt.trim()) {
    userPrompt += `\n\n--- CRITICAL: USER-SPECIFIED REQUIREMENTS ---\n${options.userPrompt.trim()}\n\nYou MUST explicitly incorporate these requirements in the checklist items. CRITICAL RULES:
- If the user provides an EXACT MARKDOWN TABLE (with | columns | and rows), you MUST include the COMPLETE table structure in the checklist item, preserving the exact markdown format, all column headers, all row data, and any URLs/links within the table cells
- If the user provides an EXACT IMAGE MARKDOWN LINK (![ ](url)), you MUST include the COMPLETE markdown image format in the checklist item exactly as provided
- If the user mentions specific features (tables, lists, links, markdown tables, block quotes, etc.), you MUST explicitly state them in the relevant checklist items with the proper feature format ([TABLE], [LIST], [LINK], [BLOCKQUOTE]). For lists, specify whether it should be a bulleted list (unordered) or numbered list (ordered) based on the content type. For block quotes, remember MAXIMUM 1-2 per entire blueprint, use for entity facts
- DO NOT include [IMAGE] features unless the user explicitly provides an image link in markdown format
- Add notes like "Note: User specified [requirement]" when incorporating user requirements
- Preserve exact URLs, links, and markdown formatting from user input`;
  }
  
  // Always add link requirements (Semrush mode: internal + outbound; otherwise internal-only unless keywords branch adds detail)
  if (semrushParts.hasSemrushExactMode) {
    userPrompt += `\n\n--- MANDATORY: INTERNAL + SEMRUSH OUTBOUND IN EVERY CHECKLIST ITEM (NON-NEGOTIABLE) ---
- **EVERY numbered checklist item** must explicitly include BOTH: (1) "${LINK_FEATURE_PLACEHOLDER}", AND (2) "[EXTERNAL_SEMRUSH]" requiring at least one outbound citation drawn **only** from the numbered SEMRUSH APPROVED EXTERNAL URLs / ANCHOR PHRASES blocks in the system prompt.
- **ZERO HALLUCINATED EXTERNAL URLS**: Do NOT type any third-party https:// URL in the checklist unless it is a **verbatim copy** from the SEMRUSH APPROVED EXTERNAL URLs list. **FORBIDDEN**: invented URLs, "e.g." external links, competitor domains, or plausible-looking URLs not in the list. **ALLOWED**: paste URL(s) exactly from the list, OR write "use SEMRUSH approved URL #N with anchor phrase #N" with no URL string.
- **Spread outbound links**: the majority of sections (at least half of H2 items, or 6+ items when the checklist is long) must mention [EXTERNAL_SEMRUSH]. Use **different Semrush list indices** across sections where possible.
- **FORBIDDEN**: Checklist lines that only say "internal links" or "WordPress URLs only" without [EXTERNAL_SEMRUSH] when SEMRUSH data is in the system prompt.
- **H3 SUBSECTIONS**: When a section uses H3s, at least one H3 block should still include an [EXTERNAL_SEMRUSH] citation where natural (same no-hallucination rule).
- **VALIDATION**: Before submitting, count that every item has both [LINK] and [EXTERNAL_SEMRUSH] stated, and that **no third-party URL appears unless copied from the Semrush list**.${selectedKeywords.length > 0 ? `\n- Selected keywords for internal anchor text variety: ${selectedKeywords.join(", ")}` : ""}`;
  } else if (selectedKeywords.length > 0) {
    userPrompt += `\n\n--- MANDATORY: INTERNAL LINK REQUIREMENTS FOR ALL SECTIONS (NON-NEGOTIABLE) ---
- **CRITICAL - EVERY SECTION MUST HAVE 3-5 INTERNAL LINKS**: This is NON-NEGOTIABLE. Every H2 section and every H3 subsection MUST include "[LINK]: 3-5 internal links to other blog posts/pages"
- Internal links connect to OTHER blog posts and pages on the same website - they are CRITICAL for SEO and user navigation
- Link to related blog articles, service pages, product pages, and category pages using natural anchor text
- Distribute keywords naturally in anchor text: vary phrasing; do not use the **same** anchor text on every link. Mix anchor text types: 50% natural descriptive phrases, 30% branded text, 20% keyword-rich. Whole-article focus keyword density must still meet **[FOCUS KEYWORD DENSITY] ~1%+** (see Requirements above)
- Selected keywords for anchor text: ${selectedKeywords.join(", ")}
- **H3 SECTIONS ALSO NEED LINKS**: When a section has H3 subheadings, each H3 should also have 3-5 internal links distributed throughout
- **VALIDATION**: Before generating the checklist, count the [LINK] requirements - every section must have one specifying 3-5 internal links`;
  } else {
    userPrompt += `\n\n--- MANDATORY: INTERNAL LINK REQUIREMENTS FOR ALL SECTIONS (NON-NEGOTIABLE) ---
- **CRITICAL - EVERY SECTION MUST HAVE 3-5 INTERNAL LINKS**: This is NON-NEGOTIABLE. Every H2 section and every H3 subsection MUST include "[LINK]: 3-5 internal links to other blog posts/pages"
- Internal links connect to OTHER blog posts and pages on the same website (e.g., "/blog/related-article", "/services/service-page") - they are CRITICAL for SEO
- Link to related blog articles, service pages, product pages, and relevant content using natural anchor text
- **H3 SECTIONS ALSO NEED LINKS**: When a section has H3 subheadings, each H3 should also have 3-5 internal links distributed throughout
- **CRITICAL: NEVER use external links** - ONLY use links from WordPress posts list. If no relevant WordPress post exists, do NOT create a link.
- **VALIDATION**: Before generating the checklist, count the [LINK] requirements - every section must have one specifying 3-5 internal links`;
  }
  
  if (options.wordPressPagesForOfferTable?.length) {
    const pageLines = options.wordPressPagesForOfferTable
      .slice(0, 40)
      .map((p, i) => `${i + 1}. "${(p.title || p.slug).replace(/"/g, "'")}" | ${p.link}`)
      .join("\n");
    userPrompt += `\n\n--- PAGES INVENTORY (What We Offer table ONLY) ---
Use ONLY these WordPress **pages** URLs for the What We Offer / Product Category table first column links.
Format each link as <a href="EXACT_URL" title="EXACT_PAGE_TITLE">product name</a> (title attribute required).
Do NOT use blog posts or entity/service-area URLs in that table.

${pageLines}
=== END PAGES INVENTORY ===`;
  }

  // Add self-link prevention instruction if currentPageUrl is provided
  if (options.currentPageUrl) {
    userPrompt += `\n\n--- CRITICAL: NEVER SELF-LINK ---
- When optimizing an existing post, NEVER link the post's URL to itself in the content
- The current page URL (${options.currentPageUrl}) must NEVER appear in any internal link suggestions
- Self-referential links are bad for SEO and must be completely avoided
- Only suggest links to OTHER pages/posts, never to the current page being optimized
- This applies to ALL checklist items that mention links or internal links`;
  }

  const allKeywords = [keywordData.keyword, ...selectedKeywords].filter(Boolean);
  const MAX_CHECKLIST_ATTEMPTS = 3;
  const MIN_CHECKLIST_ITEMS = 3;

  for (let attempt = 1; attempt <= MAX_CHECKLIST_ATTEMPTS; attempt++) {
    let fullResponse = "";
    let checklistFinishReason: string | undefined;

    try {
      const streamResult = await streamChatCompletion({
        apiKey,
        model,
        messages: [
          { role: "system", content: appendUniversalContentRulesToSystemPrompt(systemPrompt) },
          { role: "user", content: userPrompt },
        ],
        contentHarness: true,
        temperature,
        maxTokens,
        topP,
        onContentChunk: (chunk) => {
          fullResponse += chunk;
        },
        onFinishReason: (reason) => {
          checklistFinishReason = reason;
        },
      });

      const parsed = parseBlogTemplateChecklist(fullResponse, allKeywords);

      const effectiveFinish = checklistFinishReason || streamResult.finishReason;
      if (parsed.length >= MIN_CHECKLIST_ITEMS) {
        return parsed;
      }

      console.warn(`[Checklist] Attempt ${attempt}/${MAX_CHECKLIST_ATTEMPTS}: only ${parsed.length} items (finishReason=${effectiveFinish}, len=${fullResponse.length}). ${attempt < MAX_CHECKLIST_ATTEMPTS ? 'Retrying...' : 'Using best result.'}`);

      if (attempt === MAX_CHECKLIST_ATTEMPTS) {
        return parsed;
      }

      await new Promise(r => setTimeout(r, 2000 * attempt));
    } catch (error) {
      console.error(`[Checklist] Attempt ${attempt} error:`, error);
      if (attempt === MAX_CHECKLIST_ATTEMPTS) {
        throw new Error(
          `Failed to generate checklist: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }

  return [];
}

/**
 * Generates a blueprint JSON from template checklist
 */
export async function generateBlueprintFromTemplate(
  checklist: string[],
  context: BlogTemplateContext,
  options: {
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    connectedSite?: { name: string; siteUrl: string };
    wordPressPosts?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>;
    currentPageUrl?: string; // URL of the page currently being optimized
    semrushKeywordsContext?: string;
    semrushScatterContext?: string;
    semrushApprovedExternalUrls?: string[];
    semrushAnchorPhrases?: string[];
    importedDraftLinks?: ImportedDraftLink[];
    modifierExternalLinks?: ModifierExternalLink[];
    userExternalLinks?: ExternalLinkPair[];
    wikipediaUrl?: string;
    wikipediaTitle?: string;
  }
): Promise<{ title?: string; purpose?: string; agents: AgentConfig[] }> {
  const {
    apiKey,
    model = getResearchModel(),
    temperature = 1.0,
    maxTokens = 8000,
    topP = 0.9,
  } = options;

  const userPromptSection = context.userPrompt && context.userPrompt.trim()
    ? `\n--- PROMPT MODIFIER (PRIMARY FOCUS FOR THIS BLOG) ---
${context.userPrompt.trim()}

**CRITICAL**: This modifier is the PRIMARY focus for the entire blog. The article title MUST clearly reflect this focus. Section content (body copy) should tie back to the theme so the blog stays on-topic. **AVOID KEYWORD STUFFING**: Do NOT repeat the modifier phrase in every section heading. Vary agent titles - some headings can imply the theme without repeating the exact phrase; others can be topic-specific. Only one or two headings may explicitly name the focus if it fits naturally; the rest should stay relevant through content, not by stuffing the phrase into every H2. Do not output a generic title or generic agent copy that ignores the modifier.
--- END PROMPT MODIFIER ---`
    : "";

  const prefilledRowContractSection = context.prefilledRowContract?.trim()
    ? `\n${context.prefilledRowContract.trim()}\n`
    : "";

  // Normalize siteUrl: remove trailing slash to prevent double slashes in links
  const normalizedSiteUrlForBlueprint = options.connectedSite?.siteUrl ? options.connectedSite.siteUrl.replace(/\/+$/, '') : '';
  
  const targetSiteContext = options.connectedSite
    ? `\n=== TARGET SITE CONTEXT ===
Target Website: ${options.connectedSite.name} (${normalizedSiteUrlForBlueprint})

IMPORTANT: This website is the target topic for all generated content. Use information about this site as a source of truth for generating relevant, on-brand blog blueprints. However, do NOT use the site name as an entity - use it only to inform the topics, tone, and context of the content.

All generated blueprint agents and content should be relevant to ${options.connectedSite.name} and aligned with its content focus, audience, and brand positioning. Ensure all blueprint suggestions are suitable for publication on ${options.connectedSite.name}.
=== END TARGET SITE CONTEXT ===
`
    : "";

  // Get WordPress posts from cache if siteId and primaryKeyword provided, otherwise use provided wordPressPosts
  let postsToUse: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }> = [];
  
  if ((options as any).siteId && (options as any).primaryKeyword) {
    // Try to use cache search
    try {
      const cache = getSiteCache((options as any).siteId);
      if (cache) {
        // Search cache for relevant posts based on primary keyword
        const searchResults = searchSiteCache((options as any).siteId, (options as any).primaryKeyword, 50);
        postsToUse = searchResults.map(p => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          link: p.link,
          date_gmt: p.date_gmt
        }));
        console.log(`[Blog Template Builder] Using ${postsToUse.length} posts from cache search for keyword: ${(options as any).primaryKeyword}`);
      } else {
        // Fallback to provided wordPressPosts if cache not available
        postsToUse = options.wordPressPosts || [];
        console.log(`[Blog Template Builder] Cache not available, using provided wordPressPosts (${postsToUse.length} posts)`);
      }
    } catch (error) {
      console.warn('[Blog Template Builder] Error using cache, falling back to provided wordPressPosts:', error);
      postsToUse = options.wordPressPosts || [];
    }
  } else {
    // Use provided wordPressPosts
    postsToUse = options.wordPressPosts || [];
  }

  const wordPressPostsContext = postsToUse.length > 0
    ? `\n=== WORDPRESS POSTS SOURCE (CRITICAL FOR INTERNAL LINKS) ===
Available WordPress Posts from ${options.connectedSite?.name || 'target site'} (${postsToUse.length} total${(options as any).siteId && (options as any).primaryKeyword ? ` - filtered by keyword: ${(options as any).primaryKeyword}` : ''}):

${postsToUse.slice(0, 30).map((post, idx) => {
  // Handle excerpt that might be string or object with rendered property (limit to essential stats)
  let excerptText = '';
  if (typeof post.excerpt === 'string') {
    excerptText = post.excerpt;
  } else if (typeof post.excerpt === 'object' && post.excerpt && 'rendered' in post.excerpt) {
    excerptText = (post.excerpt as { rendered?: string }).rendered || '';
  } else {
    excerptText = '';
  }
  const cleanExcerpt = (excerptText || '').replace(/<[^>]+>/g, '').substring(0, 80);
  return `${idx + 1}. "${post.title}"${cleanExcerpt ? ` - ${cleanExcerpt}` : ''}\n   URL: ${post.link || post.slug}`;
}).join('\n\n')}

**ABSOLUTELY CRITICAL REQUIREMENT FOR INTERNAL LINKS (NO EXCEPTIONS)**:
- When the checklist mentions "[LINK]: 3-5 internal links to [topic]", you MUST ONLY suggest links that EXIST EXACTLY in the WordPress posts list above
- **NEVER create, invent, fabricate, construct, or hallucinate links** - If a link is not EXACTLY in the WordPress posts list above, you MUST NOT use it
- **NEVER construct URLs by guessing paths** - Do NOT create links like "/blog/some-topic" or "/service-area/city" unless that EXACT URL exists in the WordPress posts list above
- **CRITICAL**: Copy the EXACT URL from the WordPress posts list - do NOT modify, construct, or guess URLs
- If no relevant post exists for a topic, do NOT suggest an internal link for that topic - simply skip linking for that section
- Only use real URLs from the posts listed above - copy them EXACTLY as shown
- **VALIDATION**: Before including any link in the checklist, verify it exists EXACTLY in the WordPress posts list above - if it's not there, DO NOT use it

**CRITICAL: COMPETITOR LINK EXCLUSION**:
- NEVER suggest links to competitor websites in checklist items
- A competitor is any website in the same industry/business category offering similar products or services as the target site
- If a WordPress post or external link points to a competitor's website (different domain, same industry), you MUST NOT suggest it
- Only suggest links to: (1) the target site itself (internal links), (2) authoritative non-competitor sources, or (3) manufacturer/supplier websites that are not direct competitors
=== END WORDPRESS POSTS SOURCE ===\n`
    : "";

  const entityOption = (options as any).entity as string | undefined;
  const blueprintWikiUrl = options.wikipediaUrl?.trim();
  const blueprintWikiTitle = options.wikipediaTitle?.trim();
  const entityWikiBlueprintSection =
    entityOption && blueprintWikiUrl
      ? formatMandatoryEntityWikipediaForPrompt({
          entity: entityOption,
          wikipediaUrl: blueprintWikiUrl,
          wikipediaTitle: blueprintWikiTitle,
        })
      : "";
  const entityTitleRule = entityOption
    ? `\n*** TARGET ENTITY: ${entityOption} ***
The title MUST include the word "near" (e.g. "Blinds & Shades Near ${entityOption}").
No colons in titles. The word "near" is MANDATORY.
${entityWikiBlueprintSection}`
    : "";

  const isGSCReport =
    (context.flowPurpose?.toLowerCase().includes('seo performance') || context.flowPurpose?.toLowerCase().includes('performance report')) ||
    (context.flowTitle?.toLowerCase().includes('search performance') || context.flowTitle?.toLowerCase().includes('seo performance'));

  const currentPageContextForBlueprint = options.currentPageUrl
    ? `\n=== CRITICAL: CURRENT PAGE BEING OPTIMIZED ===
Current Page URL: ${options.currentPageUrl}

**ABSOLUTELY CRITICAL - NEVER SELF-LINK**:
- This is the URL of the existing post/page currently being optimized
- NEVER link this URL to itself in the content
- NEVER include this URL in any internal link suggestions in agent features
- NEVER reference this URL in blueprint agent descriptions or features
- Self-referential links (linking a page to itself) are bad for SEO and must be avoided
- When suggesting internal links in agent features, exclude this URL from all link suggestions
- Only suggest links to OTHER pages/posts, never to this current page

**RE-OPTIMIZED TITLE (existing post)**:
- This is an existing post being re-optimized. The "title" field in the blueprint MUST be a re-optimized, SHORTER, and more concise version (max 50 characters).
- Do NOT copy the existing title (Flow Context Title above) verbatim. Create a shorter, keyword-focused alternative.
- Content Optimizer module requirement: MAXIMUM 50 characters - NO EXCEPTIONS.

This instruction applies to ALL agent features that mention links or internal links.
=== END CURRENT PAGE CONTEXT ===\n`
    : "";

  const semrushKeywordsBlueprintBlock = options.semrushKeywordsContext?.trim()
    ? `\n--- Semrush keyword research (JSON) ---
Use for topical coverage and intent only. Do NOT paste raw JSON into the blueprint output. Spread phrasings naturally across agents.
${options.semrushKeywordsContext}
`
    : "";

  const semrushScatterBlueprintBlock = options.semrushScatterContext?.trim()
    ? `\n--- Semrush cluster scatter (JSON) ---
Follow zone hints to distribute related phrases across agents. Do NOT paste JSON into the blueprint.
${options.semrushScatterContext}
`
    : "";

  const semrushPartsBlueprint = buildSemrushExactPromptParts({
    semrushApprovedExternalUrls: options.semrushApprovedExternalUrls,
    semrushAnchorPhrases: options.semrushAnchorPhrases,
    userExternalLinks: options.userExternalLinks,
    normalizedSiteUrl: normalizedSiteUrlForBlueprint,
  });

  const wordpressOnlyLinksSection = semrushPartsBlueprint.hasSemrushExactMode
    ? `**ABSOLUTELY CRITICAL - WORDPRESS INTERNAL + SEMRUSH EXTERNAL (EXACT)**:
- **INTERNAL [LINK]**: ${INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX}. URLs resolve from the sitemap after generation — do not paste raw https:// internal URLs in blueprint features.
- **SEMRUSH EXTERNAL**: Third-party URLs MUST come ONLY from the "SEMRUSH - APPROVED EXTERNAL URLs" block above; anchor text MUST be copied EXACTLY from the "SEMRUSH - APPROVED ANCHOR PHRASES" block. Blueprint feature: "[EXTERNAL_SEMRUSH]: href=<exact URL> | anchor=<exact phrase>". Section body: insert **[[EXTERNAL:exact-url|exact-anchor]]** mid-sentence — code replaces with <a href>; never write third-party <a href> yourself.
- **NEVER hallucinate external URLs** in blueprint features or agent descriptions - every third-party href must be a **verbatim substring** from the Semrush URL list above, or use index-only wording ("SEMRUSH URL #N") with no made-up URL.
- **Tone**: Instruct writers to use Semrush URLs as **neutral reference / knowledge-base** links in body copy - never as "buy from this site" or "do not buy from" retail advice.
- **NEVER** add external hrefs that are not in the Semrush URL list (entity Wikipedia from checklist/entity context is still allowed when applicable).
- **NEVER use links from knowledge files** as hrefs - knowledge files are for content reference ONLY.
- **NEVER create, invent, or fabricate** URLs - internal links must exist in the WordPress list; external must match Semrush lists above.
- When including "[LINK]" features, use "${LINK_FEATURE_PLACEHOLDER}" (example tokens: [[LINK:employment expenses checklist|employment expense rules]]).
- **NEVER use abstract descriptors** like [About Us] for internal links - use [[LINK:query|anchor]] placeholders only.
- If no relevant WordPress post exists for a topic, do NOT create an internal link for that topic - skip linking for that section`
    : `**ABSOLUTELY CRITICAL - WORDPRESS POSTS ONLY FOR LINKS**:
- **ONLY use links from the WordPress posts list** - These are the ONLY links allowed
- **NEVER use external links** that are NOT in the WordPress posts list
- **NEVER use links from knowledge files** - Knowledge files are for content reference ONLY, NOT for linking
- **NEVER create, invent, or fabricate any links** - If a link is not in the WordPress posts list, you MUST NOT use it
- When including "[LINK]" features, use "${LINK_FEATURE_PLACEHOLDER}" (example: [[LINK:topic phrase|anchor text]]).
- **NEVER use abstract descriptors** like [About Us], [interior design services], [topic] - use [[LINK:query|anchor]] placeholders only.
- If no relevant WordPress post exists for a topic, do NOT create a link for that topic - simply skip linking for that section`;

  const semrushBlueprintLinkValidationLine = semrushPartsBlueprint.hasSemrushExactMode
    ? `  - **CRITICAL: INTERNAL links** - ${INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX}. **SEMRUSH** - third-party hrefs only from Semrush URL list above; anchors verbatim from Semrush anchor list. Never use knowledge files for hrefs.`
    : `  - **CRITICAL: ONLY use links from WordPress posts - NEVER use external links or knowledge file links**`;

  const semrushBlueprintSecondLinkLine = semrushPartsBlueprint.hasSemrushExactMode
    ? `- **SEMRUSH EXTERNAL FEATURES**: When external authority is needed, add "[EXTERNAL_SEMRUSH]: href=<exact URL> | anchor=<exact phrase>" using ONLY copy-pasted pairs from the Semrush URL and anchor lists above - never type a URL that is not in those lists.`
    : `- **CRITICAL: NEVER use external links** - ONLY use links from WordPress posts list. If no relevant WordPress post exists, do NOT create a link.`;

  const primaryKwForTitle = context.keywordData?.keyword?.trim() ?? "";
  const isReoptimizeBlueprint = Boolean(options.currentPageUrl);
  const blueprintTitleLengthRule = isReoptimizeBlueprint
    ? `**CRITICAL: Title MUST be MAXIMUM 50 characters (Content Optimizer module requirement)**
   **ABSOLUTELY MANDATORY: Count every character. Title cannot exceed 50 characters.**
   **If your title is longer than 50 characters, it will be automatically truncated and may lose important information.**
   ${TITLE_WELL_KNOWN_ACRONYMS_RULE}`
    : `**CRITICAL: Title MUST be MAXIMUM 60 characters (WordPress SEO)**
   **ABSOLUTELY MANDATORY: Count every character. Title cannot exceed 60 characters. End on a complete word.**
   PRIMARY KEYWORD for this article: "${primaryKwForTitle}"
   ${BULK_WORDPRESS_POST_TITLE_RULE}
   The blueprint "title" is the canonical article headline; follow keyword weaving rules above.`;

  const importedLinksBlueprintSection = formatImportedDraftLinksForPrompt(options.importedDraftLinks ?? []);
  const modifierLinksBlueprintSection = formatModifierExternalLinksForPrompt(
    options.modifierExternalLinks ?? [],
  );

  const systemPrompt = `You are the **Blueprint Architect AI**. Your task is to create a complete blog blueprint structure based on the provided checklist.

--- Flow Context ---
Title: ${context.flowTitle || "Untitled Article"}
Purpose: ${context.flowPurpose || "Not specified"}
${context.keywordData ? `Primary Keyword: ${context.keywordData.keyword.trim()}` : ""}
${targetSiteContext}${wordPressPostsContext}${currentPageContextForBlueprint}${userPromptSection}${prefilledRowContractSection}${importedLinksBlueprintSection}${modifierLinksBlueprintSection}${semrushKeywordsBlueprintBlock}${semrushScatterBlueprintBlock}${semrushPartsBlueprint.semrushExactBlock}

--- Template Checklist ---
${checklist.map((item, index) => `${index + 1}. ${item}`).join("\n")}

${buildBlueprintArticleLengthBlock()}

--- Your Task ---
Generate a complete blueprint JSON structure with:
1. A clear, SEO-friendly "title" for the blog article
   ${entityTitleRule}   *** ENTITY PAGES: NON-NEGOTIABLE *** When the checklist mentions entity, location, "We Care About", or service area: The word "near" MUST appear in the title (e.g. "Blinds & Shades Near Ben Hill Atlanta"). No colons in titles. If your title does not contain "near", it is WRONG.
   ${blueprintTitleLengthRule}
${context.userPrompt && context.userPrompt.trim() ? `   **TITLE MUST REFLECT USER REQUIREMENTS**: If User Requirements (Prompt Modifier) specify a theme or focus (e.g. "creative structures only"), the article title MUST reflect that theme (e.g. reference the focus or structural angle). Do not output a generic title that ignores the User Requirements.` : ""}
2. A concise "purpose" description (frame as a focused guide, max ${ARTICLE_MAX_WORDS} words)
3. An "agents" array with one agent per checklist item; never exceed the checklist item count; prefer fewer agents with combined subtopics over splitting

--- CRITICAL: INTERPRETING CHECKLIST ITEMS ---
The checklist items may contain explicit feature requirements in formats like:
- "[LIST]: description" - Include this as a feature
- "[TABLE]: description" OR "[TABLE]: [COMPLETE MARKDOWN TABLE STRUCTURE]" - Include this as a feature. If a complete markdown table is provided in the checklist, preserve it exactly in the agent description or as a [CUSTOM] feature
- "[BLOCKQUOTE]: description" - Include this as a feature for entity facts. Format as a block quote (use markdown > format). MAXIMUM 1-2 block quotes per entire blueprint
- "[IMAGE]: description" OR "[IMAGE]: ![ ](url)" - Only include this if the user explicitly provided an image in the checklist. DO NOT add [IMAGE] features that weren't explicitly provided by the user. When url is present, the harness MUST embed <figure><img src="url" alt="label" /> in that section — NEVER <a href> text links to the image file
- "${LINK_FEATURE_PLACEHOLDER}": This feature MUST be included in EVERY agent. Use [[LINK:query|anchor]] tokens in agent descriptions — never raw https:// internal URLs, [topic], [About Us], or abstract descriptors. Applies to ALL agents.
- "[EXTERNAL_WIKI]: href=<exact Wikipedia URL> | anchor=<entity place name>": When the mandatory entity Wikipedia block appears above, include this in the intro agent (step 1) and at least one body agent. Copy href character-for-character from the mandatory block.
${semrushPartsBlueprint.hasSemrushExactMode ? `- "[EXTERNAL_SEMRUSH]: href=<exact URL from Semrush URL list> | anchor=<exact phrase from Semrush anchor list>": When the Semrush URL and anchor blocks appear above, use this for third-party external citations only - href and anchor must be **copy-pasted** from those lists character-for-character; never invent or "imagine" a plausible third-party URL.` : ""}
${isGSCReport ? `- "[FAQ]: 2-column Q&A table" - HTML table ONLY. Same format as all tables. Use <table><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody>...</tbody></table>. NEVER | Question | Answer | or |-|-|.` : `- **NO [FAQ] BODY SECTIONS**: FAQ is appended later as flo-faq. Do NOT add [FAQ] features or FAQ-style agent titles.`}
- "Note: User specified [requirement]" - Pay special attention to these requirements

When you see these in checklist items, you MUST include them as features in the corresponding agent object.
If a complete markdown table is provided in the checklist, preserve it exactly in the agent description or features.
${isGSCReport ? `\n*** CRITICAL - GSC REPORT ***: (1) Checklist items with [CUSTOM]: followed by a markdown table contain REAL GSC DATA. You MUST include the COMPLETE [CUSTOM] content in the agent features character-for-character. Do not summarize, truncate, or paraphrase. (2) Create ONE agent per checklist item. Do NOT merge or omit sections. Growth at a Glance, Your Strongest Search Terms, Service Area Pages, Content Performance, Branded Search Terms, FAQ - each must have its own agent when present in the checklist. (3) The agent features array must contain the full [CUSTOM] table as a feature string.` : ""}

--- CRITICAL AGENT STRUCTURE ---
Every agent object MUST have the following exact structure:
{
  "id": "unique-agent-id-string",
  "step": 1,
  "title": "Agent Title Here",
  "description": "Detailed description of what this agent does",
  "features": ["[LIST]: description", "[LINK]: description"],
  "h2Count": 1,
  "h3Count": 0,
  "h3Enabled": false,
  "headingLevel": 1,
  "maxTokens": 1000
}

- **headingLevel FIELD (CRITICAL)**: headingLevel: 1 = H2 tag (main section). headingLevel: 2 = H3 tag (subordinate subsection ONLY). ALL main topic agents MUST have headingLevel: 1. This includes: introduction, "We Care About [Entity]", "What We Offer", "What is [X]?", costs, benefits, styles, trends, conclusion - ALL headingLevel: 1. NEVER set headingLevel: 2 for a main topic. headingLevel: 2 is ONLY for agents that are true sub-sections nested under a parent H2 (extremely rare in blueprints).

CRITICAL REQUIREMENTS:
- Use "title" NOT "name" for the agent title field
- **ABSOLUTELY FORBIDDEN - NEVER USE "INTRODUCTION", "UNDERSTANDING", OR FAQ-STYLE HEADINGS**: NEVER use "Introduction", "Intro", "Overview", "Getting Started", "Understanding [Topic]", "Navigating [Topic]", "FAQ", "Frequently Asked Questions", "Answering Your Questions…", "Common Questions…", "Q&A", or any dedicated Q&A section title as agent titles. The first agent (step 1) MUST have an active, SEO-friendly header (e.g., "Why Window Covering Safety Matters", "Child-Safe Blinds: Key Rules", "Complete Guide to Child-Safe Blinds"). Generic, passive, or FAQ-style headers are FORBIDDEN.
- The "description" field MUST be a string describing what the agent does. If checklist contains exact markdown table or image, you may reference it in the description
- The "features" field MUST be an array of strings. Each feature should follow the format: "[TYPE]: description" where TYPE is one of: LIST, LINK, CUSTOM, FAQ, BLOCKQUOTE
- When checklist items mention "[TABLE]" with a complete markdown table structure, include it as "[CUSTOM]: [preserve the complete markdown table structure exactly as provided in checklist]" OR include the table structure in the agent description
- DO NOT include [IMAGE] features unless the user explicitly provided an image in the checklist. If an image markdown format (![ ](url)) is explicitly provided in the checklist, include it as "[IMAGE]: [preserve the exact markdown image format from checklist]" and state in the agent description that output must use <figure><img src="exact-url"> — never a text link to the image URL
- When checklist keyword uses unpunctuated compounds (xray, ecommerce), note the canonical writing form in the agent description (X-ray, e-commerce) for harness copy
- When checklist items mention "[LIST]", include it as "[LIST]: [description from checklist]"
- **CRITICAL: PREVENT UNNECESSARY SUBLISTS**: Only include [LIST] features when explicitly specified in the checklist item. If a checklist item does NOT contain "[LIST]" as a feature requirement, the agent description must explicitly state: "Write content in flowing paragraphs only. Do NOT create sublists, bullet lists, or 'Key Features' lists. Only include lists when [LIST] is explicitly mentioned as a feature requirement."
- When checklist items mention "[BLOCKQUOTE]", include it as "[BLOCKQUOTE]: [description from checklist]" - format as a block quote for entity facts. **Never use banned words from the WORD BLACKLIST in blockquote text** (no crucial, vital, navigate, navigating, understand, understanding, or any listed banned word).
- **WORD BLACKLIST IN AGENT METADATA (NON-NEGOTIABLE)**: Never put banned words from the system WORD BLACKLIST in agent titles, descriptions, or features. Metadata must use plain direct wording only.
- **H3 LIMIT (NON-NEGOTIABLE)**: When checklist mentions H3 subheadings, set h3Enabled: true and h3Count: 1 or 2. NEVER set h3Count above 2. MAX 2 H3s per H2 section.
- **ABSOLUTELY MANDATORY - 3-5 INTERNAL LINK PLACEHOLDERS**: When checklist items mention [LINK], use "${LINK_FEATURE_PLACEHOLDER}" with example tokens like [[LINK:topic phrase|anchor text]]. NEVER use raw https:// internal URLs, [topic], [About Us], or abstract descriptors in blueprint features.
- **CRITICAL VALIDATION - 3-5 LINKS MANDATORY**: Before outputting the blueprint, verify that EVERY agent has a [LINK] feature that SPECIFICALLY mentions 3-5 [[LINK:query|anchor]] placeholders. Count through each agent:
  - Does EVERY agent have a [LINK] feature? If NO, add it immediately.
  - Does the [LINK] feature specify "3-5" (not just "links")? If NO, update it to include "3-5".
  - **MANDATORY**: "${LINK_FEATURE_PLACEHOLDER}" — no full WordPress URLs in features.
${semrushBlueprintLinkValidationLine}
  - This validation applies to ALL agents without exception.
${options.currentPageUrl ? `- **CRITICAL: NEVER SELF-LINK**: When optimizing an existing post, NEVER link the post's URL (${options.currentPageUrl}) to itself in any agent features. Self-referential links are bad for SEO and must be completely avoided. Only suggest links to OTHER pages/posts, never to the current page being optimized.` : ""}
- CRITICAL: Keywords should be used in their NATURAL FORM (typically lowercase for generic terms) - only capitalize proper nouns, geographic locations, or at sentence starts. Do NOT randomly capitalize generic keywords like "blinds", "shades", "windows", etc.
${semrushBlueprintSecondLinkLine}
- The "id" field MUST be a unique string for each agent (e.g., "agent-1", "agent-2", etc.)
- The "step" field MUST be a number indicating the order (1, 2, 3, etc.). Steps MUST be sequential and non-overlapping
- Create one agent for each major section/requirement in the checklist
- **ABSOLUTELY MANDATORY REQUIREMENT - 3-5 LINK PLACEHOLDERS**: EVERY agent MUST include "${LINK_FEATURE_PLACEHOLDER}". NEVER use raw https:// internal URLs, [topic], [About Us], or abstract descriptors in blueprint features.
- If checklist items mention "Note: User specified [requirement]", ensure those requirements are reflected in the agent features and description
${context.userPrompt && context.userPrompt.trim() ? `- **PROMPT MODIFIER (PRIMARY FOCUS)**: When User Requirements / Prompt Modifier is present (see above), section content must stay on-theme and tie back to the focus. Do NOT repeat the modifier phrase in every agent title/heading - that is keyword stuffing. Vary headings: some can imply the theme; only use the exact phrase where it fits naturally (e.g. one or two sections). Agent descriptions/features should guide on-theme content without requiring the phrase in every H2.` : ""}
- If checklist contains exact markdown table, preserve the exact format in features or description
- Ensure the blueprint is valid JSON

${wordpressOnlyLinksSection}

**ABSOLUTELY CRITICAL - TITLE LENGTH REQUIREMENT**:
- The "title" field MUST be EXACTLY 50 characters or LESS
- Count every single character including spaces and punctuation
- If your title exceeds 50 characters, it will be automatically truncated and may lose important information
- Example: "Complete Guide to Window Treatments" (38 chars) ✅ CORRECT
- Example: "The Ultimate Guide to Hurricane-Proof Window Coverings in Florida: Costs, Benefits & Options" (88 chars) ❌ TOO LONG - WILL BE TRUNCATED
- Keep titles concise and focused - prioritize the primary keyword and main topic
- Content Optimizer module requirement: MAXIMUM 50 characters - NO EXCEPTIONS

**ABSOLUTELY FORBIDDEN - NEVER USE "INTRODUCTION" OR FAQ-STYLE HEADERS**:
- NEVER use "Introduction", "Intro", "FAQ", "Frequently Asked Questions", "Answering Your Questions…", "Common Questions…", "Q&A", or any variation as an agent title or H2 header
- The first agent (step 1) MUST have a SEO-friendly, descriptive, agentic header that helps with SEO
- Examples of GOOD first headers: "Why Window Covering Safety Matters", "Child-Safe Blinds: Key Rules", "Complete Guide to Child-Safe Blinds"
- Examples of FORBIDDEN first headers: "Introduction", "Understanding Child Safe Window Treatments", "Navigating Window Covering Safety"
- Examples of BAD first headers: "Introduction", "Intro", "Overview", "Getting Started"
- A separate "Overview" AI Overview block is auto-prepended to every article, so do NOT create your own top "Summary", "Overview", or "Key Takeaways" section - start with real body sections.

Example structure:
{
  "title": "Complete Guide to [Topic]",
  "purpose": "A focused guide covering [topic] (max ${ARTICLE_MAX_WORDS} words) with practical examples and actionable tips",
  "agents": [
    {
      "id": "agent-1",
      "step": 1,
      "title": "[Primary Topic]: Key Rules",
      "description": "Provides an engaging overview of the topic with SEO-friendly context",
      "features": ["[LIST]: Key points overview", "[LINK]: 3–5 [[LINK:query|anchor]] placeholders per section (no raw https:// internal URLs)"],
      "h2Count": 1,
      "h3Count": 0,
      "h3Enabled": false,
      "headingLevel": 1,
      "maxTokens": 1000
    }
  ]
}

Note: In every agent, use "headingLevel": 1 (1 = H2 main section; ALWAYS 1 for main topics. 2 = H3 rare subsection only).

Output ONLY valid JSON. Do not include markdown code blocks, explanations, or any text outside the JSON structure.`;

  let userPrompt = `Generate the complete blueprint JSON structure based on the checklist above. Include a title, purpose, and agents array with one agent for each checklist item. REQUIRED: Every agent must have a [LINK] feature with ${INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX} - no exceptions. Output valid JSON only.`;
  if ((options.importedDraftLinks?.length ?? 0) > 0) {
    userPrompt += ` REQUIRED: Every [IMPORTED_DRAFT_LINK] from the checklist must appear as a blueprint agent feature with the exact markdown [anchor](url) shown — do not change href or anchor text.`;
  }
  if ((options.modifierExternalLinks?.length ?? 0) > 0) {
    userPrompt += ` REQUIRED: Every [MODIFIER_EXTERNAL_LINK] from the checklist must appear as a blueprint agent feature with the exact markdown [anchor](url) shown — copy the full href character-for-character; do not change or omit any modifier URL.`;
  }
  if (semrushPartsBlueprint.hasSemrushExactMode) {
    userPrompt += ` When Semrush approved URL and anchor lists appear in the system prompt, add "[EXTERNAL_SEMRUSH]: href=... | anchor=..." features where external citations apply, using exact hrefs and exact anchor phrases from those lists only.`;
  }

  // Add user prompt modifier if provided
  if (context.userPrompt && context.userPrompt.trim()) {
    userPrompt += `\n\nPlease incorporate the following requirements: ${context.userPrompt.trim()}. The blueprint title MUST clearly reflect this focus. Section content should stay on-theme; do not repeat the modifier phrase in every section heading (avoid keyword stuffing - vary headings).`;
  }

  const MAX_BLUEPRINT_ATTEMPTS = 3;
  const MIN_BLUEPRINT_AGENTS = Math.min(checklist.length, 3);

  for (let bpAttempt = 1; bpAttempt <= MAX_BLUEPRINT_ATTEMPTS; bpAttempt++) {
  let fullResponse = "";
  let streamFinishReason: string | undefined;

  try {
    const streamResult = await streamChatCompletion({
      apiKey,
      model,
      messages: [
        { role: "system", content: appendUniversalContentRulesToSystemPrompt(systemPrompt) },
        { role: "user", content: userPrompt },
      ],
      contentHarness: true,
      temperature,
      maxTokens,
      topP,
      onContentChunk: (chunk) => {
        fullResponse += chunk;
      },
      onFinishReason: (reason) => {
        streamFinishReason = reason;
      },
    });

    const effectiveFinish = streamFinishReason || streamResult.finishReason;
    if (effectiveFinish === 'error' && bpAttempt < MAX_BLUEPRINT_ATTEMPTS) {
      console.warn(`[Blueprint] Attempt ${bpAttempt}/${MAX_BLUEPRINT_ATTEMPTS}: stream error (len=${fullResponse.length}). Retrying...`);
      await new Promise(r => setTimeout(r, 2000 * bpAttempt));
      continue;
    }

    // Clean the response - extract JSON from markdown code fences or raw text
    let cleanedResponse = fullResponse.trim();
    // Strip any markdown code fences (```json ... ```, ``` ... ```, or variants with trailing whitespace/newlines)
    cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
    // If still not starting with {, try to find the first { and last }
    if (!cleanedResponse.trimStart().startsWith('{')) {
      const firstBrace = cleanedResponse.indexOf('{');
      const lastBrace = cleanedResponse.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        cleanedResponse = cleanedResponse.slice(firstBrace, lastBrace + 1);
      }
    }

    // Parse JSON response (repair truncated / malformed model output)
    const { parsed } = parseJsonWithRepair<{
      title?: string;
      purpose?: string;
      agents?: unknown[];
    }>(cleanedResponse, { targetKeys: ["agents", "title", "purpose"] });

    // Validate and structure the response
    let agents: AgentConfig[] = Array.isArray(parsed.agents)
      ? sanitizeBlueprintAgentsForPipeline(parsed.agents.map((agent: any, index: number) => {
          const features = Array.isArray(agent.features) ? agent.features : [];
          
          // MANDATORY: Ensure every agent has a [LINK] feature with 3-5 links specification
          const hasLinkFeature = features.some((f: string) => 
            typeof f === 'string' && f.toLowerCase().trim().startsWith('[link]')
          );
          
          // Check if link feature specifies 3-5 links (not just any link)
          const hasCorrectLinkFormat = features.some((f: string) => 
            typeof f === 'string' && 
            f.toLowerCase().trim().startsWith('[link]') && 
            (f.includes('3-5') || f.includes('3 to 5') || f.includes('three to five'))
          );
          
          if (!hasLinkFeature) {
            // Repair: add [LINK] when model omitted it (prompt requires it; this is fallback only)
            features.push(LINK_FEATURE_PLACEHOLDER);
            console.warn(`[Blueprint] Agent "${agent.title || `agent-${index + 1}`}" was missing required [LINK] feature - repaired. Ensure prompt limits data so model outputs this.`);
          } else if (!hasCorrectLinkFormat) {
            const linkIndex = features.findIndex((f: string) => 
              typeof f === 'string' && f.toLowerCase().trim().startsWith('[link]')
            );
            if (linkIndex >= 0) {
              features[linkIndex] = LINK_FEATURE_PLACEHOLDER;
              console.warn(`[Blueprint] Agent "${agent.title || `agent-${index + 1}`}" had [LINK] but not 3-5 links - repaired. Ensure prompt limits data so model outputs correct format.`);
            }
          }
          
          let agentTitle = agent.title || `Section ${index + 1}`;
          
          // CRITICAL: Never allow "Introduction" or "Intro" as a header - replace with SEO-friendly alternative
          const titleLower = agentTitle.toLowerCase().trim();
          if (titleLower === 'introduction' || titleLower === 'intro' || titleLower.startsWith('introduction ') || titleLower.startsWith('intro ')) {
            // For first agent, use SEO-friendly descriptive header
            if (index === 0 || (agent.step || index + 1) === 1) {
              // Try to extract topic from flow title or use generic SEO-friendly header
              const flowTitle = context.flowTitle || '';
              const topicMatch = flowTitle.match(/(.+?)(?:\s*[:|]|\s+vs\.|\s+Guide|\s+Complete)/i);
              const topic = topicMatch ? topicMatch[1].trim() : 'the Topic';
              agentTitle = `${topic}: What You Need to Know`;
              console.warn(`[Blueprint Validation] Replaced "Introduction" with SEO-friendly header: "${agentTitle}"`);
            } else {
              // For other agents, use a more descriptive title based on description
              const descWords = agent.description ? agent.description.split(/\s+/).slice(0, 5).join(' ') : 'Content';
              agentTitle = descWords.length > 50 ? descWords.substring(0, 47) + '...' : descWords;
              console.warn(`[Blueprint Validation] Replaced "Introduction" with descriptive header: "${agentTitle}"`);
            }
          }
          
          agentTitle = sanitizeForbiddenHeadingTitle(agentTitle);

          const isFAQ = features?.some((f: string) =>
            typeof f === 'string' && (f.toLowerCase().includes('[faq]') || f.toLowerCase().includes('faq'))
          ) ?? false;
          return {
            id: agent.id || `agent-${index + 1}`,
            step: agent.step || index + 1,
            title: agentTitle,
            description: agent.description || "",
            features: features,
            h2Count: agent.h2Count ?? 1,
            h3Count: isFAQ ? 0 : Math.min(agent.h3Count ?? 0, 5),
            h3Enabled: isFAQ ? false : (agent.h3Enabled ?? false),
            headingLevel: agent.headingLevel ?? 1,
            maxTokens: agent.maxTokens ?? 2000,
          };
        }), { allowFaqAgents: isGSCReport })
      : [];

    // CRITICAL: On entity/service-area pages, ALL agents should be H2 (headingLevel: 1).
    // The blueprint AI sometimes incorrectly sets headingLevel: 2 (H3) for main topics.
    const isEntityPage = !!(options as any).entity;
    if (isEntityPage) {
      let repairedCount = 0;
      agents.forEach((agent) => {
        if (agent.headingLevel && agent.headingLevel > 1) {
          agent.headingLevel = 1;
          repairedCount++;
        }
      });
      if (repairedCount > 0) {
        console.warn(`[Blueprint Validation] Entity page: repaired ${repairedCount} agents from headingLevel 2+ to 1 (H2). Main topics must be H2.`);
      }
    }

    // General check: if majority of agents have headingLevel > 1, it's likely an error
    if (!isEntityPage) {
      const h3Agents = agents.filter((a) => a.headingLevel && a.headingLevel > 1);
      if (agents.length > 0 && h3Agents.length > agents.length * 0.6) {
        h3Agents.forEach((a) => {
          a.headingLevel = 1;
        });
        console.warn(`[Blueprint Validation] ${h3Agents.length}/${agents.length} agents had headingLevel > 1. Promoted all to H2 (headingLevel: 1).`);
      }
    }

    // CRITICAL: If the model returned fewer agents than checklist items, split the overstuffed agent(s)
    const MIN_AGENTS = Math.min(checklist.length, 4);
    if (agents.length < MIN_AGENTS && agents.length >= 1) {
      console.warn(`[Blueprint Validation] Model returned only ${agents.length} agent(s) but checklist has ${checklist.length} items. Splitting features into separate agents.`);
      const expanded: typeof agents = [];
      for (const agent of agents) {
        const feats = agent.features || [];
        // Group every ~3 features into a new agent (keeps link features with their content features)
        const FEATS_PER_AGENT = 3;
        if (feats.length > FEATS_PER_AGENT && expanded.length + Math.ceil(feats.length / FEATS_PER_AGENT) <= 10) {
          for (let i = 0; i < feats.length; i += FEATS_PER_AGENT) {
            const chunk = feats.slice(i, i + FEATS_PER_AGENT);
            // Ensure each split agent gets a [LINK] feature
            const hasLink = chunk.some((f: string) => typeof f === 'string' && f.toLowerCase().startsWith('[link]'));
            if (!hasLink) chunk.push(LINK_FEATURE_PLACEHOLDER);
            const idx = expanded.length + 1;
            // Derive a title from the first feature or from checklist
            const checklistTitle = checklist[expanded.length]?.replace(/^\[.*?\]:\s*/, '').slice(0, 60) || `Section ${idx}`;
            expanded.push({
              ...agent,
              id: `agent-${idx}`,
              step: idx,
              title: expanded.length === 0 ? agent.title : checklistTitle,
              features: chunk,
              description: chunk.filter((f: string) => !f.toLowerCase().startsWith('[link]')).join('; ').slice(0, 200) || agent.description,
            });
          }
        } else {
          expanded.push(agent);
        }
      }
      if (expanded.length > agents.length) {
        // Re-number steps
        expanded.forEach((a, i) => { a.step = i + 1; a.id = `agent-${i + 1}`; });
        agents = expanded;
        console.log(`[Blueprint Validation] Expanded to ${agents.length} agents from overstuffed single agent.`);
      }
    }

    // Update step numbers to be sequential
    agents.forEach((agent, index) => {
      agent.step = index + 1;
    });

    // CRITICAL: Enforce 50 character limit for Content Optimizer module (optimized content)
    let finalTitle = parsed.title || context.flowTitle || "Untitled Article";
    const originalTitleLength = finalTitle.length;
    finalTitle = truncateTitleForSEO(finalTitle, 50);
    if (originalTitleLength > 50) {
      console.log('[Blog Template Builder] Truncated blueprint title to 50 characters (Content Optimizer module requirement):', {
        original: parsed.title || context.flowTitle || "Untitled Article",
        truncated: finalTitle,
        originalLength: originalTitleLength,
        truncatedLength: finalTitle.length
      });
    }

    return enforceForbiddenWordsOnBlueprint({
      title: finalTitle,
      purpose: parsed.purpose || context.flowPurpose || "Not specified",
      agents,
    });
  } catch (error) {
    console.error(`[Blueprint] Attempt ${bpAttempt}/${MAX_BLUEPRINT_ATTEMPTS} error:`, error);
    if (bpAttempt === MAX_BLUEPRINT_ATTEMPTS) {
      throw new Error(
        `Failed to generate blueprint: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
    await new Promise(r => setTimeout(r, 2000 * bpAttempt));
  }
  } // end for retry loop

  throw new Error('Failed to generate blueprint after all retry attempts');
}

