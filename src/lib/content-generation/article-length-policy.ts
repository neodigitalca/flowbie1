/** Prompt-only article length policy for blog, SAP, and bulk CSV generation. */

export const ARTICLE_MAX_WORDS = 3200 as const;

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
**[ARTICLE LENGTH]**: Entire published article MUST NOT exceed **${ARTICLE_MAX_WORDS} words**. Exceeding this cap is a hard failure.
- Output **exactly ${isServiceArea ? "6-7" : "5-6"}** numbered checklist items for this ${modeLabel} (**hard cap ${maxItems}** including intro and conclusion). **Never output item ${maxItems + 1} or higher.**
- **LLM audit / local research facts**: weave into existing checklist items only. **Forbidden**: extra numbered lines or new H2 titles for audit facts (e.g. "Seasonal Light", "Winter Comfort", "Greenhouse Care" as standalone sections).
- **HEADROOM**: ${ARTICLE_MAX_WORDS} is a hard cap, not a target. Use budget for sourced depth (numbers, comparisons, regional facts), not repeated generic benefits or extra H2s.
- **DEPTH IN FEWER H2s**: One H2 per checklist item only. **MAX 2 H3s** per H2. Unmarked H2s: **1-2 paragraphs**. Marked H2s ([LIST], [TABLE], [DECISION], [TRADEOFF], [NUMBERS], [ILLUSTRATIVE], [RECOMMENDATION]): **2-3 paragraphs plus the required table or list** (~${Math.floor(ARTICLE_MAX_WORDS / maxItems)} words per section average).
- **TABLE BUDGET**: Entire article gets **at most 2** [TABLE] sections.${isServiceArea ? " SAP slots: (1) What We Offer catalog (2) Local Recommendation (Product | Best for | Budget | Reason). Do not add a third [TABLE]." : " Spend one on decision criteria (best for / skip when / cost driver). Do not assign [TABLE] to every H2."}
- **NO DUPLICATE TOPICS**: Merge overlapping topics into one H2. Meet SEO requirements with **concise copy**, not extra sections.
${isServiceArea ? "- SAP mandatory blocks (problem, local conditions, What We Offer, Local Recommendation, Next Steps) **count toward** the same ${ARTICLE_MAX_WORDS}-word budget and the **${maxItems}-item** checklist cap." : ""}
--- END ARTICLE LENGTH ---`;
}

export function buildFocusedArticlePurpose(keyword: string): string {
  const topic = keyword.trim() || "this topic";
  return `Focused guide (max ${ARTICLE_MAX_WORDS} words) about ${topic}`;
}

export function buildBlueprintArticleLengthBlock(): string {
  return `--- ARTICLE LENGTH (BLUEPRINT) ---
- Total article cap: **${ARTICLE_MAX_WORDS} words**. Blueprint structure must fit this budget. **Never add agents beyond the checklist item count.**
- Create **one agent per checklist item only** (${MAX_CHECKLIST_ITEMS_SAP} max for SAP). **Forbidden**: new agents or H2s for LLM audit facts, seasonal micro-topics, or local detail bullets.
- Prefer **fewer agents with combined subtopics** over splitting into extra sections.
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

  return `**ARTICLE WORD BUDGET**: Full article cap is **${ARTICLE_MAX_WORDS} words** (${total} section(s)). Target **~${target} words** for this section (hard max **${target + 40}**). If you exceed your section budget, the full article exceeds ${ARTICLE_MAX_WORDS} words. Write shorter; do not compensate with length in other sections.`;
}

export function buildHarnessArticleCapLine(totalSections: number): string {
  const total = Math.max(1, Math.floor(totalSections));
  const perSection = perSectionWordBudget(total);
  return `**FULL ARTICLE CAP**: ${ARTICLE_MAX_WORDS} words across ${total} section(s) (~${perSection} words per section on average). Write concisely.`;
}
