/** Keep AISEO-useful numbers when current and defensible; never blind-copy stale page figures. */
export const DEFENSIBLE_SPECIFICITY_RULE = `**DEFENSIBLE SPECIFICITY (NON-NEGOTIABLE)**:
1. **Keep numbers when defensible**: Specific CAD bands, payback years, kWh usage, ¢/kWh rates, efficiency %, setback distances, and permit rules make the article more useful. Do not strip specificity to stay vague.
2. **Tier 1 (preferred)**: Use figures from VERIFIED FACTS with status confirmed (official government, utility, regulator, or authoritative spec sources). Publish prominently in the matching H2 and in Answer when relevant.
3. **Tier 2 (economic bands only)**: When official verification is not_found but FIRST-PARTY CLAIMS or QFO ChatGPT facts list an install cost, payback, or production band with source, you may use it as an **illustrative range** with explicit CAD/USD, units, and variance drivers (system size, equipment, roof, usage). Never use Tier 2 for program open/closed status or rebate eligibility.
4. **contradicted**: Replace the stale page figure with the official current fact in the same paragraph (e.g. provincial rebate closed as of researchAsOf). Do not imply the old incentive still applies.
5. **not_found (no Tier 2)**: Do not copy the stale excerpt number. Name what drives variance for that claim only; keep other confirmed figures in the section.
6. **Forbidden**: Stale existing page HTML figures, contradicted claims restated as active, or model-invented dollar amounts, rates, payback periods, or resale premiums.
7. **Numeric density**: When VERIFIED FACTS has two or more confirmed economic figures (cost, rate, payback, kWh, export), cost/ROI/savings sections must include at least two with units and explicit CAD or USD.`;

export const NUMERIC_DENSITY_TARGET_RULE = `**NUMERIC DENSITY (cost/ROI/solar topics)**: When the VERIFIED FACTS block lists two or more confirmed economic figures, the cost, savings, or ROI H2 must weave at least two distinct confirmed numbers with units and CAD or USD. Qualify ranges as illustrative when Tier 2. Never pad with invented figures.`;

/** Answer sets the topic contract and economic qualification ceiling; [ILLUSTRATIVE] must not exceed it. */
export const ILLUSTRATIVE_ANSWER_GROUNDING_RULE = `**ILLUSTRATIVE ↔ ANSWER GROUNDING (NON-NEGOTIABLE)**:
1. **Answer is the contract**: The [ILLUSTRATIVE] persona must enact the same decision the Answer explains (same industry, product, service, or strategy as Keyword + Answer). Forbidden: a different vertical than Answer. Answer also establishes how strongly you may state payback, install cost, bill savings, ROI, or resale economics. Every economic number or range in the persona scenario and site recommendation must match Answer qualification (same variance drivers, same illustrative vs confirmed tier, no stronger certainty).
2. **Answer economics (when topic touches cost/payback/savings)**: Qualify outcomes as varying by system size, usage, export rates, equipment, and incentives as of researchAsOf. Forbidden in Answer: universal lines like "homeowners recoup within X–Y years" or "pays back in 5–10 years" without depends-on framing. Payback ranges must name at least one driver (usage, size, export, rates).
3. **[ILLUSTRATIVE] persona scenario**: Copy ILLUSTRATIVE EXAMPLE — ONE decision matching Answer and Keyword, compact (blockquote 2-3 sentences, recommendation p 2 sentences). Forbidden: Homeowner A/B, product-catalog tours, keyword+location slug phrasing, a purchase or room problem Answer never discusses.
4. **Numbers in scenarios and recommendations**: Use only figures already in Answer, VERIFIED FACTS, or FIRST-PARTY CLAIMS at the same tier. Do not add new dollar amounts, payback years, or savings totals the Answer did not allow. Tier 2 bands stay labeled illustrative.
5. **Overview Real-World Example bullet**: Point to the illustrative section only. Forbidden: restating payback years, install cost, or savings totals from the persona scenarios in Overview prose.
6. **Do not recap Answer**: Overview, body H2s, and FAQ must not reopen with Answer's dates, rates, percentages, dollar figures, statute-name stack, or closing company sentence. Answer THIS section's heading only. Assume the reader already read Answer.
7. **Energy and comfort claims**: Automated shades, blinds, and similar comfort topics may help manage heat gain, glare, or scheduling convenience depending on orientation, glazing, usage, and climate. Forbidden: stating energy bill savings as guaranteed or using significant long-term savings without the same qualification Answer allows.`;

/** Injects published Answer text into the persona extract so the scenario matches this article. */
export function formatAnswerTopicContractForIllustrativeExtract(answerSectionHtml: string | undefined): string {
  const text = answerSectionHtml?.trim();
  if (!text) return "";
  return [
    "--- ARTICLE ANSWER (scenario topic contract — NON-NEGOTIABLE) ---",
    "The persona's ONE decision must be the same decision this Answer explains.",
    "Match Keyword + Answer industry only. Forbidden: a different product or service vertical.",
    "",
    text,
    "--- END ARTICLE ANSWER ---",
  ].join("\n");
}

/** Injects published Answer text for later harness sections (Overview, body, illustrative). */
export function formatAnswerGroundingForIllustrativePromptBlock(answerSectionHtml: string | undefined): string {
  const text = answerSectionHtml?.trim();
  if (!text) return "";
  return [
    "--- ANSWER GROUNDING (NON-NEGOTIABLE) ---",
    "Answer is already written for this article. Do not recap its dates, rates, percentages, dollar figures, statute-name stack, or closing company sentence. Your job is this section's heading only. Assume the reader already read Answer. The [ILLUSTRATIVE] persona must illustrate THIS Answer's topic and decision. Economic claims must not exceed Answer qualification.",
    "",
    text,
    "",
    ILLUSTRATIVE_ANSWER_GROUNDING_RULE,
    "--- END ANSWER GROUNDING ---",
  ].join("\n");
}
