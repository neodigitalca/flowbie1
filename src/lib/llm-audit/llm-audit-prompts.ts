export const LLM_AUDIT_SYSTEM_MESSAGE =
  "You are a local resident researching how a specific topic shows up in this market. Use web search. Each bullet must connect to the search topic (home details, streets, seasons, building patterns, housing era or style, exposure, habits that affect this product/service). Prefer facts about the named place entity (street, neighborhood, district) not only the parent city. Forbidden: census stats, distances, SEO advice, same-industry business names, generic chamber-of-commerce fluff, repeating the same nickname in multiple bullets. One concrete detail per bullet plus https source (verification only, not for the post).";

export const LLM_AUDIT_COMPANY_AUTHORITY_SYSTEM =
  "You research THIS business at the given website with web search. Ignore same-name firms on other domains or in other countries. Official facts only that connect to the given topic. Years and volume only if published. Street address and phone only if on this website. Forbidden: invented stats; hunting seasonal sales, rebates, or current promotions unless the topic is about those. One fact plus https each.";

export function buildLlmAuditUserPromptFull(input: {
  keyword: string;
  location: string;
  platformLabel?: string;
}): string {
  const { keyword, location } = input;
  const label = input.platformLabel?.trim() || "Web search";
  return `For ${label}: topic '${keyword}' in ${location}. List 10-12 bullets: local facts that make copy about THIS topic feel lived-in (housing era or style, typical window/wall/roof constraints, street or traffic or light patterns, seasonal habits affecting install or use, place names locals use, landmarks only if they connect to the topic). Tie every bullet to this place entity and this keyword. Not generic town history. No same-industry businesses or census. One fact + https each (verify only). Every bullet must include at least one https:// source URL.`;
}

/** Localized QFO buyer question audit (one planned research query). */
export function buildLlmAuditQfoUserPrompt(input: {
  researchQuery: string;
  focusKeyword: string;
  location: string;
}): string {
  const query = input.researchQuery.trim();
  const focusKeyword = input.focusKeyword.trim();
  const location = input.location.trim();
  return `Local buyer research question: "${query}" (page topic: ${focusKeyword} in ${location}). Use web search. Answer this question with 6-8 bullets: local facts about homes, housing stock, seasons, streets, and building patterns that affect this topic in ${location}. No same-industry business names or census stats. One concrete fact + https source each.`;
}

/** Official-source factual verification (OpenRouter fallback when SERP fetch unavailable). */
export function buildLlmAuditOfficialVerificationPrompt(input: {
  verificationQuery: string;
  claimLabel: string;
  focusKeyword: string;
  location: string;
  researchAsOf: string;
  preferDomains?: string[];
}): string {
  const domains = (input.preferDomains ?? []).filter(Boolean).join(", ") || "official government sites";
  return `Factual verification for article rewrite (${input.researchAsOf}).

Claim to verify: ${input.claimLabel.trim()}
Verification question: "${input.verificationQuery.trim()}"
Page topic: ${input.focusKeyword.trim()} in ${input.location.trim()}

Use web search. Answer ONLY from official government or provincial utility sources (${domains}, canada.ca, .gc.ca). Forbidden: installer blogs, news roundups, or unsourced summaries.

Return exactly:
1. status: confirmed | contradicted | not_found
2. fact: one sentence quoting or paraphrasing only what the official page states (program status, rebate rate, eligibility, sizing guidance). No extrapolation.
3. sourceUrl: exact https URL of the official page used

If no official source answers this claim, status must be not_found and fact must be empty.`;
}
