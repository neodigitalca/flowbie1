import { AgentConfig } from "@/types/agent-config";
import { ARTICLE_MAX_WORDS } from "@/lib/content-generation/article-length-policy";
import { mapFeatureToInstruction } from "../feature-mapping";
import { BLOG_HARNESS_SUMMARY_AGENT_ID } from "@/lib/bulk/blog-harness-summary-agent";

// --- System Prompt Core ---

export const SYSTEM_PROMPT_CORE = `You are a master AI/SEO content strategist and writer. You specialize in creating high-quality, search-optimized content that ranks and converts. Your mastery lies in the elegant and effective integration of semantic triples (SPO) into fluent, natural prose.
--- Global Output Constraints (Mandatory) ---
1. Avoid all em dashes (Unicode U+2014 or U+2013) in output.
2. Never utilize conditional phrasing (e.g., "if X then Y", "it is important to note").
3. Ensure sentence lengths are concise and highly varied for a natural rhythm and flow. Strictly avoid all run-on sentences.
4. CRITICAL: Every sentence in the final output MUST be derived from or constructed as a Subject-Predicate-Object (SPO) semantic triple. Integrate these dense, factual statements *elegantly and seamlessly* for maximum informational density and correct grammatical reading.
5. CRITICAL KEYWORD INTEGRATION: Keywords must be woven into content as a native speaker would naturally write them - never as forced exact-match phrases. Use semantic variations, split keywords across sentences, vary word order, and integrate them contextually. The goal is human readability first, SEO second. Keywords should feel like they belong in the sentence, not like they were inserted for optimization.
6. PROS/CONS FORMAT (NON-NEGOTIABLE): Any pros and cons, advantages vs disadvantages, or strengths vs weaknesses MUST be presented in a two-column table with "Pros" and "Cons" as the only column headers - NEVER as bullet lists or numbered lists.`;

// --- Canonical Table Format ---
export const TABLE_FORMAT = `ALL tables = HTML only. NEVER | col | or |---| or any pipe/hyphen markdown. Use <table><thead><tr><th>Col1</th><th>Col2</th></tr></thead><tbody><tr><td>A</td><td>B</td></tr></tbody></table>. FAQ table is THE SAME: <table><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody><tr><td>Q?</td><td>A.</td></tr></tbody></table>. No exceptions.`;

export const TABLE_FORMAT_MARKDOWN = `ALL tables = Markdown only. Format: | Col1 | Col2 |, newline, | --- | --- |, newline, | A | B |. NEVER use HTML (<table>, <tr>, <td>). Links as [text](url).`;

/** Stops models from inventing patient/customer quotes, star ratings, or attributed “local resident” reviews in body, meta, excerpt, FAQ, or idea JSON. */
export const NO_FAKE_TESTIMONIALS_RULE = `**NO FABRICATED TESTIMONIALS (NON-NEGOTIABLE)**: Never invent or write customer, patient, or client testimonials; no fake review quotes, star ratings, or attributed praise (e.g. “Name, Local Resident”). Applies to article body, SEO meta description, social meta, WordPress excerpt, FAQ text, and any generated idea JSON fields. If real testimonials are not supplied in the prompt or knowledge base, omit them entirely - do not substitute generic praise.`;

// --- Core Link Validation Rule (MUST BE ENFORCED) ---
export const CRITICAL_LINK_RULE = `**ABSOLUTELY CRITICAL - LINKS RESTRICTIONS (NO EXCEPTIONS)**:
- **SELF-LINK INVALID**: Never link a page to itself. When a current page URL is provided, any suggested link that matches it (same path, with or without trailing slash, or same canonical URL) is INVALID. Reject it. Do not use it. Self-links are forbidden.
- **Internal links**: MUST ONLY use EXACT URLs from the linkable URLs list (posts, pages, entity/service URLs) - copy character-for-character. No guessing paths.
- **ABSOLUTELY FORBIDDEN: example.com** - NEVER use example.com, example.org, or any placeholder domain. Use only the connected site URLs from the list.
- **External links**: The ONLY allowed external link is the entity's Wikipedia page (when an entity exists). NO other external sites. NO Wikipedia links for topics, products, or general subjects - Wikipedia ONLY for the entity/location name.
- **FORBIDDEN: forums, chat & thread UGC**: Never link to Reddit, Discord, Slack, Quora, Stack Overflow / Stack Exchange, forums, chat apps, or similar discussion/thread platforms. (When Semrush-approved URLs are provided separately, use only those exact URLs - server-side rules exclude forum/chat domains.)
- **NEVER create, invent, or hallucinate external links** - ONLY entity Wikipedia is allowed. No other external domains.
- **NEVER use links from Knowledge Base** - Knowledge Base is for content reference ONLY, NOT for linking
- **NEVER create, invent, fabricate, or make up any links, URLs, or web addresses**
- **NEVER use placeholder links, example URLs, or fictional links**
- If the linkable URLs list is empty or contains no suitable links, you MUST NOT create any links - simply skip linking for that section
- Any link that does not come from the linkable URLs list (for internal) or is not the entity's Wikipedia page (for external) MUST be removed or not used
- DO NOT assume links exist - if a link is not in the linkable URLs list (internal) or is not entity Wikipedia (external), it does not exist and must not be used
- **NEVER use "here" in or after a link** (e.g. no "guide here", "learn more here", "plan here"). Embed each link in meaningful sentence content on BOTH sides so readers and LLMs get clear context for what the link is about`;

// --- Prompt Generation Logic ---

const htmlHeadingTag = (level: number | undefined) => {
  const l = level && level >= 1 && level <= 6 ? level : 1;
  return `h${Math.min(l + 1, 6)}`; // level 1 → h2 (main section), level 2 → h3 (subsection), level 3 → h4
};

export const generateSingleSectionPrompt = (
  agent: AgentConfig,
  format: 'markdown' | 'html' = 'html',
  contentKind?: "press_release",
  topicAnchor?: string,
): string => {
  const useMarkdown = format === 'markdown';

  if (agent.id === BLOG_HARNESS_SUMMARY_AGENT_ID) {
    if (useMarkdown) {
      return `## Overview
REQUIRED OUTPUT SHAPE (do not skip any part):
## Overview
paragraph 1 (keyword in first sentence)
optional paragraph 2
- **Label**: description with [#citation](#anchor-id)
(one bullet per IN-PAGE SECTION ANCHOR; each bullet has exactly one # link to its assigned anchor)

Rules: HEAVILY SEO-ORIENTED. FIRST sentence MUST include the exact primary keyword and answer it. Every bullet: **Label**: then colon, then description (never a comma after the label). LINKS (MANDATORY): every link in Overview MUST be a same-page click-to-scroll citation using ONLY ids from IN-PAGE SECTION ANCHORS — form [short phrase](#anchor-id). Anchor text MUST be a subtle 2–4 word phrase woven into the sentence (e.g. "cost factors", "system pricing", "tax rebates") — NEVER the full H2 / section title, NEVER "as detailed in [Full Title]", NEVER paste the display title after the #id list. NON-NEGOTIABLE: one bullet per IN-PAGE anchor; each bullet contains exactly one # citation. When a MANDATORY ENTITY WIKIPEDIA block is present in the prompt, ALSO link the entity place name to that exact Wikipedia URL (one http(s) link only). FORBIDDEN in Overview: other http/https URLs, site page paths, Semrush externals, or any non-# href that is not that exact entity Wikipedia URL. No tables. No extra headings. Paragraphs alone without the bullet list = INVALID. Markdown only.]`;
    }
    return `<h2>Overview</h2>
REQUIRED OUTPUT SHAPE (do not skip any part):
<h2>Overview</h2>
<p>…keyword in first sentence…</p>
<p>…optional second paragraph…</p>
<ul>
<li><strong>Label</strong>: description with <a href="#anchor-id">short phrase</a> woven in</li>
(one <li> per IN-PAGE SECTION ANCHOR; each bullet has exactly one # link to its assigned anchor)
</ul>
(never omit <ul>; bullet count must match IN-PAGE SECTION ANCHORS count)

Rules: HEAVILY SEO-ORIENTED. FIRST sentence MUST include the exact primary keyword and answer it. Every <li> MUST start [BOLD]: <strong>Label</strong>: then colon, then description (the <strong> HTML tag is required; never a comma after </strong>). LINKS (MANDATORY): every <a> in Overview MUST be a same-page click-to-scroll citation — href MUST start with # and MUST be an id from IN-PAGE SECTION ANCHORS. Anchor text MUST be a subtle 2–4 word phrase woven into the sentence (e.g. <a href="#…">cost factors</a>, <a href="#…">system pricing</a>, <a href="#…">tax rebates</a>) — NEVER the full H2 / section title as link text, NEVER "as detailed in <a>Full Title</a>", NEVER copy the display title from the anchors list into the <a>…</a>. NON-NEGOTIABLE: one bullet per IN-PAGE anchor; each bullet contains exactly one # citation. When a MANDATORY ENTITY WIKIPEDIA block is present in the prompt, ALSO include one <a href="exact-wikipedia-url"> linking the entity place name. FORBIDDEN in Overview: other http/https URLs, site page paths, Semrush externals, or any href that is not #anchor-id or that exact entity Wikipedia URL. No tables. No extra headings. Two paragraphs with no <ul> = INVALID. HTML only.]`;
  }

  const hasFAQFeature =
    agent.features?.some((f) => {
      return (
        typeof f === 'string' &&
        (f.toLowerCase().trim().includes('[faq]') || f.toLowerCase().trim().includes('faq'))
      );
    }) ?? false;

  if (hasFAQFeature) {
    if (useMarkdown) {
      return `Do NOT write an FAQ section in this body. FAQ is appended later as H2 "FAQ" + intro + Question/Answer table. Omit FAQ headings, tables, and Q/A pairs. Output nothing for this section.`;
    }
    return `Do NOT write an FAQ section in this body. FAQ is appended later as flo-faq with H2 id="faq" "FAQ" + intro + HTML Question/Answer table. Omit FAQ headings, tables, and Q/A pairs. Output nothing for this section.`;
  }

  const isFirstAgent = agent.step === 1;
  // After the mandatory AI Overview summary (step 1), the SEO opener H2 is the first body section (step 2).
  const isSeoOpenerSection = contentKind !== "press_release" && agent.step === 2;

  const featureInstructions = agent.features.map((f) => mapFeatureToInstruction(f, format)).join(", ");
  const hasListFeature = agent.features.some((f) => f.toLowerCase().trim().startsWith('[list]'));
  const isNumberedList =
    hasListFeature &&
    agent.features.some((f) => {
      const lower = f.toLowerCase();
      return (
        lower.includes('numbered') ||
        lower.includes('ordered') ||
        lower.includes('step') ||
        lower.includes('sequence') ||
        lower.includes('process')
      );
    });

  let sublistPreventionNote: string;
  let listFormatNote: string;
  let firstAgentSpecialInstructions: string;
  let contentInstruction: string;
  const hTag = htmlHeadingTag(agent.headingLevel);

  if (useMarkdown) {
    sublistPreventionNote = !hasListFeature
      ? "\nBreakdowns/steps/series MUST use - bullets or 1. 2. 3. numbered - NEVER separate paragraphs."
      : "";
    listFormatNote = hasListFeature
      ? isNumberedList
        ? "\n**LIST FORMAT**: Numbered list (1. 2. 3.) for steps/process/sequence. NEVER bullets for ordered content."
        : "\n**LIST FORMAT**: Use - bullets for unordered, or 1. 2. 3. for steps. Markdown only."
      : "";
    const prLaterSectionNote =
      contentKind === "press_release" && !isFirstAgent
        ? "\n**NOT THE OPENING BLOCK**: Do NOT repeat the wire dateline or start any paragraph with a calendar date. Do NOT use today announced, grand opening, newly launched, expansion announced, or similar invented news. Write about TARGET SITE and the release topic keyword in steady editorial voice."
        : "";
    firstAgentSpecialInstructions =
      isFirstAgent && contentKind === "press_release"
        ? "\n**PRESS RELEASE OPENING (SECTION 1 ONLY)**: First output line is ## plus a topical headline for the keyword (service/expertise angle, not a fake launch). Next paragraph: start with the exact Wire dateline from ACF when provided (once only in the full release); otherwise city, region, and full date in AP style. Never [CITY], [STATE], [Month DD, YYYY], or bracket templates. Then a lead about the business and topic. Neutral AP tone. Do not frame as a new announcement unless user context says so."
        : isSeoOpenerSection
          ? "\n**CRITICAL FIRST BODY SECTION**: Write exactly 3 short paragraphs (2-3 sentences each). **FOCUS KEYWORD AT START**: First paragraph MUST directly address the primary keyword in its FIRST sentence - not allude to it, not dance around it. If the primary keyword is a question (e.g. 'can a night guard straighten teeth'), the very first sentence must explicitly state the question and provide a direct answer. NEVER open with vague background context that only hints at the topic. Lead with the keyword, answer it, THEN expand. **MINIMAL LINKING**: Only link entity to Wikipedia (if entity) and main service to its page. **CRITICAL**: H2 MUST be SEO-friendly (e.g. 'Understanding Child Safe Window Treatments') - NEVER 'Introduction' or 'Intro'. Markdown only."
          : "";
    const prTopicBlock =
      contentKind === "press_release" && topicAnchor?.trim()
        ? `\n**RELEASE TOPIC (light touch)**: ${topicAnchor.trim()} — shape the story around this; do not repeat the exact phrase in every section.`
        : "";
    const prHeadingRule =
      contentKind === "press_release"
        ? "\n**## LINE**: Invent a topical subhead tied to the keyword and business (service, expertise, or reader need). Not a template label; not a fake launch headline unless user context requires it."
        : "";
    contentInstruction = `[Write content in Markdown. Based on: ${agent.description}${agent.features.length > 0 ? `\nKey points: ${featureInstructions}` : ''}${prTopicBlock}${firstAgentSpecialInstructions}${prLaterSectionNote}${prHeadingRule}${sublistPreventionNote}${listFormatNote} Use ##, ###, paragraphs, - or 1. lists, [text](url), | table |. NEVER HTML.]`;
  } else {
    sublistPreventionNote = !hasListFeature
      ? "\nBreakdowns/steps/series MUST use <ul><li> or <ol><li> - NEVER separate <p> paragraphs."
      : "";
    listFormatNote = hasListFeature
      ? isNumberedList
        ? "\n**LIST FORMAT**: This section requires a NUMBERED list (steps, process, sequence). Use <ol><li>...</li></ol> ONLY. NEVER use <ul> or bullet format for steps - ordered content must be <ol>."
        : "\n**LIST FORMAT**: HTML only. Use <ul><li><strong>Label</strong>. Text.</li></ul> for unordered items, or <ol><li>...</li></ol> for steps. NEVER markdown (- or 1.)."
      : "";
    firstAgentSpecialInstructions = isSeoOpenerSection
      ? "\n**CRITICAL FIRST BODY SECTION**: Write exactly 2 short <p> paragraphs (2-3 sentences each). **FOCUS KEYWORD AT START**: First paragraph MUST directly address the primary keyword in its FIRST sentence - not allude to it, not dance around it. If the primary keyword is a question (e.g. 'can a night guard straighten teeth'), the very first sentence must explicitly state the question and provide a direct answer. NEVER open with vague background context that only hints at the topic. Lead with the keyword, answer it, THEN expand. **MINIMAL LINKING**: Only link entity to Wikipedia (if entity) and main service to its page. **CRITICAL**: <h2> MUST be SEO-friendly (e.g. 'Understanding Child Safe Window Treatments') - NEVER 'Introduction' or 'Intro'. HTML only."
      : "";
    const harnessScopeNote =
      contentKind !== "press_release"
        ? `\n**SECTION SCOPE**: Keep this section within the harness word budget (full article max ${ARTICLE_MAX_WORDS} words). No H3 unless h3Enabled; no extra topics beyond this section block.`
        : "";
    contentInstruction = `[Write content in HTML. Based on: ${agent.description}${agent.features.length > 0 ? `\nKey points: ${featureInstructions}` : ''}${firstAgentSpecialInstructions}${harnessScopeNote}${sublistPreventionNote}${listFormatNote} Use <${hTag}>, <p>, <ul><li>, <ol><li>, <a href=\"...\">text</a>, <table>. NEVER markdown.]`;
  }

  let sectionPrompt =
    useMarkdown && contentKind === "press_release"
      ? contentInstruction
      : useMarkdown
        ? `## ${agent.title}\n${contentInstruction}`
        : `<${hTag}>${agent.title}</${hTag}>\n${contentInstruction}`;

  if (agent.h3Enabled && agent.h3Count > 0) {
    const cappedH3 = Math.min(agent.h3Count, 5);
    const hasListFeatureForH3 = agent.features.some((f) => f.toLowerCase().trim().startsWith('[list]'));
    const sublistPreventionNoteForH3 = !hasListFeatureForH3
      ? useMarkdown
        ? "\nBreakdowns/steps MUST use - or 1. 2. 3., never separate paragraphs."
        : "\nBreakdowns/steps MUST use <ul><li> or <ol><li>, never separate <p> paragraphs."
      : "";
    const listFormatNoteForH3 =
      hasListFeatureForH3 && isNumberedList
        ? useMarkdown
          ? "\n**LIST**: Numbered steps = 1. 2. 3. ONLY."
          : "\n**LIST**: Numbered steps = <ol><li> ONLY. Never bullets for sequential content."
        : "";
    const introInstruction = useMarkdown
      ? `[Write a brief introduction. Based on: ${agent.description}${agent.features.length > 0 ? `\nKey points: ${featureInstructions}` : ''}${sublistPreventionNoteForH3}${listFormatNoteForH3}]\n(Following ${cappedH3} H3s only - MAX 5 per section. Markdown only.)`
      : `[Write a brief <p> introduction. Based on: ${agent.description}${agent.features.length > 0 ? `\nKey points: ${featureInstructions}` : ''}${sublistPreventionNoteForH3}${listFormatNoteForH3}]\n(Following ${cappedH3} H3s only - MAX 5 per section. HTML only.)`;
    sectionPrompt = useMarkdown
      ? `## ${agent.title}\n${introInstruction}`
      : `<${hTag}>${agent.title}</${hTag}>\n${introInstruction}`;

    const hasListFeatureForH3Subsections = agent.features.some((f) =>
      f.toLowerCase().trim().startsWith('[list]'),
    );
    const sublistPreventionNoteForH3Subsections = !hasListFeatureForH3Subsections
      ? useMarkdown
        ? "\nBreakdowns/steps MUST use - or 1. 2. 3.."
        : "\nBreakdowns/steps MUST use <ul><li> or <ol><li>."
      : "";
    const listFormatNoteForH3Subsections =
      hasListFeatureForH3Subsections && isNumberedList
        ? useMarkdown
          ? " Steps/sequences = 1. 2. 3. ONLY."
          : " Steps/sequences = <ol><li> ONLY, never <ul>."
        : "";
    for (let i = 1; i <= cappedH3; i++) {
      sectionPrompt += useMarkdown
        ? `\n\n### [Compose SEO-optimized H3 title for this subsection]\n[Write detailed content in Markdown${sublistPreventionNoteForH3Subsections}${listFormatNoteForH3Subsections}]`
        : `\n\n<h3>[Compose SEO-optimized H3 title for this subsection]</h3>\n[Write detailed content in HTML${sublistPreventionNoteForH3Subsections}${listFormatNoteForH3Subsections}]`;
    }
  }

  return sectionPrompt;
};

export const generateSectionsPrompt = (agents: AgentConfig[], format: 'markdown' | 'html' = 'html'): string => {
  return agents.map((agent) => generateSingleSectionPrompt(agent, format)).join("\n\n");
};
