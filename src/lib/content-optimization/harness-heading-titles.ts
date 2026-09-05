/** Shared H2 title guards for checklist, AI Headers, and post-creator. */

const GENERIC_H2_EXACT = new Set([
  "section",
  "intro",
  "introduction",
  "content",
  "overview",
  "getting started",
  "summary",
]);

/** True when title is a placeholder, not a publishable H2. */
export function isGenericHarnessHeadingTitle(title: string | null | undefined): boolean {
  const trimmed = title?.trim();
  if (!trimmed) return true;
  const key = trimmed.toLowerCase();
  if (GENERIC_H2_EXACT.has(key)) return true;
  if (/^section\s+\d+$/i.test(trimmed)) return true;
  if (/^create an (agent|h2)/i.test(trimmed)) return true;
  return false;
}

export const FORBIDDEN_H2_PLACEHOLDER_PROMPT_LINE =
  "**FORBIDDEN H2 PLACEHOLDERS (NON-NEGOTIABLE)**: Never use Section, Intro, Introduction, Content, Overview (body sections), Getting Started, or Section N as published H2 text. Every checklist line, blueprint agent title, and harness ## must be a specific, reader-facing topic title copied from the assigned heading contract.";

/** Shared OpenRouter system prompt for Overview AI Headers plan. */
export function buildBlogHeadersPlanSystemPrompt(): string {
  return `You are an expert content SEO strategist. Rewrite blog H2 headings for search intent and clicks.

${FORBIDDEN_H2_PLACEHOLDER_PROMPT_LINE}

Rules:
- For every index in existingH2s, output exactly one { action: "optimize", index, proposedText, rationale }. Missing indices leave bad placeholder H2s in the page.
- When existingH2s[index] is a forbidden placeholder (Section, Intro, Section N, etc.), proposedText MUST be a specific reader-facing topic title from section content, focusKeyword, and gscHeadingKeywords — never another placeholder.
- For real topic headings, proposedText MUST be an SEO rewrite: clearer intent, entities, and keywords. It MUST NOT equal existingH2s[index] (no copy-paste). Prefer how to choose / vs / cost factors / process / when not worth it over definitional "What is X" titles.
- When missingLeadingH2 is true, also set leadingH2: exactly ONE new intro H2 before the first paragraph (must differ from every existingH2s entry). Do not duplicate the post title if it already appears as an H2 in the body.
- When missingLeadingH2 is false, omit leadingH2 entirely.
- Replace existing H2 inner text only. Never insert additional H2 tags beyond the single leadingH2 when flagged.
- Use gscHeadingKeywords, focusKeyword, and seoResearchBrief when planning each rewrite.
- Do not use "add". Do not plan indices outside existingH2s.
- Do not change body copy. Headings only.
- proposedText: Title Case, scannable, 3-14 words.
- rationale: one short sentence.
- Return ONLY valid JSON matching outputSchema (no markdown fences).`;
}

/** User-payload fields for AI Headers plan (forbidden placeholders + indices to rewrite). */
export function buildBlogHeadersPlanUserExtras(existingH2s: string[]): Record<string, unknown> {
  const genericH2Indices = existingH2s
    .map((title, index) => (isGenericHarnessHeadingTitle(title) ? index : -1))
    .filter((index) => index >= 0);
  return {
    forbiddenH2Placeholders: FORBIDDEN_H2_PLACEHOLDER_PROMPT_LINE,
    genericH2Indices,
    genericH2RewriteMandate:
      genericH2Indices.length > 0
        ? `Indices ${genericH2Indices.join(", ")} have placeholder H2 text. proposedText for each MUST be a specific topic title — never Section, Intro, or Section N.`
        : undefined,
  };
}
