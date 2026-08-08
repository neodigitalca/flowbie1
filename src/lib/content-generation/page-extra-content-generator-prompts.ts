/**
 * Prompt strings for staged SEO extra text (H2 section, then H3+body).
 */

import { resolveWritingKeyword } from "@/lib/prompt-builders/keyword-canonical-punctuation";

export const EXTRA_TEXT_HARNESS_TOTAL_SECTIONS = 2;

export const EXTRA_TEXT_LINK_RULES = `LINK RULES (critical):
- NO external links. Never use third-party domains (Wikipedia, .gov, manufacturers, competitors, dictionaries, legal sites, etc.).
- Internal links ONLY: every <a href> must copy an exact URL from the AVAILABLE INTERNAL LINKS block in the user message.
- Never invent, guess, or construct URLs. If a URL is not listed there, do not link it.
- If AVAILABLE INTERNAL LINKS says none, do not include any <a> tags.`;

function extraTextLinkSectionRules(hasLinkInventory: boolean): string {
  if (!hasLinkInventory) {
    return `THIS SECTION ONLY (links):
- Do NOT include any <a> tags (no internal link inventory was loaded)`;
  }
  return `THIS SECTION ONLY (links):
- Include 2-5 internal links as <a href="exact URL">contextual anchor</a>
- Copy href values character-for-character from AVAILABLE INTERNAL LINKS only
- ${EXTRA_TEXT_LINK_RULES}`;
}

/** Headings must include the page focus keyword as an exact phrase (case-insensitive). */
export function extraTextKeywordInHeadingsRule(primaryKeyword: string): string {
  const stored = primaryKeyword.trim();
  const writing = resolveWritingKeyword(stored);
  const storedNote =
    writing.toLowerCase() !== stored.toLowerCase()
      ? `\n- Stored ACF keyword (do not rewrite the field): "${stored}"`
      : "";
  return `HEADING RULE (critical):
- The <h2> and <h3> must each include this **writing keyword** phrase: "${writing}"${storedNote}
- Use canonical punctuation when standard (X-ray, e-commerce). Same words and word order as the writing keyword.
- You may add words before or after the phrase (e.g. "${writing}: planning your visit").
- Do not write generic headings that omit "${writing}".`;
}

function topicLockBlock(subjectLine: string, primaryKeyword: string): string {
  return `${extraTextKeywordInHeadingsRule(primaryKeyword)}

TOPIC LOCK:
- Extra text must extend the SAME topic as the existing page "${subjectLine}" and the RAG page body below
- Use inventory / page content as ground truth; do not pivot to a different product or generic industry article
- No em dashes; no "Introduction" / "Conclusion" headings`;
}

export function buildExtraTextH2SystemPrompt(args: {
  subjectLine: string;
  primaryKeyword: string;
}): string {
  const { subjectLine, primaryKeyword } = args;
  return `OUTPUT: HTML ONLY for section 1 of 2 (the extra text H2 block). No markdown. No code fences.

THIS SECTION ONLY:
- Start with exactly one <h2>...</h2> (first character must be "<" from <h2>)
- Then 1-2 short <p>...</p> paragraphs on the same topic
- Do NOT include <h3>, lists, tables, or links in this reply

${topicLockBlock(subjectLine, primaryKeyword)}`;
}

export function buildExtraTextH3SystemPrompt(args: {
  subjectLine: string;
  primaryKeyword: string;
  hasLinkInventory: boolean;
}): string {
  const { subjectLine, primaryKeyword, hasLinkInventory } = args;
  return `OUTPUT: HTML ONLY for section 2 of 2 (the extra text H3 block). No markdown. No code fences.

THIS SECTION ONLY:
- Start with exactly one <h3>...</h3> (first character must be "<" from <h3>)
- Then <p>, optional <ul> or <table>, more <p> as needed
- Do NOT include <h2> or a second <h3>

${extraTextLinkSectionRules(hasLinkInventory)}

${topicLockBlock(subjectLine, primaryKeyword)}`;
}

export function buildExtraTextFullSystemPrompt(args: {
  subjectLine: string;
  primaryKeyword: string;
  hasLinkInventory: boolean;
}): string {
  const { subjectLine, primaryKeyword, hasLinkInventory } = args;
  return `OUTPUT FORMAT: HTML ONLY. No markdown. No code fences.

HEADING CONTRACT:
- First character must be "<" from <h2>
- Exactly one <h2>...</h2> and exactly one <h3>...</h3>
- Order: <h2> → 1-2 <p> → <h3> → body, optional <ul>/<table>

${extraTextLinkSectionRules(hasLinkInventory)}

${topicLockBlock(subjectLine, primaryKeyword)}`;
}

export type ExtraTextPromptContext = {
  subjectLine: string;
  pageUrl: string;
  urlHintLine: string;
  primaryKeyword: string;
  secondaryLine: string;
  textContent: string;
  wordPressPostsContext: string;
  ragContext: string;
  ragGuard: string;
};

function sharedContextBlock(ctx: ExtraTextPromptContext): string {
  const writing = resolveWritingKeyword(ctx.primaryKeyword.trim());
  return `Page: "${ctx.subjectLine}"
URL: ${ctx.pageUrl}
${ctx.urlHintLine}${ctx.secondaryLine}
Writing keyword (required inside <h2> and <h3>): "${writing}"
Stored focus keyword (ACF reference only): "${ctx.primaryKeyword.trim()}"

Existing page excerpt:
${ctx.textContent}
${ctx.ragContext ? `\n=== PAGE SOURCE (inventory / CSV) ===\n${ctx.ragContext}\n=== END PAGE SOURCE ===\n` : ""}
${ctx.wordPressPostsContext}
${ctx.ragGuard}`;
}

export function buildExtraTextH2UserPrompt(ctx: ExtraTextPromptContext): string {
  const writing = resolveWritingKeyword(ctx.primaryKeyword.trim());
  return `Write section 1 now: one <h2> that includes "${writing}" exactly, then 1-2 intro <p> tags on the same page topic.

${sharedContextBlock(ctx)}

Reply must start with <h2>. HTML only. No <h3> in this reply.`;
}

export function buildExtraTextH3UserPrompt(
  ctx: ExtraTextPromptContext,
  h2SectionHtml: string,
  hasLinkInventory: boolean,
): string {
  const linkLine = hasLinkInventory
    ? "then body copy with 2-5 internal links from AVAILABLE INTERNAL LINKS only (no external URLs)"
    : "then body copy with paragraphs and optional list or table (no <a> tags)";
  const writing = resolveWritingKeyword(ctx.primaryKeyword.trim());
  return `Write section 2 now: one <h3> that includes "${writing}" exactly, ${linkLine}.

${EXTRA_TEXT_LINK_RULES}

Section 1 already written (continue the same topic):
${h2SectionHtml}

${sharedContextBlock(ctx)}

Reply must start with <h3>. HTML only. No <h2> in this reply.`;
}

export function buildExtraTextFullUserPrompt(
  ctx: ExtraTextPromptContext,
  hasLinkInventory: boolean,
): string {
  return `Write the full SEO extra text HTML block now.

${EXTRA_TEXT_LINK_RULES}

${sharedContextBlock(ctx)}

Must start with <h2> and include exactly one <h3>. HTML only.${
    hasLinkInventory
      ? " Use internal links only from AVAILABLE INTERNAL LINKS."
      : " Do not include any <a> tags."
  }`;
}
