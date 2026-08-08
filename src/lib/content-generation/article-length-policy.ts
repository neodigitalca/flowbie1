/** Prompt-only article length policy for blog, SAP, and bulk CSV generation. */

export const ARTICLE_MAX_WORDS = 2000 as const;

export const MAX_CHECKLIST_ITEMS_BLOG = 6 as const;

export const MAX_CHECKLIST_ITEMS_SAP = 7 as const;

export function perSectionWordBudget(totalSections: number, articleMax = ARTICLE_MAX_WORDS): number {
  const n = Math.max(1, Math.floor(totalSections));
  return Math.floor(articleMax / n);
}

export function buildArticleLengthChecklistBlock(isServiceArea: boolean): string {
  const maxItems = isServiceArea ? MAX_CHECKLIST_ITEMS_SAP : MAX_CHECKLIST_ITEMS_BLOG;
  const modeLabel = isServiceArea ? "service area (SAP)" : "blog";

  return `--- ARTICLE LENGTH (NON-NEGOTIABLE) ---
**[ARTICLE LENGTH]**: Entire published article MUST NOT exceed ${ARTICLE_MAX_WORDS} words.
- Create **${isServiceArea ? "6-7" : "5-6"}** checklist items maximum for this ${modeLabel} (hard cap **${maxItems}** items including intro and conclusion).
- **DEPTH IN FEWER H2s**: Cover topics in fewer, tighter sections. One H2 per major topic. **MAX 2 H3s** per H2 (never 3-5). **1-2 paragraphs** per H2; do not stack 2-3 paragraphs under every H3.
- **TABLE BUDGET**: Entire article gets **at most 2** [TABLE] sections. Do not assign [TABLE] to every H2.
- **NO DUPLICATE TOPICS**: Never create two H2s for the same topic (e.g. "Dental Services Offered" and "Complete Dental Services"). Merge overlapping topics into one H2.
- Meet Rank Math, exact-primary-per-H2, and link requirements with **concise copy**, not extra sections or long walls of text.
${isServiceArea ? "- SAP mandatory blocks (What We Offer, We Care About, Next Steps) **count toward** the same ${ARTICLE_MAX_WORDS}-word budget. Merge overlapping topic H2s; keep the service table compact (top offerings only, short descriptions)." : ""}
--- END ARTICLE LENGTH ---`;
}

export function buildFocusedArticlePurpose(keyword: string): string {
  const topic = keyword.trim() || "this topic";
  return `Focused guide (max ${ARTICLE_MAX_WORDS} words) about ${topic}`;
}

export function buildBlueprintArticleLengthBlock(): string {
  return `--- ARTICLE LENGTH (BLUEPRINT) ---
- Total article cap: **${ARTICLE_MAX_WORDS} words**. Blueprint structure must fit this budget.
- Create **one agent per checklist item**; never exceed the checklist item count. Prefer **fewer agents with combined subtopics** over splitting into extra sections.
- Purpose field: frame as a **focused guide (max ${ARTICLE_MAX_WORDS} words)** only. Never use "comprehensive", "exhaustive", or "complete guide" wording.
- Each agent.title becomes the exact <h2> text. One agent = one H2 = one harness call. Never duplicate agent titles.
- Per-agent prose: keep descriptions and features oriented to **short sections** (instructional maxTokens ~800-1000 per agent).
- Do not inflate depth with extra H3 agents; main topics stay H2 (headingLevel: 1).
--- END ARTICLE LENGTH ---`;
}

export function buildHarnessArticleBudgetBlock(sectionIndex: number, totalSections: number): string {
  const total = Math.max(1, Math.floor(totalSections));
  const base = perSectionWordBudget(total);
  const isFirst = sectionIndex === 0;
  const isLast = sectionIndex === total - 1;
  const target =
    isFirst || isLast ? Math.max(180, Math.floor(base * 0.85)) : base;

  return `**ARTICLE WORD BUDGET**: Full article cap is **${ARTICLE_MAX_WORDS} words** (${total} section(s)). Target **~${target} words** for this section. Stay within budget; do not compensate with length in other sections.`;
}

export function buildHarnessArticleCapLine(totalSections: number): string {
  const total = Math.max(1, Math.floor(totalSections));
  const perSection = perSectionWordBudget(total);
  return `**FULL ARTICLE CAP**: ${ARTICLE_MAX_WORDS} words across ${total} section(s) (~${perSection} words per section on average). Write concisely.`;
}
