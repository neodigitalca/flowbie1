import { TABLE_NO_LINK_ONLY_COLUMN_RULE } from "@/lib/prompt-builders/table-prompt-rules";
import { UNIFIED_COPY_FORMATTING_RULE } from "@/lib/prompt-builders/title-rules";
import { ILLUSTRATIVE_DEFAULT_H2 } from "@/lib/content-optimization/illustrative-h2";
import {
  SAP_LOCAL_CONDITIONS_H2,
  SAP_NEXT_STEPS_H2,
  SAP_OPTIONS_FIT_H2,
  SAP_PROBLEM_H2,
  SAP_WHAT_WE_OFFER_H2,
  SAP_DEFAULT_COMBINED_OUTLINE,
  sapLocalRecommendationHeading,
  sapSelectedH2OutlineTitles,
} from "@/lib/prompt-builders/sap-h2-constants";

export {
  SAP_PROBLEM_H2,
  SAP_LOCAL_CONDITIONS_H2,
  SAP_OPTIONS_FIT_H2,
  SAP_WHAT_WE_OFFER_H2,
  SAP_NEXT_STEPS_H2,
  SAP_DEFAULT_COMBINED_OUTLINE,
  sapLocalRecommendationHeading,
  sapSelectedH2OutlineTitles,
} from "@/lib/prompt-builders/sap-h2-constants";

export { pinSapChecklistMandatoryHeadings, pinBlueprintAgentTitle } from "@/lib/prompt-builders/sap-checklist-pin";

const SAP_PAGE_TEMPLATE_START = "--- SAP PAGE TEMPLATE (NON-NEGOTIABLE) ---";
const SAP_PAGE_TEMPLATE_END = "--- END SAP PAGE TEMPLATE ---";

/** Four-column chooser. Vertical-agnostic: rows come from this site's offerings and this place's jobs. */
export const SAP_LOCAL_RECOMMENDATION_TABLE_RULE = `**LOCAL RECOMMENDATION TABLE (SAP — NON-NEGOTIABLE)**:
This section is the [RECOMMENDATION] slot. It is a chooser, not an encyclopedia.
1. H2 title: Our Recommendation for Homeowners in [entity prose label].
2. First sentence: "Our recommendation for homeowners in [LOCATION]:" then the HTML table. After the table, one closing sentence naming the connected business.
3. [TABLE] with exactly four columns: Product | Best for | Budget | Reason. Never a fifth link-only column. ${TABLE_NO_LINK_ONLY_COLUMN_RULE}
4. **Product:** Named offering from this connected site (Pages inventory title, first-party named line, or keyword-implied option this site sells). Link the name to the matching Pages URL when inventory has it: <a href="EXACT_URL" title="EXACT_PAGE_TITLE">anchor</a>. Forbidden: inventing an offering the site does not provide. Forbidden: hardcoded product lists from another trade.
5. **Best for:** One reader job-to-be-done for THIS trade in THIS place, derived from keyword + sourced local conditions + offerings. Not a restatement of the product name. Not a copied job list from another industry.
6. **Budget:** Sourced range with explicit CAD or USD and a unit (per window, per kW, per room, per job) when FIRST-PARTY / VERIFIED FACTS / audit provide figures. Qualify as illustrative. If no price source: "Quote; varies with {named drivers}" (size, access, tier, site work). Forbidden: invented dollar ranges.
7. **Reason:** One sourced local condition or trade constraint that explains why this offering fits that job here. Forbidden: generic benefits that would work on any city page.
8. Rows: 4-6. Each row a different Best-for job. Product may repeat only when Reason differs.
9. Article table cap: this table plus What We Offer are the only two [TABLE] slots. [DECISION] must not add a third [TABLE].`;

export const SAP_FORBIDDEN_UNSUBSTANTIATED_LOCAL_EXPERTISE = `**FORBIDDEN UNSUBSTANTIATED LOCAL EXPERTISE (SAP)**: Claims such as "we understand [place] architecture / needs / market" are invalid unless the same paragraph names a sourced local condition (housing era or style, street or exposure pattern, season, building constraint) from LLM audit, Wikipedia entity block, FIRST-PARTY CLAIMS, GBP, or existing HTML. If sources lack that condition, omit the expertise claim. Do not invent styles, projects, or businesses.`;

export function formatSapPageChecklistBlock(entity: string): string {
  const place = entity.trim() || "[Location]";
  const recH2 = sapLocalRecommendationHeading(place);
  return [
    SAP_PAGE_TEMPLATE_START,
    "This is a service-area (SAP) landing page. Do NOT emit ARTICLE CONTENT TYPE jobs (how this topic works, vs adjacent, cost guide). Spine = location + specific customer problem + sourced local information + evidence + Local Recommendation table.",
    "Output exactly 7 numbered checklist items. Each line opens with the **mandatory exact H2 title** below (then [STRUCTURE] and markers).",
    `Place entity: ${place}`,
    UNIFIED_COPY_FORMATTING_RULE,
    "",
    "Required checklist items (exact H2 title on every line):",
    `1. ${SAP_PROBLEM_H2} (MANDATORY exact H2 title) [STRUCTURE]: 2-3 paragraphs. Opener leads with a sourced local constraint. [LINK]: at least 1 [[LINK:PAGES title words|anchor]] mid-sentence. **[EXACT PRIMARY PER H2]**: WRITING KEYWORD once in body only, not in the H2.`,
    `2. ${SAP_LOCAL_CONDITIONS_H2} (MANDATORY exact H2 title) [STRUCTURE]: 1-2 paragraphs. [LIST]: sourced housing, street, season, or building facts. ${SAP_FORBIDDEN_UNSUBSTANTIATED_LOCAL_EXPERTISE} **[EXACT PRIMARY PER H2]**. [LINK]: at least 1 [[LINK:PAGES title words|anchor]] mid-sentence.`,
    `3. ${SAP_OPTIONS_FIT_H2} (MANDATORY exact H2 title) [STRUCTURE]: 2-3 paragraphs. [DECISION]: Situation | Importance list (not a third [TABLE]). **[EXACT PRIMARY PER H2]**. [LINK]: at least 1 [[LINK:PAGES title words|anchor]] mid-sentence.`,
    `4. ${ILLUSTRATIVE_DEFAULT_H2} (MANDATORY exact H2 title) [STRUCTURE]: 1 summary paragraph, then scenario in <blockquote>. [ILLUSTRATIVE] + [BLOCKQUOTE]. No links in H2 or H3. Exactly one [ILLUSTRATIVE] on item 4 only.`,
    `5. ${SAP_WHAT_WE_OFFER_H2} (MANDATORY exact H2 title) [STRUCTURE]: 1-2 short paragraphs. [TABLE]: Service/Product Name (Pages link) | Description. **[EXACT PRIMARY PER H2]**. [LINK]: in table names.`,
    `6. ${recH2} (MANDATORY exact H2 title) [RECOMMENDATION] + [TABLE]: follow LOCAL RECOMMENDATION TABLE. **[EXACT PRIMARY PER H2]**.`,
    `7. ${SAP_NEXT_STEPS_H2} (MANDATORY exact H2 title) [STRUCTURE]: 1-2 paragraphs. [LIST]: numbered booking steps. [AGENT PERSONA]: friendly customer-service tone. [LINK]: at least 1 [[LINK:PAGES title words|anchor]] mid-sentence.`,
    "",
    SAP_LOCAL_RECOMMENDATION_TABLE_RULE,
    "Article [TABLE] cap: What We Offer + Local Recommendation only.",
    "Forbidden H2 titles: colon subtitles, keyword slug in H2 text, \"We Care About [place]\", \"What is [topic]\", Introduction.",
    SAP_PAGE_TEMPLATE_END,
  ].join("\n");
}

export function formatSapPageWriterBlock(entity?: string): string {
  const place = entity?.trim() || "";
  return [
    SAP_PAGE_TEMPLATE_START,
    "Writer: this is a SAP landing page. Answer the local customer problem. Use sourced housing, street, season, or building facts. End recommendation sections with the Local Recommendation table, not extra encyclopedia paragraphs.",
    place ? `Place entity: ${place}` : "",
    UNIFIED_COPY_FORMATTING_RULE,
    SAP_LOCAL_RECOMMENDATION_TABLE_RULE,
    SAP_FORBIDDEN_UNSUBSTANTIATED_LOCAL_EXPERTISE,
    "When this section is [RECOMMENDATION]: 1-2 short paragraphs plus the four-column table. ILLUSTRATIVE still has no table.",
    `Exactly one [ILLUSTRATIVE] section on the whole page (checklist item 4 only). Forbidden: a second H2 titled "${ILLUSTRATIVE_DEFAULT_H2}", a second blockquote scenario, or Recommendation h3 outside item 4.`,
    SAP_PAGE_TEMPLATE_END,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatSapChecklistExample(entity: string, _title: string): string {
  const place = entity.trim() || "[Location]";
  const recH2 = sapLocalRecommendationHeading(place);
  return `1. ${SAP_PROBLEM_H2} [STRUCTURE]: 2-3 paragraphs. Opener leads with a sourced local constraint. **[EXACT PRIMARY PER H2]**. [LINK]: at least 1 [[LINK:PAGES title words|anchor]] mid-sentence.
2. ${SAP_LOCAL_CONDITIONS_H2} [STRUCTURE]: 1-2 paragraphs. [LIST]: sourced housing, street, season, or building facts. **[EXACT PRIMARY PER H2]**. [LINK]: at least 1 [[LINK:PAGES title words|anchor]] mid-sentence.
3. ${SAP_OPTIONS_FIT_H2} [STRUCTURE]: 2-3 paragraphs. [DECISION]: Situation | Importance list. **[EXACT PRIMARY PER H2]**. [LINK]: at least 1 [[LINK:PAGES title words|anchor]] mid-sentence.
4. ${ILLUSTRATIVE_DEFAULT_H2} [STRUCTURE]: 1 intro paragraph, then scenario in body. [ILLUSTRATIVE]. [BLOCKQUOTE]. **[EXACT PRIMARY PER H2]**. [LINK]: in body only.
5. ${SAP_WHAT_WE_OFFER_H2} [STRUCTURE]: 1-2 short paragraphs. [TABLE]: Product/Service Name (Pages link) | Description. **[EXACT PRIMARY PER H2]**. [LINK]: in table names.
6. ${recH2} [STRUCTURE]: 1-2 paragraphs. [RECOMMENDATION]. [TABLE]: Product | Best for | Budget | Reason. **[EXACT PRIMARY PER H2]**.
7. ${SAP_NEXT_STEPS_H2} [STRUCTURE]: 1-2 paragraphs. [LIST]: numbered booking steps. **[EXACT PRIMARY PER H2]**. [LINK]: at least 1 [[LINK:PAGES title words|anchor]] mid-sentence.`;
}

export function sapPageTemplateIsActive(prompt: string): boolean {
  return prompt.includes(SAP_PAGE_TEMPLATE_START);
}
