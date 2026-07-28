/**
 * Overview (AI Overview) keyword / intent rules.
 * Overrides exact-match stuffing when the focus string is an SEO title template.
 */

export const OVERVIEW_KEYWORD_NATURAL_RULES = `KEYWORD / INTENT (NATURAL LANGUAGE — OVERRIDES EXACT-MATCH FOR THIS SECTION):
Primary keyword, keyword focus, and article title are search-intent signals, not a script to paste.
- First sentence MUST answer the same product/service + place (or topic) intent.
- Do NOT paste SEO title templates like "Best … Near …" or "Best … In …" as a contiguous phrase.
- Do NOT invent compound brand+place names (bad: "Hunter Douglas Blinds MacEwan Station AB offers…").
- Prefer readable phrasing (good: "Hunter Douglas blinds near MacEwan Station…" or "Looking for Hunter Douglas blinds near MacEwan Station?…").
- Keep proper nouns; leave filler words (best, near, in) natural in mid-sentence.
- Exact contiguous keyword match is NOT required in Overview when it would read as stuffing.
This overrides FIRST PARAGRAPH / EXACT PRIMARY exact-match rules for Overview only.`;
