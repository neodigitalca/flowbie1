/**
 * Generator checklist/blueprint prompt assembly (single source for client + server export).
 */
import type { KeywordData } from "@/lib/keyword-types";
import {
  ARTICLE_MAX_WORDS,
  buildArticleLengthChecklistBlock,
  buildBlueprintArticleLengthBlock,
  buildFocusedArticlePurpose,
} from "@/lib/content-generation/article-length-policy";
import { INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX } from "@/lib/content-generation/internal-link-placeholders";

const LINK_FEATURE_PLACEHOLDER = `[LINK]: ${INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX}`;
import { GLOBAL_FORBIDDEN_WORDS_PROMPT_BLOCK } from "@/lib/content-word-blocklist";

export type GeneratorWordPressPost = {
  id?: number;
  slug?: string;
  title: string;
  excerpt?: string;
  link: string;
  date_gmt?: string;
};

export type ChecklistPromptContext = {
  title: string;
  keywordData: KeywordData;
  selectedKeywords: string[];
  selectedH2Sections: string[];
  userPrompt?: string;
  connectedSite?: { name: string; siteUrl: string };
  wordPressPosts?: GeneratorWordPressPost[];
  paaQuestions?: Array<{ question: string }>;
  semrushKeywordsContext?: string;
  semrushScatterContext?: string;
  bucketReadFirstBlock?: string;
  entity?: string;
};

export type BlueprintPromptContext = {
  title: string;
  purpose: string;
  keyword: string;
  checklist: string[];
  userPrompt?: string;
  connectedSite?: { name: string; siteUrl: string };
  wordPressPosts?: GeneratorWordPressPost[];
  semrushKeywordsContext?: string;
  semrushScatterContext?: string;
};

function keywordSection(keywordData: KeywordData, selectedKeywords: string[]): string {
  const primary = keywordData.keyword.toLowerCase();
  const selected = selectedKeywords.map((k) => k.toLowerCase()).join(", ") || "None";
  return `--- Keyword Context ---
Primary Keyword: ${primary}
Search Volume: ${keywordData.searchVolume?.toLocaleString?.() ?? keywordData.searchVolume ?? "N/A"}
Difficulty: ${keywordData.difficulty ?? "N/A"}/100
Intent: ${keywordData.intent ?? "N/A"}
Selected Keywords: ${selected}

FOCUS KEYWORD DENSITY: Target minimum ~1.0% focus keyword density (exact phrase + combinations), not ~0.5%.
EXACT PRIMARY PER H2: Include the exact primary keyword phrase at least once in every H2 section body.
PARAGRAPH LENGTH: Moderately short paragraphs (~2-4 sentences); split long blocks.`;
}

function wordPressPostsBlock(posts: GeneratorWordPressPost[], siteName: string): string {
  if (!posts.length) return "";
  const lines = posts.slice(0, 30).map((post, idx) => {
    const excerpt = (post.excerpt ?? "").replace(/<[^>]+>/g, "").slice(0, 80);
    return `${idx + 1}. "${post.title}"${excerpt ? ` - ${excerpt}` : ""}\n   URL: ${post.link}`;
  });
  return `
=== WORDPRESS POSTS SOURCE (INTERNAL LINKS) ===
Available WordPress Posts from ${siteName} (${posts.length} total):

${lines.join("\n\n")}

Use ONLY URLs from this list for [LINK] placeholders. Never invent internal URLs.
=== END WORDPRESS POSTS SOURCE ===
`;
}

function checklistFormatExample(h2Sample: string): string {
  return `CRITICAL FORMAT REQUIREMENT:
Format your response as a numbered list, one item per line. Do NOT use ## markdown headings in checklist items.

Example (NOTE: numbered lines only — no ##):
1. Why Smart Blinds Matter for Modern Homes [STRUCTURE]: 2 short paragraphs. [EXACT PRIMARY PER H2]: exact primary once in body. [FOCUS KEYWORD DENSITY]: ~1%+ across article. [LINK]: 3-5 [[LINK:query|anchor]] placeholders.
2. ${h2Sample || "Core Benefits"} [STRUCTURE]: 1-2 paragraphs. [TABLE]: compact comparison table. [EXACT PRIMARY PER H2]. [LINK]: 3-5 internal links.
3. ${h2Sample || "Installation Steps"} [LIST]: number step-by-step process. [EXACT PRIMARY PER H2]. [LINK]: 3-5 internal links.
4. ${h2Sample || "Maintenance Tips"} [LIST]: bullet key benefits. [EXACT PRIMARY PER H2]. [LINK]: 3-5 internal links.
5. Conclusion and Next Steps [EXACT PRIMARY PER H2]. [LINK]: CTA internal links.

Output ONLY the numbered checklist items, no additional text.`;
}

export function buildChecklistPromptMessages(ctx: ChecklistPromptContext): { system: string; user: string } {
  const isServiceArea = Boolean(ctx.entity?.trim());
  const h2Section =
    ctx.selectedH2Sections.length > 0
      ? `\n--- Selected H2 Sections ---\n${ctx.selectedH2Sections.map((h2, i) => `${i + 1}. ${h2}`).join("\n")}\n`
      : "";

  const siteBlock = ctx.connectedSite
    ? `\n=== TARGET SITE ===\n${ctx.connectedSite.name} (${ctx.connectedSite.siteUrl.replace(/\/+$/, "")})\n=== END TARGET SITE ===\n`
    : "";

  const postsBlock = ctx.connectedSite && ctx.wordPressPosts?.length
    ? wordPressPostsBlock(ctx.wordPressPosts, ctx.connectedSite.name)
    : "";

  const paaBlock =
    ctx.paaQuestions && ctx.paaQuestions.length > 0
      ? `\n--- People Also Ask (flo-faq append only, NOT body H2s) ---\n${ctx.paaQuestions.map((p) => `- ${p.question}`).join("\n")}\n`
      : "";

  const semrushBlock = [
    ctx.semrushKeywordsContext?.trim()
      ? `\n--- Semrush keyword research (JSON) ---\n${ctx.semrushKeywordsContext}\n`
      : "",
    ctx.semrushScatterContext?.trim()
      ? `\n--- Semrush cluster scatter (JSON) ---\n${ctx.semrushScatterContext}\n`
      : "",
  ].join("");

  const modifierBlock = ctx.userPrompt?.trim()
    ? `\n--- PROMPT MODIFIER (PRIMARY FOCUS) ---\n${ctx.userPrompt.trim()}\n--- END ---\n`
    : "";

  const system = `You are an expert blog content strategist and blueprint architect. Create a detailed checklist for generating a blog template blueprint.

${keywordSection(ctx.keywordData, ctx.selectedKeywords)}

**FORBIDDEN BODY H2 HEADERS**: Never FAQ, Q&A, Frequently Asked Questions as body sections. FAQ is appended later as flo-faq.

--- Blog Title ---
${ctx.title}
${siteBlock}${postsBlock}${h2Section}${paaBlock}${modifierBlock}${semrushBlock}

${buildArticleLengthChecklistBlock(isServiceArea)}

Harness contract: Each checklist item = exactly one H2 harness pass (~${Math.floor(ARTICLE_MAX_WORDS / 6)} words). Max 2 [TABLE] in entire article.
Each item must include [STRUCTURE], [EXACT PRIMARY PER H2], [FOCUS KEYWORD DENSITY], [PARAGRAPH LENGTH], and [LINK]: 3-5 [[LINK:query|anchor]].
Include at least one [TABLE], one [LIST]: bullet, and one [LIST]: number across the article.
First H2: NEVER title it Introduction or Intro — use SEO-friendly active title.
Conclusion H2 with exact primary keyword once in body.

${checklistFormatExample(ctx.selectedH2Sections[0] ?? "Section Topic")}

${GLOBAL_FORBIDDEN_WORDS_PROMPT_BLOCK}`;

  let user = "";
  if (ctx.bucketReadFirstBlock?.trim()) {
    user += ctx.bucketReadFirstBlock.trim() + "\n\n";
  }
  user += `Generate a focused checklist for creating a blog template blueprint.

${buildArticleLengthChecklistBlock(isServiceArea)}

Blog Details:
- Title: "${ctx.title}"
- H2 Sections to cover: ${ctx.selectedH2Sections.join(", ") || "(derive from keyword research)"}
- Primary Keyword: "${ctx.keywordData.keyword}"
- Related Keywords: ${ctx.selectedKeywords.slice(0, 5).join(", ") || ctx.keywordData.keyword}

Requirements:
1. Create ${isServiceArea ? "6-7" : "5-6"} checklist items maximum: introduction-style first H2, 3-4 body topics, conclusion.
2. Each item must include mandatory markers: [STRUCTURE], [EXACT PRIMARY PER H2], [FOCUS KEYWORD DENSITY], [PARAGRAPH LENGTH], [LINK].
3. Include at least one [TABLE], one [LIST]: bullet, and one [LIST]: number (max 2 [TABLE] total).
4. First H2: active SEO title (never Introduction/Intro). Conclusion H2 with exact primary keyword.
5. Output ONLY numbered checklist lines. Do NOT use ## markdown headings in items.`;

  if (ctx.userPrompt?.trim()) {
    user += `\n\n--- CRITICAL: USER-SPECIFIED REQUIREMENTS ---\n${ctx.userPrompt.trim()}`;
  }

  user += `\n\n--- MANDATORY: INTERNAL LINK REQUIREMENTS ---
Every H2 section MUST include "[LINK]: 3-5 internal links via [[LINK:query|anchor]] placeholders."
Use WordPress posts from the system prompt when suggesting link topics.`;

  return { system, user };
}

export function buildBlueprintPromptMessages(ctx: BlueprintPromptContext): { system: string; user: string } {
  const siteUrl = ctx.connectedSite?.siteUrl?.replace(/\/+$/, "") ?? "";
  const siteBlock = ctx.connectedSite
    ? `\n=== TARGET SITE ===\n${ctx.connectedSite.name} (${siteUrl})\n=== END ===\n`
    : "";
  const postsBlock =
    ctx.connectedSite && ctx.wordPressPosts?.length
      ? wordPressPostsBlock(ctx.wordPressPosts, ctx.connectedSite.name)
      : "";

  const semrushBlock = [
    ctx.semrushKeywordsContext?.trim()
      ? `\n--- Semrush keyword research (JSON) ---\n${ctx.semrushKeywordsContext}\n`
      : "",
    ctx.semrushScatterContext?.trim()
      ? `\n--- Semrush cluster scatter (JSON) ---\n${ctx.semrushScatterContext}\n`
      : "",
  ].join("");

  const modifierBlock = ctx.userPrompt?.trim()
    ? `\n--- PROMPT MODIFIER ---\n${ctx.userPrompt.trim()}\n--- END ---\n`
    : "";

  const system = `You are the Blueprint Architect AI. Return valid JSON only.

--- Flow Context ---
Title: ${ctx.title}
Purpose: ${ctx.purpose}
Primary Keyword: ${ctx.keyword}
${siteBlock}${postsBlock}${modifierBlock}${semrushBlock}

--- Template Checklist ---
${ctx.checklist.map((item, i) => `${i + 1}. ${item}`).join("\n")}

${buildBlueprintArticleLengthBlock()}

One agent per checklist item. Do NOT add Overview or FAQ agents.
Rename Introduction/Intro to SEO-friendly H2 titles (never drop intro sections).
Every agent MUST include "${LINK_FEATURE_PLACEHOLDER}" in features.
NEVER use FAQ-style agent titles.

Agent JSON schema:
{"title":"","purpose":"","agents":[{"id":"section-1","step":1,"title":"","description":"","features":["[LINK]: [[LINK:query|anchor]] placeholders"],"headingLevel":2}]}

${GLOBAL_FORBIDDEN_WORDS_PROMPT_BLOCK}`;

  const user = `Build a JSON blueprint for "${ctx.title}" (keyword: ${ctx.keyword}).
Purpose must be: ${ctx.purpose || buildFocusedArticlePurpose(ctx.keyword)}
${ctx.userPrompt?.trim() ? `Prompt modifier focus: ${ctx.userPrompt.trim()}\n` : ""}
Checklist:
${ctx.checklist.map((item, i) => `${i + 1}. ${item}`).join("\n")}

Return JSON with one agent per checklist item. Rename Intro/Introduction titles. Each agent needs [LINK] in features.`;

  return { system, user };
}

export function buildKeywordAnalysisUserPrompt(keyword: string, serpExcerpt: string): string {
  return `Analyze the primary keyword "${keyword}" for blog content planning.

SERP excerpt:
${serpExcerpt.slice(0, 8000)}

Return JSON only:
{
  "h2Suggestions": ["SEO H2 topic 1", "..."],
  "keywordSuggestions": { "primary": "...", "variations": ["..."], "longTail": ["..."] },
  "peopleAlsoAsk": [{ "question": "...", "answer": "..." }],
  "contentGaps": ["..."]
}`;
}

export function buildKeywordAnalysisSystemPrompt(): string {
  return "You are an SEO keyword analyst. Return valid JSON only. Suggest 5-7 H2 section topics (no FAQ titles). Include keyword variations and PAA questions from SERP context.";
}
