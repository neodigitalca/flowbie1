import {
  ARTICLE_MAX_WORDS,
  buildHarnessArticleBudgetBlock,
  buildHarnessArticleCapLine,
} from "@/lib/content-generation/article-length-policy";
import { INTERNAL_LINK_PLACEHOLDER_PROMPT_BLOCK } from "../content-generation/internal-link-placeholders";
import { appendMasterInstructionsToSystemPrompt, ensureMasterInstructionsInMemory } from "../master-instructions-storage";
import { searchSiteCache, getSiteCache } from "../wordpress-site-cache";
import { getLocalEntityPhraseExamples, getLocalGeneralPhrase } from "../local-entity-phrases";
import type { AIDrivenACFContext } from "../content-generation/ai-driven-acf-reader";
import { TABLE_FORMAT, CRITICAL_LINK_RULE, NO_FAKE_TESTIMONIALS_RULE } from "./core";
import {
  buildOverviewLinkRulesBlock,
} from "./overview-link-rules";
import {
  appendUniversalContentRulesToSystemPrompt,
  buildBlacklistRagBlock,
  FORBIDDEN_WORDS_USER_PROMPT_REMINDER,
} from "../content-word-blocklist";
import {
  buildKeywordPunctuationPromptBlock,
  resolveWritingKeyword,
} from "./keyword-canonical-punctuation";

// --- Shared rule blocks (DRY) ---

/** Distinct Semrush outbound targets: 1–2 use all; 3+ use 3–5 (capped by list size). */
function semrushTargetDistinctCount(urlCount: number): number {
  if (urlCount <= 0) return 0;
  if (urlCount <= 2) return urlCount;
  return Math.min(5, urlCount);
}

/** Stops models from appending fake © / "All rights reserved" / invented brand footers (common hallucination). */
const NO_COPYRIGHT_FAKE_BRAND_RULE = `**NO COPYRIGHT OR FAKE SITE FOOTER (NON-NEGOTIABLE)**: Never output "©", "Copyright" plus a year, "All rights reserved", or invented business/brand names (e.g. placeholder sites like "MyGlamping"). If TARGET SITE names a real business, use only that name when relevant - never invent a different company name. Do not end the article with legal boilerplate or stock footer lines.`;

const LINK_RULES = (
  siteUrl: string,
  currentPageUrl?: string,
  semrushExternalUrls?: string[],
  portfolioBlockedHosts?: string[],
) => {
  const list = (semrushExternalUrls ?? []).map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean);
  const hasSemrush = list.length > 0;
  const t = semrushTargetDistinctCount(list.length);
  const externalRule = hasSemrush
    ? `(2) External - NON-NEGOTIABLE: When APPROVED EXTERNAL URLs (SEMRUSH) exists, you MUST output ${list.length <= 2 ? `exactly ${t}` : `at least 3 and up to ${t}`} distinct outbound <a href="…"> links using ONLY those list URLs - href character-for-character exact match. Wikipedia allowed only for entity (when applicable) in addition. Zero outbound links to the Semrush list is INVALID. Spread links across section **body** paragraphs (not a repeated line stuck under every heading). No other third-party domains. **Semrush links = knowledge-base / reference citations only**: neutral background, industry or product context, or documentation-style mention. FORBIDDEN: "buy here", "purchase from", "get them at [site]", "avoid buying from", "do not shop at", or any purchase / anti-purchase recommendation tied to those URLs.`
    : `(2) External - ONLY entity Wikipedia page allowed (when entity exists). No other external sites.`;
  const portfolioHosts = (portfolioBlockedHosts ?? [])
    .map((h) => (typeof h === "string" ? h.trim() : ""))
    .filter(Boolean);
  const uniquePortfolio = [...new Set(portfolioHosts)].sort((a, b) => a.localeCompare(b, "en"));
  const portfolioRule =
    uniquePortfolio.length > 0
      ? ` **Other managed clients (NEVER link)** - do not link to these domains or any URL on them (other sites in this workspace): ${uniquePortfolio.slice(0, 45).join(", ")}${uniquePortfolio.length > 45 ? " …" : ""}.`
      : "";
  return `
Links: HTML ONLY. Same-site internal links may use <a href="exact-url">anchor</a> from the linkable URLs list (${siteUrl}). Third-party/Semrush citations: NEVER write <a href="https://..."> — use [[EXTERNAL:exact-url|exact-anchor]] copied from the assigned blueprint Semrush pair. Internal placeholders: [[LINK:query|anchor]]. Overview scroll: [[SCROLL:#id|phrase]]. ${externalRule} NEVER link to competitors or local businesses in the same industry.${portfolioRule} **Blacklist (never link)**: forums, chat/messaging apps, Reddit, Discord, Quora, Stack Overflow, Pinterest, or other thread/UGC platforms - unless that exact URL appears in the Semrush approved list (lists are pre-filtered). (3) Never "External Resources" sections. (4) NEVER use markdown [text](url) for external URLs. (5) NEVER use "here" in or after a link. (7) FORBIDDEN: parenthetical footnotes (anchor phrase) or bare (https://...). (8) FORBIDDEN: any third-party URL in prose except inside [[EXTERNAL:url|anchor]].${currentPageUrl ? ` (6) INVALID - REJECT: Any link that matches the page being optimized (${currentPageUrl}). Same path = self-link = forbidden. Do not use it.` : ""}`;
};

function buildSemrushApprovedExternalBlock(
  urls: string[] | undefined,
  format: "markdown" | "html" = "html",
): string {
  const list = (urls ?? []).map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean);
  if (!list.length) return "";
  const lines = list.map((u, i) => `${i + 1}. ${u}`).join("\n");
  const n = list.length;
  const target = semrushTargetDistinctCount(n);
  const isMarkdown = format === "markdown";
  const mandate =
    n <= 2
      ? isMarkdown
        ? `MANDATORY: The full press release must include exactly ${n} outbound Markdown link${n === 1 ? "" : "s"} [anchor text](EXACT_URL) using the URL${n === 1 ? "" : "s"} below. URL must match the list EXACTLY. Only one harness section should contain the link (usually Supporting details); other sections must not repeat it.`
        : `MANDATORY: Include EVERY URL below as an outbound <a href="EXACT_URL">…</a> in the article body (${n} distinct link${n === 1 ? "" : "s"}). Href must match the list EXACTLY - no edits, no tracking params unless already in the list.`
      : isMarkdown
        ? `MANDATORY: Include at least 3 and at most ${target} distinct Markdown links [anchor](EXACT_URL) from the list below (${n} approved). Each URL must copy one of the numbered URLs EXACTLY.`
        : `MANDATORY: Include at least 3 and at most ${target} distinct outbound links from the list below (${n} approved). Each <a href> must copy one of the numbered URLs EXACTLY. Weave them into normal paragraphs inside sections (follow the blueprint) - not boilerplate pasted after headings. NEVER submit with 0 external links to these URLs.`;

  return `
=== APPROVED EXTERNAL URLs (SEMRUSH) ===
${mandate}
${lines}

**REFERENCE-ONLY FRAMING (NON-NEGOTIABLE)**: These URLs are third-party **reference / knowledge-base** material (background, industry context, specs, or general product category information). Write them into sentences that cite them neutrally. **FORBIDDEN**: any wording that recommends buying from, ordering from, or avoiding that site as a retailer; any "where to buy" or "where not to buy" tied to these links; any repeated one-line template after every <h2>. Vary sentence structure and placement across sections.

Do NOT type any third-party URL in your output unless it is copied exactly from the numbered list above. Never invent, guess, or substitute similar URLs.
=== END APPROVED EXTERNAL URLs ===
`;
}

// Manager Panel / Blueprint flow: Markdown output (plan, draft, final report)
const MARKDOWN_FORMAT_RULES = `
*** OUTPUT: MARKDOWN ONLY. NEVER HTML. ***
All content MUST be valid Markdown. Headings: ## H2, ### H3. Links: [anchor text](url). Lists: - bullets or 1. 2. 3. numbered. Tables: | col | col | with separator line.
**PARAGRAPH LENGTH**: Use **moderately short** paragraphs (blank line between them). Target roughly **2–4 sentences** per paragraph on average - **not** one-sentence micro-paragraphs for every thought, and **not** long wall-of-text blocks. Split any paragraph that would exceed **~5 sentences** or read as an oversized block (avoids SEO/readability warnings like “paragraph is long”).
Pros/Cons, advantages vs disadvantages, or strengths vs weaknesses MUST be rendered as a two-column Markdown table with "Pros" and "Cons" headers - NEVER as bullet lists or numbered lists.
NEVER use: <p>, <h2>, <a href>, <table>, <ul>, <ol>, or any HTML tags. Use markdown syntax only.
${TABLE_FORMAT} No duplicate headings. No placeholder names; use "our team" if needed.
${NO_COPYRIGHT_FAKE_BRAND_RULE}
${NO_FAKE_TESTIMONIALS_RULE}
`;

// Content Optimizer / Optimization flow: HTML output for WordPress upload
const HTML_FORMAT_RULES = `
*** OUTPUT: HTML ONLY. NEVER MARKDOWN. ***
All content MUST be valid HTML. Paragraphs: <p>...</p>. Links: <a href="url">text</a>. Images: <figure class="wp-block-image size-full"><img src="url" alt="description" loading="lazy" /></figure> — NEVER use <a href="image-url"> for wp-content/uploads images; display them inline with <img>. Lists: <ul><li>...</li></ul> or <ol><li>...</li></ol>. Tables: <table><thead><tr><th>H1</th><th>H2</th></tr></thead><tbody><tr><td>...</td><td>...</td></tr></tbody></table>.
**PARAGRAPH LENGTH**: Keep each <p> **moderately short** - typically **2–4 sentences**. Do **not** create **long** single paragraphs (wall of text); split into additional <p> tags when needed. Do **not** over-split into **only** one-sentence paragraphs unless emphasis truly needs it. Avoid any one paragraph carrying a whole section’s worth of text (addresses tools that flag “paragraph is long”).
Pros/Cons, advantages vs disadvantages, or strengths vs weaknesses MUST be rendered as a two-column HTML <table> with <th>Pros</th> and <th>Cons</th> headers - NEVER as <ul>/<ol> lists.
CRITICAL: FAQ table = SAME HTML format as every other table. <table><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody>...</tbody></table>. NEVER | Question | Answer | or |-|-|.
NEVER use: ## headings, [text](url), | markdown tables |, - bullets, 1. numbered (use HTML elements instead).
${TABLE_FORMAT} No empty tables; no link-only columns; at least one data row. No duplicate headings. No "Article Title:" label. No placeholder names; use "our team" if needed.
Lists: Numbered steps (1, 2, 3...) = <ol><li>...</li></ol> ONLY. Bullet items (features, benefits) = <ul><li>...</li></ul>. NEVER use bullet format for sequential steps - use <ol> for any process, ranking, or step-by-step list. CRITICAL: Every <li> MUST be inside a <ul> or <ol> wrapper. NEVER output bare <li> elements without a list container. Wrong: <li>Item</li>. Correct: <ul><li>Item</li></ul>.

*** SEO HEADING HIERARCHY (THIS IS THE ONLY RULE - FOLLOW IT) ***
DEPTH OF CONTENT: Each main substantive topic = H2. Main topics include: "What is [X]?", "The Core Principles of [X]", "How Much Does [X] Cost?", "Choosing the Right [X]", "Key Services Offered", "Benefits of [X]", style/trend sections, etc. These are NOT H3s - they are H2s. One H2 per major concept.
H2 = agents you dictate + every main substantive topic (What is X?, Core Principles, Costs, Styles, Benefits, etc.).
H3 = only truly subordinate subtopics under an H2 (e.g. under "Core Principles" you might have 2-3 H3s like "Scale & Proportion", "Balance"). MAX 3-5 H3s per H2.
H4 = rare; sub-subsections when 3+ levels.
FORBIDDEN: Nesting main topics (What is, Core Principles, Costs, Benefits) as H3s. Flattening everything to H3. More than 5 H3s under any H2.
Each heading = one short phrase (3–10 words). Never wrap paragraphs in heading tags.
${NO_COPYRIGHT_FAKE_BRAND_RULE}
${NO_FAKE_TESTIMONIALS_RULE}`;

const HTML_SEMANTIC_FOOTER_RULES = `
*** SEMANTIC FOOTER (<footer> - CONTENTINFO) ***
Always close the article body with **exactly one** <footer> **after** the last blueprint <h2> section (after that section’s closing tags). Inside <footer>, use only <p> and optional internal <a href> (same link rules as body). **No** <h2>, <h3>, lists, or tables inside <footer>.
**Never** put copyright lines, "©", "Copyright" + year, "All rights reserved", or invented brand names inside <footer> or anywhere at the end of the article.
Purpose for readers and assistive tech: (1) **first <p>**: one tight synthesis of the page topic and direct answer - natural language, may restate the primary keyword once if it reads well; (2) **optional second <p>**: one short next step (e.g. related service or contact) with **internal** links only when URLs exist - no new claims or keyword lists.
Do **not** paste duplicate sentences from the last section; the footer should **add** a scannable wrap-up or CTA, not repeat the full conclusion. Do **not** wrap the whole article in <footer> - only this trailing block.`;

const HTML_FORMAT_RULES_FULL_ARTICLE = `${HTML_FORMAT_RULES}${HTML_SEMANTIC_FOOTER_RULES}`;

const HARNESS_HTML_NO_FOOTER_ELEMENT_RULES = `
*** NO <footer> ELEMENT (HARNESS – NON-NEGOTIABLE) ***
You are writing **one section** of a blog post, not a page shell. **Never** output <footer>, </footer>, or role="contentinfo".
Allowed block/inline structure: <h2>, <h3>, <h4>, <p>, <a>, <ul>, <ol>, <li>, <table>, <figure>, <img> only.
Wrap-ups, conclusions, and CTAs belong in normal <p> (or lists/tables) under this section’s <h2>—never in <footer>.`;

const HARNESS_ANCHOR_TAG_FORMAT_RULE = `
*** ANCHOR TAG FORMAT (HARNESS – NON-NEGOTIABLE) ***
Every link MUST include visible anchor text inside <a>...</a> — never empty, never "here", never the raw URL.
External links: [[EXTERNAL:exact-url|exact-anchor]] only (code emits <a href="url">anchor</a>).
Scroll links: [[SCROLL:#id|phrase]] or <a href="#id">phrase</a> with a natural phrase.
Format: <a href="url-or-#id">anchor text</a>
FORBIDDEN on <a>: target=, rel=, class=, id=, style=, or any attribute besides href.
Never output partial tags, orphaned attributes (e.g. target="_blank" rel="noopener">), or markdown [text](url).`;

const HTML_FORMAT_RULES_HARNESS_SECTION = `${HTML_FORMAT_RULES}${HARNESS_HTML_NO_FOOTER_ELEMENT_RULES}${HARNESS_ANCHOR_TAG_FORMAT_RULE}`;

const HARNESS_MODE_SYSTEM_BLOCK = `**HARNESS MODE (NON-NEGOTIABLE)**: You write exactly ONE section per request.
- Output contains exactly ONE ## heading for this section (Overview: ## Overview plus mandatory key-points bullet list only).
- Forbidden: any other top-level ## from the plan, whole-article intros, conclusions, Overview scroll-link bullets in body sections, or repeating sibling sections.
- Full article cap: ${ARTICLE_MAX_WORDS} words total across all sections; write only this section's allocated budget.`;

export type BuildSystemPromptGenerationMode = "full_article" | "harness_section";

const ENTITY_FORBIDDEN = `Never use [city], [location], [area] or bracket placeholders. Never fake team lists; use "our team" / "our professionals" if needed.`;

function buildTargetSiteBlock(
  connectedSite: { name: string; siteUrl: string },
  normalizedSiteUrl: string,
  normalizedCurrentPageUrl: string,
  currentPageUrl?: string,
  siteSummary?: string,
  semrushExternalUrls?: string[],
  portfolioBlockedHosts?: string[],
  harnessSectionMode?: boolean,
): string {
  const linkRules = harnessSectionMode
    ? "Per-section link rules are in the user prompt for this harness step only — do not apply full-article link lists here."
    : LINK_RULES(normalizedSiteUrl, currentPageUrl, semrushExternalUrls, portfolioBlockedHosts);
  return `
=== TARGET SITE ===
Site: ${connectedSite.name} (${normalizedSiteUrl})${currentPageUrl ? ` | PAGE BEING OPTIMIZED: ${currentPageUrl} - Any link matching this URL is INVALID. Reject it. Never self-link.` : ""}${siteSummary ? ` | Site summary: ${siteSummary}` : ""}
${linkRules}
=== END TARGET SITE ===`;
}

function buildWordPressPostsBlock(
  posts: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>,
  availableForLinking: typeof posts,
  connectedSiteName: string,
  normalizedCurrentPageUrl: string,
  currentPageUrl?: string,
  primaryKeyword?: string
): string {
  const MAX_POSTS_FOR_LINKS = 30;
  const list = availableForLinking.slice(0, MAX_POSTS_FOR_LINKS).map((post, i) => {
    const title = (post.title || "").replace(/"/g, "'");
    const url = post.link || post.slug || "";
    return `${i + 1}. "${title}" | ${url}`;
  }).join("\n");

  const requiredLinkCount = availableForLinking.length;
  return `
=== LINKABLE URLs (ONLY SOURCE FOR INTERNAL LINKS) ===
From ${connectedSiteName}: ${posts.length} total (posts + pages + entity URLs), ${availableForLinking.length} available${currentPageUrl ? " (current page excluded)" : ""}${primaryKeyword ? ` | filtered: ${primaryKeyword}` : ""}

REQUIRED: You MUST include exactly ${requiredLinkCount} internal links in your article - one for each URL below. Use every URL in this list exactly once. No fewer, no more. Spread them across sections with natural, in-context anchor text.

${list}

Use ONLY these URLs for internal links. Copy exact URL from list - character-for-character. Do not invent or guess URLs. NEVER use example.com, example.org, or any placeholder domain. Knowledge base = content only, not for links. Content should align with themes/topics of these pages.${currentPageUrl ? ` CRITICAL: If a URL matches the page being optimized (${currentPageUrl}), it is INVALID - reject it. Same path or equivalent = self-link = do not use.` : ""}
=== END LINKABLE URLs ===`;
}

function buildEntityBlock(entityName: string): string {
  const general = getLocalEntityPhraseExamples(entityName, "general", 5);
  const expertise = getLocalEntityPhraseExamples(entityName, "expertise", 3);
  return `
=== ENTITY/LOCAL CONTENT: ${entityName} ===
Use location naturally: exact name 2–3×, broader terms (e.g. "area", "region") often. Vary phrases: ${general.map((ex) => `"${ex}"`).join(", ")}. Expertise examples: ${expertise.map((ex) => `"${ex}"`).join(", ")}. Replace 15–20% of keyword repeats with "local experts", "our team", "specialists". One specific local detail (landmark, neighborhood, geography). Authentic to readers ${getLocalGeneralPhrase(entityName, 0)}. ${ENTITY_FORBIDDEN}
=== END ENTITY ===`;
}

function buildRegularBlogBlock(): string {
  return `
=== REGULAR BLOG (NO ENTITY) ===
General informational post. No specific locations or placeholders. ${ENTITY_FORBIDDEN}
=== END REGULAR BLOG ===`;
}

export async function buildSystemPrompt(
  knowledgeBaseContext: string,
  apiKey: string,
  connectedSite?: { name: string; siteUrl: string },
  wordPressPosts?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>,
  currentPageUrl?: string,
  entity?: string,
  siteId?: string,
  primaryKeyword?: string,
  siteSummary?: string,
  semrushExternalUrls?: string[],
  portfolioBlockedHosts?: string[],
  contentKind?: "press_release",
  generationMode: BuildSystemPromptGenerationMode = "full_article",
): Promise<string> {
  const normalizedSiteUrl = connectedSite?.siteUrl ? connectedSite.siteUrl.replace(/\/+$/, "") : "";
  const normalizedCurrentPageUrl = currentPageUrl ? currentPageUrl.replace(/\/+$/, "").toLowerCase() : "";

  let postsToUse = wordPressPosts ?? [];
  if (siteId && primaryKeyword) {
    try {
      const cache = getSiteCache(siteId);
      if (cache) {
        postsToUse = searchSiteCache(siteId, primaryKeyword, 50).map((p) => ({
          id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt, link: p.link, date_gmt: p.date_gmt,
        }));
      }
    } catch {
      // keep wordPressPosts
    }
  }

  const pageSlug = normalizedCurrentPageUrl ? (normalizedCurrentPageUrl.split("/").pop() || "") : "";
  const availablePostsForLinking =
    postsToUse.length > 0 && normalizedCurrentPageUrl
      ? postsToUse.filter((post) => {
          if (!post.link) return true;
          const norm = post.link.replace(/\/+$/, "").toLowerCase();
          return (
            norm !== normalizedCurrentPageUrl &&
            (pageSlug.length < 3 || !norm.endsWith("/" + pageSlug))
          );
        })
      : postsToUse;

  const harnessUsesMarkdown = contentKind === "press_release";
  const isPressRelease = contentKind === "press_release";
  const isHarnessSection = generationMode === "harness_section" && !isPressRelease;
  const semrushExternalBlock = buildSemrushApprovedExternalBlock(
    semrushExternalUrls,
    harnessUsesMarkdown ? "markdown" : "html",
  );

  const targetSiteContext = connectedSite
    ? buildTargetSiteBlock(
        connectedSite,
        normalizedSiteUrl,
        normalizedCurrentPageUrl,
        currentPageUrl,
        siteSummary,
        semrushExternalUrls,
        portfolioBlockedHosts,
        isHarnessSection,
      )
    : "";

  const wordPressPostsContext =
    postsToUse.length > 0 && connectedSite
      ? generationMode === "harness_section"
        ? INTERNAL_LINK_PLACEHOLDER_PROMPT_BLOCK
        : buildWordPressPostsBlock(
            postsToUse,
            availablePostsForLinking,
            connectedSite.name,
            normalizedCurrentPageUrl,
            currentPageUrl,
            primaryKeyword,
          )
      : generationMode === "harness_section" && connectedSite
        ? INTERNAL_LINK_PLACEHOLDER_PROMPT_BLOCK
        : "";

  const hasEntity = entity?.trim() && entity.trim() !== "N/A";
  const entityContext = hasEntity ? buildEntityBlock(entity!.trim()) : buildRegularBlogBlock();

  const knowledgeBlock = knowledgeBaseContext
    ? `\n=== KNOWLEDGE BASE ===\n${knowledgeBaseContext}\n=== END KNOWLEDGE BASE ===`
    : "";

  const pk = primaryKeyword?.trim() ?? "";
  const writingKw = pk ? resolveWritingKeyword(pk) : "";
  const keywordPunctuationBlock = pk ? buildKeywordPunctuationPromptBlock(pk, writingKw) : "";
  const exactPrimaryEcho = writingKw
    ? ` Writing keyword for copy: "${writingKw}".`
    : pk
      ? ` Primary keyword string for exact-match checks: "${pk}".`
      : "";
  const exactPrimaryPerH2BlockFull =
    !isPressRelease && writingKw
      ? connectedSite
        ? `\n**EXACT PRIMARY PER H2 (MANDATORY)**: Under **every** <h2>, the section body must contain the **writing keyword** phrase **at least once** (same words and order as "${writingKw}"; normal sentence capitalization allowed; standard canonical hyphens required when KEYWORD PUNCTUATION block applies). Count paragraphs, list items, and table cells under that <h2> - include the phrase in that section's content. Every H2 including introduction and conclusion - no skipped sections.`
        : `\n**EXACT PRIMARY PER H2 (MANDATORY)**: In **every** ## section body, include the **writing keyword** phrase **at least once** (same words and order as "${writingKw}"; sentence casing OK; canonical hyphens when specified).`
      : "";
  const exactPrimaryPerH2BlockHarness =
    isHarnessSection && writingKw
      ? `\n**EXACT PRIMARY IN THIS SECTION (MANDATORY)**: In this section's body under its ## heading, include the **writing keyword** phrase **at least once** (same words and order as "${writingKw}"; sentence casing OK; canonical hyphens when KEYWORD PUNCTUATION block applies). Do not preview or repeat keyword coverage for sibling sections.`
      : "";
  const exactPrimaryPerH2Block = isHarnessSection ? exactPrimaryPerH2BlockHarness : exactPrimaryPerH2BlockFull;
  const firstParagraphRuleFull = connectedSite
    ? `\n**FIRST PARAGRAPH RULE (MANDATORY)**: The very first <p> of the article MUST directly address the primary keyword in its opening sentence. If the primary keyword is a question, state the question and give a clear, direct answer immediately - do NOT open with generic background, context, or tangential information. Never just allude to the keyword; name it and address it head-on. Example: if the keyword is "can a night guard straighten teeth", do NOT open with "Night guards serve a crucial role in safeguarding your oral health" - instead open with "Many people wonder whether a night guard can straighten teeth. The short answer is no - night guards are not designed to realign teeth."`
    : "";
  const generalFocusRule = isPressRelease
    ? `\n**PRESS RELEASE MODE**: Neutral AP/wire style. Output **Markdown only** (## headings, paragraphs, [anchor](url), blockquotes).${
        pk
          ? ` Topic and keyword: "${pk}". Write about the connected business in the context of this topic; optional title override is a headline hint only.${exactPrimaryEcho}`
          : " Use the article title and purpose as the topic anchor."
      }
Do not invent grand openings, expansions, product launches, or "today announced" stories unless the user supplied that event in ACF or KNOWLEDGE BASE.
**NATURAL LANGUAGE**: Write like a journalist, not an SEO brief. Use the topic keyword sparingly (about once in the full release); prefer synonyms and plain phrasing. Do not repeat the exact keyword in every ## heading or paragraph.
**DATELINE**: Wire dateline from ACF appears **only in section 1**, first paragraph. Later sections must not repeat the dateline or start paragraphs with a calendar date. Never use bracket placeholders ([CITY], [STATE], [Month DD, YYYY], or similar).
No fabricated testimonials, customer quotes, or named spokespeople unless user-supplied text appears in KNOWLEDGE BASE or ACF blocks.
Syndication-ready copy; follow each harness section scope exactly.
Each ## subhead is topical wire copy (service, expertise, or reader need)—not a label for section type and not a fake news headline.`
    : isHarnessSection
      ? `\nContent focus: Optimize for the page topic and primary keyword. Primary keyword is the main subject of the page, not the company name or a place.${exactPrimaryEcho}
${HARNESS_MODE_SYSTEM_BLOCK}${exactPrimaryPerH2Block}`
      : connectedSite
      ? `\nContent focus: Optimize for the page topic and primary keyword. Primary keyword is the main subject of the page, not the company name or a place.${exactPrimaryEcho}
${firstParagraphRuleFull}${exactPrimaryPerH2Block}`
      : pk
        ? `\nContent focus: Optimize for the page topic and primary keyword.${exactPrimaryEcho}${exactPrimaryPerH2Block}`
        : "";
  const linkRuleBlock =
    connectedSite && contentKind !== "press_release" && generationMode === "full_article"
      ? `\n${CRITICAL_LINK_RULE}`
      : "";
  const semrushOverridesWikipediaOnly =
    Array.isArray(semrushExternalUrls) && semrushExternalUrls.some((u) => String(u ?? "").trim()) &&
    generationMode === "full_article"
      ? `\n**SEMRUSH URLs - OVERRIDE**: When the "APPROVED EXTERNAL URLs (SEMRUSH)" block appears above, those exact third-party URLs are allowed and required per that block. The line in CRITICAL_LINK_RULE that limits externals to Wikipedia-only does **not** apply to URLs listed in that Semrush block (entity Wikipedia remains optional in addition).`
      : "";
  // Bulk harness = Markdown (press release and connected WordPress). Content Optimizer full article = HTML.
  const formatRules =
    contentKind === "press_release" || !connectedSite || generationMode === "harness_section"
      ? MARKDOWN_FORMAT_RULES
      : HTML_FORMAT_RULES_FULL_ARTICLE;
  const core = `You are an expert SEO content AI. Use the API key for content tasks. Output must be optimized, on-topic, and structurally correct.
${formatRules}${generalFocusRule}${keywordPunctuationBlock}
${knowledgeBlock}${entityContext}${targetSiteContext}${semrushExternalBlock}${wordPressPostsContext}${linkRuleBlock}${semrushOverridesWikipediaOnly}`;
  await ensureMasterInstructionsInMemory(siteId);
  return appendUniversalContentRulesToSystemPrompt(
    appendMasterInstructionsToSystemPrompt(core, siteId),
  );
}

const GSC_CONTENT_INTEGRATION_BLOCK = `=== SEARCH CONSOLE QUERIES (real Google searches for this page) ===
Below is JSON: gsc_keywords_for_url + rows of query strings from your site’s Search Console. Do NOT print, list, or paste this JSON in the article.

**How to use it**
1. Read the **article structure** (sections below) and the JSON together.
2. **Choose 10–20** queries that best fit the blueprint: match each section’s topic and intent. Skip queries that are off-topic, redundant, or awkward.
3. **Spread** chosen phrasings **across multiple sections** (intro, body, FAQ, etc.). Do **not** put most queries in one paragraph or one section.
4. Integrate **naturally** (semantic variations, short phrases, conversational wording). No keyword stuffing, no repeating the same long query many times.
5. You **do not** need to use every query in the JSON - **judgment over coverage**.
=== END SEARCH CONSOLE ===`;

const SEMRUSH_KEYWORDS_RAG_BLOCK = `=== SEMRUSH KEYWORD LISTS (related searches / URL organic phrases) ===
Below is JSON: url_organic and phrase_related keyword phrases from Semrush (no metrics). Do NOT print, list, or paste this JSON in the article.

**How to use it**
1. Read the **article structure** (sections below) and the JSON together.
2. **Choose** phrases that fit the blueprint and searcher intent; skip off-topic or awkward strings.
3. **Spread** natural wording across sections (intro, body, FAQ, etc.). No keyword stuffing.
4. Prefer **semantic variation**; do not repeat the same long-tail string many times.
5. You **do not** need to use every phrase - **judgment over coverage**. If skipped or empty, ignore this block.
=== END SEMRUSH KEYWORDS ===`;

const SEMRUSH_CLUSTER_SCATTER_BLOCK = `=== SEMRUSH KEYWORD CLUSTERS + SCATTER PLAN ===
Below is JSON: semrush_keyword_clusters with **clusters** (related phrases) and **scatter** (which clusters belong in which part of the article: introduction, body_early, body_mid, body_late, faq, conclusion). Do NOT print this JSON in the article.

**How to use it**
1. Map each **zone** in scatter to the closest matching **H2 sections** in the structure below (intro → first H2; body_* → middle H2s in order; faq → FAQ/table section; conclusion → closing H2).
2. Work in phrases from the assigned **cluster keywords** only in those zones - natural wording, no lists of keywords in the body.
3. Prefer **semantic variation**; do not repeat the same long-tail string in multiple zones.
4. If a cluster does not fit a section’s topic, skip it - judgment over coverage.
=== END SEMRUSH CLUSTERS ===`;

export const buildUserPrompt = (
  flowTitle: string,
  flowPurpose: string,
  sectionsPrompt: string,
  connectedSite?: { name: string; siteUrl: string },
  entity?: string,
  acfContext?: AIDrivenACFContext,
  hasWordPressPosts?: boolean,
  currentPageUrl?: string,
  gscKeywordsContext?: string,
  semrushKeywordsContext?: string,
  semrushScatterContext?: string,
  semrushExternalUrls?: string[],
  portfolioBlockedHosts?: string[],
): string => {
  const normalizedSiteUrl = connectedSite?.siteUrl ? connectedSite.siteUrl.replace(/\/+$/, "") : "";
  const hasSemrushExternals = Array.isArray(semrushExternalUrls) && semrushExternalUrls.some((u) => u?.trim());
  const linkBlock = connectedSite
    ? `\nLinks: HTML format <a href="url">text</a> only. Internal = ${normalizedSiteUrl} only. ${
        hasSemrushExternals
          ? `External = entity Wikipedia when applicable, OR only URLs under APPROVED EXTERNAL URLs (SEMRUSH) in the system prompt - exact hrefs only. No other external sites.`
          : `External = ONLY entity Wikipedia page (when entity exists). No other external sites.`
      } NEVER link to competitors or businesses in the same industry. No "External Resources" sections. ${LINK_RULES(normalizedSiteUrl, currentPageUrl, semrushExternalUrls, portfolioBlockedHosts)}\n`
    : "";

  const entityName = entity?.trim() ?? "";
  const hasEntity = entityName && entityName !== "N/A";
  const entityBlock = hasEntity
    ? (() => {
        const general = getLocalEntityPhraseExamples(entityName, "general", 6);
        const expertise = getLocalEntityPhraseExamples(entityName, "expertise", 4);
        return `
Entity: ${entityName}. Use varied phrases: ${general.map((ex) => `"${ex}"`).join(", ")}. Expertise: ${expertise.map((ex) => `"${ex}"`).join(", ")}. One local "fun fact". Reduce keyword repetition; use "our team", "specialists". Short anchors (2–5 words). No nested anchors. ${ENTITY_FORBIDDEN}`;
      })()
    : `
No entity. General post; no locations or placeholders. ${ENTITY_FORBIDDEN}`;

  const acfParts: string[] = [];
  if (acfContext?.promptModifier?.trim()) acfParts.push(`Prompt modifier: ${acfContext.promptModifier.trim()}`);
  if (acfContext?.keywordFocus?.trim()) acfParts.push(`Keyword focus: ${acfContext.keywordFocus.trim()}`);
  if (acfContext?.serviceArea?.trim()) acfParts.push(`Service area: ${acfContext.serviceArea.trim()}`);
  if (acfContext?.seoResearch?.trim()) {
    acfParts.push(
      `SEO content brief (JSON text in ACF seo_research - typically merged SERP/GSC/Semrush-style research from Overview; parse for intent - do not paste verbatim or keyword-stuff):\n${acfContext.seoResearch.trim()}`,
    );
  }
  if (acfContext?.contentRelevantFields && typeof acfContext.contentRelevantFields === "object") {
    for (const [k, v] of Object.entries(acfContext.contentRelevantFields)) {
      if (v?.trim()) acfParts.push(`${k}: ${v.trim()}`);
    }
  }
  const generalFocusRule = "Optimize for the page topic and primary keyword; the primary keyword is the main subject of the page, not the company name or a place.";
  if (acfParts.length) acfParts.push(generalFocusRule);
  const acfBlock = acfParts.length ? `\n=== ACF ===\n${acfParts.join("\n")}\n=== END ACF ===\n` : "";

  const gscBlock =
    gscKeywordsContext && gscKeywordsContext.trim().length > 0
      ? `\n${GSC_CONTENT_INTEGRATION_BLOCK}\n${gscKeywordsContext.trim()}\n`
      : "";

  const semrushKeywordsBlock =
    semrushKeywordsContext && semrushKeywordsContext.trim().length > 0
      ? `\n${SEMRUSH_KEYWORDS_RAG_BLOCK}\n${semrushKeywordsContext.trim()}\n`
      : "";

  const semrushScatterBlock =
    semrushScatterContext && semrushScatterContext.trim().length > 0
      ? `\n${SEMRUSH_CLUSTER_SCATTER_BLOCK}\n${semrushScatterContext.trim()}\n`
      : "";

  const legacySectionCount = Math.max(1, (sectionsPrompt.match(/<h2[\s>]/gi) || []).length);
  const legacyArticleCapLine = buildHarnessArticleCapLine(legacySectionCount);

  return [
    legacyArticleCapLine,
    `Entire article MUST NOT exceed ${ARTICLE_MAX_WORDS} words.`,
    "Write a complete professional blog article in HTML ONLY. Every element must be HTML: <h2>, <h3>, <p>, <a href=\"...\">...</a>, <ul><li>, <ol><li>, <table>, <footer> (closing contentinfo block per system prompt). NEVER use markdown (##, [text](url), |, -).",
    `Title: ${flowTitle || "Untitled Article"}`,
    `Purpose: ${flowPurpose}`,
    acfBlock,
    gscBlock,
    semrushKeywordsBlock,
    semrushScatterBlock,
    "Do not include H1 or 'Article Title:' in body. Start with the first H2 from the structure below.",
    "Use ONLY the headings below; do not add, remove, or change heading levels or counts.",
    sectionsPrompt,
    "--- Output ---",
    connectedSite && !hasWordPressPosts
      ? "One focused paragraph per heading unless section block says otherwise. CRITICAL: Do NOT add any internal links - no linkable URLs from API. Only add internal links when the system prompt includes a linkable URLs list (posts, pages, entities)."
      : "One focused paragraph per heading unless section block says otherwise. 3–5 internal links per section (from linkable URLs list); natural anchor text; follow link rules from system prompt.",
    "Required: at least 1 <table>, 1 <ul><li>, 1 <ol><li>; distribute across sections. ALL tables (including FAQ) = HTML <table> only. NEVER | pipes | or |-|-|. FAQ table: <table><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody><tr><td>Q</td><td>A</td></tr></tbody></table>. Steps/sequences/processes = <ol><li> ONLY (never bullets). Features/benefits = <ul><li>. No nested sublists unless [LIST] requested.",
    hasSemrushExternals
      ? "Semrush externals - HARD REQUIREMENT: follow APPROVED EXTERNAL URLs (SEMRUSH) in the system prompt (count + exact hrefs). Integrate links in **body copy** as neutral reference / knowledge-base citations (vary wording; no boilerplate after every heading). Never frame as where to buy or not buy. Copy each href EXACTLY from the numbered list; do not invent URLs. Before you finish, verify the HTML contains the required distinct outbound <a href> to those list URLs."
      : "Do not mention external sites (Houzz, Reddit, etc.) or competitors. Wikipedia only for entity name (location) when entity exists - never for topics or products.",
    entityBlock,
    linkBlock,
    "Begin with the first <h2> (no H1):",
    "Never append copyright lines, ©, Copyright + year, All rights reserved, or invented brand/site names.",
  ].join("\n");
};

const HARNESS_SECTION_SCOPE_RULE_HTML = `**HARNESS – SINGLE SECTION ONLY**:
- Output exactly ONE section: the block under "Section to write". Start with that section's required heading (<h2> or FAQ <h2> as specified). Do NOT add any other top-level H2 from the plan in this response.
- Your response must contain **exactly 1** <h2> tag (Overview: <h2>Overview</h2> plus mandatory key-points <ul> only). A second <h2> makes the response invalid.
- Flat structure: never nest <h2> inside <h2>.
- Do not write a full article, article intro for the whole piece, or closing for the whole piece—only this section.
- Other H2s in the plan are written in separate harness steps. Do not include their headings, duplicate their topics, or append Overview scroll-link <ul> lists in body sections.
- Cover only this section's topic. Do not restate the whole article thesis or preview sibling H2s from the plan.
- Every paragraph ends with a complete sentence. Never output a standalone word (e.g. "Our") or partial link text.
- STOP: after your last </p>, </table>, </ol>, or </ul> (Overview), output nothing else.
- **Never** use <footer> or </footer> in this section. No exceptions.`;

export const TITLE_WELL_KNOWN_ACRONYMS_RULE = `**Well-known acronyms (mandatory)**:
- Spell recognized initialisms in **ALL CAPS**, even when every other title word uses Title Case.
- Examples: CRA, RRSP, TFSA, RESP, CPP, OAS, RRIF, HST, GST, IRS, SEO, KWB.
- Forbidden: Cra, Rrsp, rrsp, or other mixed/lowercase forms when the term is a standard acronym in the article's domain.`;

export const TITLE_CASE_RULE = `**Title Case (mandatory - blog headline style)**:
- Capitalize the **first letter of every word** in the headline, including articles, conjunctions, and short prepositions (A, An, The, And, Or, But, For, In, On, At, To, Of, With, Near, Vs).
- Apply the same rule **after** a question mark or exclamation point (every word in that segment too).
- The focus keyword input is often all-lowercase. That is input only. In the title, rewrite every keyword word in Title Case. Never leave the keyword span lowercase inside an otherwise Title Case headline.
- Good: "Best Hunter Douglas Blinds Near Edmonton City Centre" (keyword was "hunter douglas blinds").
- Forbidden: "Best hunter douglas blinds Near Edmonton City Centre" (keyword left lowercase).
- Examples: "Need A Holding Company? Benefits And Considerations", "Canada Arctic Investment And Security Infrastructure", "When CRA Tax Instalments Are Required And How To Pay".
- Forbidden: "Need a Holding Company? …", "Canada arctic investment: …", "when CRA tax instalments are required", or any headline that leaves **any** word starting with a lowercase letter (except mixed-case brand names like QuickBooks when already correct).`;

/** Natural front-load and single-mention keyword discipline for all title agents. */
export const TITLE_KEYWORD_WEAVING_RULE = `**Keyword weaving (mandatory)**:
- WRITING KEYWORD (canonical punctuation when KEYWORD PUNCTUATION block applies) appears **exactly once** with the same words and word order. Casing in the title MUST be full Title Case (do not paste lowercase keyword casing).
- **Grammar first**: the full title must read as one coherent, polished phrase written by a human editor. The keyword must perform a natural grammatical role inside that phrase.
- **Front-load naturally**: open with the keyword woven into the first readable phrase (first ~5 words). Choose the title angle and sentence structure first, then integrate the keyword with natural connecting words.
- Never paste the keyword as a standalone block and bolt a generic phrase, audience label, benefit fragment, or subtitle onto it. Rewrite the whole title until every word flows as one thought.
- **No colons**: colons are **forbidden** in every title. Never \`[keyword/topic]: [subtitle]\`. Join with natural glue — "and", "for", "vs", "without", "how to", "what", "why", "when", or end with "?". One flowing headline only.
- **Synthesis, not concatenation**: when multiple candidate titles exist, write one fresh headline from their intent; do not stitch candidate strings together.
- **Good**: "Solar Panel Costs And What To Expect", "Solar Installation Cost Overview For Homeowners", "Blackout Blinds Benefits For Sleep", "How To Choose Between Roman Shades And Curtains"
- **Bad**: "Solar Panel Costs: What To Expect For Your Home", "Solar Installation Cost: A Comprehensive Overview", "Smart Blinds Guide: Smart Blinds: A Complete Guide", "Cellular Shades Types: Cellular Shades: Types Explained"`;

/** Editorial judgment for accurate, neutral, non-clickbait SEO titles. */
export const TITLE_ANTI_CLICKBAIT_RULE = `**SEO editorial standard (mandatory)**:
- Act as a senior SEO content title specialist. Use editorial judgment to write an accurate, specific, **neutral** title aligned with the page content and real search intent.
- Prefer plain, factual wording. Reject clickbait, sensationalism, manufactured urgency, exaggerated importance, empty promotional claims, and sales-driven calls to action.
- Avoid promotional hype verbs and marketing stock language such as boost, maximize, unlock, and similar. Prefer calm, descriptive phrasing over salesy intensity.
- Treat the title as a neutral page label, not an advertisement. Do not use imperative, second-person, ownership, immediate-action, or acquisition framing.
- Make the title useful on its own and proportionate to what the page actually delivers.`;

/** Editorial judgment for accurate, neutral, non-clickbait meta descriptions. */
export const META_DESCRIPTION_ANTI_CLICKBAIT_RULE = `**SEO editorial standard (mandatory)**:
- Act as a senior SEO content specialist. Use editorial judgment to summarize the page accurately in **neutral**, factual language and communicate its concrete value to the searcher.
- Prefer plain, restrained wording. Reject clickbait, sensationalism, manufactured urgency, exaggerated importance, empty promotional claims, and sales-driven calls to action.
- Avoid promotional hype verbs and marketing stock language such as boost, maximize, unlock, and similar. Prefer calm, descriptive phrasing over salesy intensity.
- Keep every claim proportionate to what the page actually supports.`;

/** WordPress post title + SEO title (bulk publish, blueprint, merge, meta). */
export const BULK_WORDPRESS_POST_TITLE_RULE = `**WORDPRESS POST TITLE (mandatory)**:
- Output **one** title string for the live post H1 and the SEO title field when used as the post title.
- **NO COLONS** in the title. Never topic-then-subtitle. Rewrite any colon in candidate titles into one flowing phrase.
${TITLE_CASE_RULE}
${TITLE_KEYWORD_WEAVING_RULE}
${TITLE_ANTI_CLICKBAIT_RULE}
- **Focus keyword**: same words and order as WRITING KEYWORD, always in Title Case in the title even if the keyword input is lowercase. Use standard canonical hyphens when the KEYWORD PUNCTUATION block specifies them (X-ray, e-commerce). Do not add decorative punctuation (if keyword is "veneers vs crowns", do not write "veneers vs. crowns" in the title).
- **Length**: Prefer a complete natural headline. **Never truncate, never cut mid-word, never strip trailing words.** Upload/return the full title.
- **No** site name, brand prefix, or pipe suffix (no "Brand | …"). Topic-focused title only.
${TITLE_WELL_KNOWN_ACRONYMS_RULE}`;

const HARNESS_SECTION_LENGTH_RULE_HTML = `**HARNESS LENGTH (mandatory)**:
- Body prose in this section: at most **2** <p> tags (use **3** only when this section block explicitly requires a list/table-heavy block).
- Each <p>: at most **3** sentences. Moderately short paragraphs only.
- Every paragraph MUST end with a complete sentence (. ! ?). If you cannot fit another sentence, finish the current sentence and STOP — never stop mid-sentence or mid-word.
- NEVER output Semrush API, MCP, subscription, or tool error messages in article HTML.
- Forbidden: full-article intros ("this guide will explore…"), repeating other outline H2 topics, or restating content that belongs in other sections.`;

const HARNESS_SECTION_LENGTH_RULE_MARKDOWN = `**HARNESS LENGTH (mandatory)**:
- Body prose in this section: at most **2** paragraphs after the ## line (use **3** only when this block explicitly requires list/table-heavy content).
- Each paragraph: at most **3** sentences.
- Forbidden: wire-style repetition of other blocks, full-release previews, or restating the whole thesis.`;

const HARNESS_SECTION_SCOPE_RULE_MARKDOWN = `**HARNESS – SINGLE SECTION ONLY**:
- Output exactly ONE section: the block under "Section to write". Start with that section's required ## heading as specified. Do NOT add any other top-level ## sections from the plan in this response.
- Do not write a full article, article intro for the whole piece, or closing for the whole piece—only this section.
- Other sections in the plan are written in separate steps. Do not include their headings or duplicate their topics as full sections.`;

function formatHarnessH2PlanBlock(
  allSectionTitles: string[],
  currentSectionIndex: number,
  assignedTitle: string,
): string {
  const planLines = allSectionTitles.map((title, i) => {
    if (i === currentSectionIndex) {
      return `${i + 1}. ${title}  ← YOU WRITE THIS ONE ONLY`;
    }
    return `${i + 1}. ${title}  [NOT YOUR SECTION — separate harness step]`;
  });
  const forbiddenSiblings = allSectionTitles
    .filter((_, i) => i !== currentSectionIndex)
    .map((t) => `- ${t}`);
  const forbiddenBlock =
    forbiddenSiblings.length > 0
      ? forbiddenSiblings.join("\n")
      : "- (no sibling sections besides yours)";
  const forbiddenSiblingH2List =
    forbiddenSiblings.length > 0
      ? forbiddenSiblings.map((t) => `- ${t}`).join("\n")
      : "";
  return [
    "=== ARTICLE H2 PLAN (titles only — write ONLY your assigned section) ===",
    ...planLines,
    "=== END PLAN ===",
    "",
    "FORBIDDEN IN YOUR OUTPUT:",
    `- Any ## heading except "${assignedTitle}"`,
    "- Any Overview scroll-link bullet list (Overview step only)",
    "- Any content belonging to these sibling sections:",
    forbiddenBlock,
    forbiddenSiblingH2List
      ? `\nThese must NOT appear as ## heading text in your output:\n${forbiddenSiblingH2List}`
      : "",
  ].join("\n");
}

/**
 * User prompt for one harness step (one blueprint agent / one H2-equivalent).
 * Reuses the same SEO/entity/link blocks as `buildUserPrompt` but scopes the writing task to a single section.
 */
export const buildBulkHarnessSectionUserPrompt = (
  flowTitle: string,
  flowPurpose: string,
  singleSectionPrompt: string,
  outlineBlock: string,
  otherSectionTitles: string[],
  currentSectionIndex: number,
  totalSections: number,
  connectedSite?: { name: string; siteUrl: string },
  entity?: string,
  acfContext?: AIDrivenACFContext,
  hasWordPressPosts?: boolean,
  currentPageUrl?: string,
  gscKeywordsContext?: string,
  semrushKeywordsContext?: string,
  semrushScatterContext?: string,
  semrushExternalUrls?: string[],
  portfolioBlockedHosts?: string[],
  contentKind?: "press_release",
  pressReleaseTopic?: string,
  /** Overview only: planned same-page #anchor citation targets. */
  inPageAnchorBlock?: string,
  /** Overview only: exact entity Wikipedia URL when CSV/row provides one (entity pages). */
  entityWikipediaUrl?: string,
  /** Harness section display title — exact <h2> text (non-Overview body sections). */
  harnessSectionDisplayTitle?: string,
  /** Stored ACF focus keyword (falls back to acfContext.keywordFocus). */
  primaryKeyword?: string,
  /** Blog harness: ordered H2 titles for plan-only context (replaces full outline block). */
  allSectionTitles?: string[],
): string => {
  const normalizedSiteUrl = connectedSite?.siteUrl ? connectedSite.siteUrl.replace(/\/+$/, "") : "";
  const storedKeyword = (primaryKeyword ?? acfContext?.keywordFocus ?? "").trim();
  const keywordPunctuationBlock = storedKeyword
    ? buildKeywordPunctuationPromptBlock(storedKeyword)
    : "";
  const hasSemrushExternals = Array.isArray(semrushExternalUrls) && semrushExternalUrls.some((u) => u?.trim());
  const isPressReleaseHarness = contentKind === "press_release";
  const isOverviewSection = Boolean(inPageAnchorBlock?.trim());
  const entityNameForWiki = entity?.trim() ?? "";
  const wikiUrlForOverview = entityWikipediaUrl?.trim() ?? "";
  const overviewHasEntityWiki =
    isOverviewSection &&
    Boolean(entityNameForWiki) &&
    entityNameForWiki !== "N/A" &&
    Boolean(wikiUrlForOverview);
  const overviewLinkBlock = buildOverviewLinkRulesBlock({
    entity: entityNameForWiki,
    wikipediaUrl: wikiUrlForOverview,
  });
  const linkBlock = isOverviewSection
    ? overviewLinkBlock
    : connectedSite
      ? `\nLinks: Internal = ${normalizedSiteUrl} only when natural via [[LINK:query|anchor]]. ${
          hasSemrushExternals
            ? isPressReleaseHarness
              ? "External = only the APPROVED EXTERNAL URL in the system prompt; at most one [anchor](exact-url) in this section if it fits, and only one such link in the full release."
              : "User-specified externals only: [[EXTERNAL:exact-url|exact-anchor]] copied from the APPROVED EXTERNAL URLs block — never [anchor](url). No other third-party sites."
            : "No third-party external links. Forbidden: [[EXTERNAL:...]], raw https:// in prose, and third-party <a href=\"https://...\">. Internal links and entity Wikipedia only when listed."
        } NEVER link to competitors. No "External Resources" sections.\n`
      : "";

  const entityName = entity?.trim() ?? "";
  const hasEntity = entityName && entityName !== "N/A";
  const entityBlock = hasEntity
    ? isOverviewSection
      ? `
Entity: ${entityName}. Use varied phrases: ${getLocalEntityPhraseExamples(entityName, "general", 6).map((ex) => `"${ex}"`).join(", ")}. Expertise: ${getLocalEntityPhraseExamples(entityName, "expertise", 4).map((ex) => `"${ex}"`).join(", ")}. One local "fun fact". Reduce keyword repetition; use "our team", "specialists". Overview lead paragraphs only: optional entity Wikipedia link per Overview LINKS block — no site links or # scroll links in lead prose. ${ENTITY_FORBIDDEN}`
      : (() => {
        const general = getLocalEntityPhraseExamples(entityName, "general", 6);
        const expertise = getLocalEntityPhraseExamples(entityName, "expertise", 4);
        return `
Entity: ${entityName}. Use varied phrases: ${general.map((ex) => `"${ex}"`).join(", ")}. Expertise: ${expertise.map((ex) => `"${ex}"`).join(", ")}. One local "fun fact". Reduce keyword repetition; use "our team", "specialists". Short anchors (2–5 words). No nested anchors. ${ENTITY_FORBIDDEN}`;
      })()
    : `
No entity. General post; no locations or placeholders. ${ENTITY_FORBIDDEN}`;

  const acfParts: string[] = [];
  if (acfContext?.promptModifier?.trim()) acfParts.push(`Prompt modifier: ${acfContext.promptModifier.trim()}`);
  if (acfContext?.keywordFocus?.trim()) acfParts.push(`Keyword focus: ${acfContext.keywordFocus.trim()}`);
  if (acfContext?.serviceArea?.trim()) acfParts.push(`Service area: ${acfContext.serviceArea.trim()}`);
  if (acfContext?.seoResearch?.trim()) {
    acfParts.push(
      `SEO content brief (JSON text in ACF seo_research - typically merged SERP/GSC/Semrush-style research from Overview; parse for intent - do not paste verbatim or keyword-stuff):\n${acfContext.seoResearch.trim()}`,
    );
  }
  if (acfContext?.contentRelevantFields && typeof acfContext.contentRelevantFields === "object") {
    for (const [k, v] of Object.entries(acfContext.contentRelevantFields)) {
      if (v?.trim()) acfParts.push(`${k}: ${v.trim()}`);
    }
  }
  if (!isPressReleaseHarness) {
    const generalFocusRule =
      "Optimize for the page topic and primary keyword; the primary keyword is the main subject of the page, not the company name or a place.";
    if (acfParts.length) acfParts.push(generalFocusRule);
  }
  const acfBlock = acfParts.length ? `\n=== ACF ===\n${acfParts.join("\n")}\n=== END ACF ===\n` : "";

  const gscBlock =
    gscKeywordsContext && gscKeywordsContext.trim().length > 0
      ? `\n${GSC_CONTENT_INTEGRATION_BLOCK}\n${gscKeywordsContext.trim()}\n`
      : "";

  const semrushKeywordsBlock =
    semrushKeywordsContext && semrushKeywordsContext.trim().length > 0
      ? `\n${SEMRUSH_KEYWORDS_RAG_BLOCK}\n${semrushKeywordsContext.trim()}\n`
      : "";

  const semrushScatterBlock =
    semrushScatterContext && semrushScatterContext.trim().length > 0
      ? `\n${SEMRUSH_CLUSTER_SCATTER_BLOCK}\n${semrushScatterContext.trim()}\n`
      : "";

  const siblingBlock = isPressReleaseHarness
    ? "Other blocks of this release are written separately. Output only this block with your own invented ## subhead; do not preview or duplicate other blocks."
    : otherSectionTitles.length > 0
      ? `Other H2s in this article plan (titles only; do not duplicate these as additional top-level H2s or repeat them as full sections):\n${otherSectionTitles.map((t) => `- ${t}`).join("\n")}`
      : "No sibling headings besides yours—still write only this section.";

  const assignedTitle =
    harnessSectionDisplayTitle?.trim() ||
    (isOverviewSection ? "Overview" : allSectionTitles?.[currentSectionIndex]?.trim()) ||
    "";
  const h2PlanBlock =
    !isPressReleaseHarness && allSectionTitles && allSectionTitles.length > 0 && assignedTitle
      ? formatHarnessH2PlanBlock(allSectionTitles, currentSectionIndex, assignedTitle)
      : "";

  const prTopicBlock =
    isPressReleaseHarness && pressReleaseTopic?.trim()
      ? `\n**RELEASE TOPIC (light touch)**: ${pressReleaseTopic.trim()} — inform the angle; do not repeat the exact phrase in every ## or paragraph.`
      : "";

  const scopeRule = HARNESS_SECTION_SCOPE_RULE_MARKDOWN;
  const formatLine =
    "Write in MARKDOWN ONLY for this section: ##, ###, paragraphs, [text](url), - lists, blockquotes (>). NEVER HTML.";

  const lengthRule = HARNESS_SECTION_LENGTH_RULE_MARKDOWN;

  const articleBudgetBlock = isPressReleaseHarness
    ? ""
    : buildHarnessArticleBudgetBlock(currentSectionIndex, totalSections);

  const planOrOutlineBlock = h2PlanBlock
    ? h2PlanBlock
    : [
        "=== FULL ARTICLE OUTLINE (for context; write ONLY the current section) ===",
        outlineBlock,
        "=== END OUTLINE ===",
        siblingBlock,
      ].join("\n");

  return [
    buildBlacklistRagBlock(),
    scopeRule,
    FORBIDDEN_WORDS_USER_PROMPT_REMINDER,
    lengthRule,
    articleBudgetBlock,
    keywordPunctuationBlock,
    formatLine,
    prTopicBlock,
    `Article title: ${flowTitle || "Untitled Article"}`,
    `Purpose: ${flowPurpose}`,
    `Section ${currentSectionIndex + 1} of ${totalSections} (harness pass).`,
    isPressReleaseHarness
      ? "Before body text, output exactly one ## line you invent: a topical subhead for the keyword and business. Do not use outline or template wording as the ## text. Do not repeat the wire dateline or a calendar date unless this is section 1."
      : "",
    planOrOutlineBlock,
    "=== SECTION TO WRITE (follow heading and structure exactly) ===",
    singleSectionPrompt,
    "=== END SECTION ===",
    harnessSectionDisplayTitle?.trim() && !isPressReleaseHarness && !isOverviewSection
      ? `NON-NEGOTIABLE ## TITLE: The first ## line MUST be exactly: "${harnessSectionDisplayTitle.trim()}" — no paraphrase, reorder, or substitute wording.`
      : "",
    inPageAnchorBlock?.trim() ? inPageAnchorBlock.trim() : "",
    "--- Output ---",
    isOverviewSection
      ? overviewHasEntityWiki
        ? `Output ## Overview, 1-2 lead paragraphs (NO em dashes; obey WORD BLACKLIST above), then a - bullet list with one item per IN-PAGE anchor. Each bullet: **Label**: one sentence with exactly ONE [2-4 words](#exact-id). FORBIDDEN: second link in the same bullet, duplicate #id links, or "including [link]" phrasing. Optional entity Wikipedia in first paragraph: [${entityNameForWiki}](${wikiUrlForOverview}). Never "see below". Stop after the bullet list.`
        : 'Output ## Overview, 1-2 lead paragraphs (NO em dashes; obey WORD BLACKLIST above), then a - bullet list with one item per IN-PAGE anchor. Each bullet: one sentence with exactly ONE [2-4 words](#exact-id). FORBIDDEN: second link in the same bullet, duplicate #id links, or "including [link]" phrasing. Never "see below". Stop after the bullet list.'
      : connectedSite && !hasWordPressPosts
      ? "CRITICAL: Do NOT add internal links—no linkable URLs from API—for this section unless the system prompt lists URLs."
      : "Use 1–2 [[LINK:sitemap search phrase|anchor text]] placeholders per section woven into complete sentences (follow INTERNAL LINK PLACEHOLDERS in system prompt). Never use raw https:// internal URLs in body sections.",
    "Follow the section block for lists or blockquotes. Use Markdown pipe tables only. NEVER HTML.",
    hasSemrushExternals
      ? isPressReleaseHarness
        ? "Approved external URL: include in this section only if it fits naturally and the full release does not already require the link elsewhere; use [anchor](exact-url)."
        : "User-specified externals only: when this section needs one, insert [[EXTERNAL:exact-url|exact-anchor]] copied from the APPROVED EXTERNAL URLs block — never [anchor](url)."
      : isPressReleaseHarness
        ? "No external links unless listed in the system prompt."
        : "No third-party external links. Forbidden: [[EXTERNAL:...]], raw https://, and third-party <a href>. Wikipedia only when entity URL is listed.",
    isPressReleaseHarness ? "" : entityBlock,
    linkBlock,
    acfBlock,
    gscBlock,
    semrushKeywordsBlock,
    semrushScatterBlock,
    isPressReleaseHarness
      ? "Do not include an H1 or 'Article Title:' line. Output must begin with your invented ## subhead, then the body."
      : "Do not include an H1 or 'Article Title:' line. Start with this section's required ## heading.",
    "Never append copyright lines, ©, Copyright + year, All rights reserved, or invented brand/site names.",
  ].join("\n");
};
