/** Well-known acronyms in titles. */
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

/** One formatting contract for SAP, blog, titles, meta, Answer, body, FAQ, and keyword mentions. */
export const UNIFIED_COPY_FORMATTING_RULE = `**UNIFIED COPY FORMATTING (SAP + blog — mandatory)**:
- **Title Case everywhere**: Capitalize the first letter of **every** word in post titles, meta (when keyword appears), Answer, Overview, all body H2/H3, FAQ, table headers, and **every exact WRITING KEYWORD mention** in generated copy. Includes articles, conjunctions, and short prepositions (A, An, The, And, Or, But, For, In, On, At, To, Of, With, Near, Vs). No "sentence casing OK" exceptions for the keyword.
- **Link anchor text (exception)**: [[LINK:...|anchor]], same-site <a> anchor text, and Overview # scroll link phrases use **sentence case** (lowercase generic words; capitalize only brand names and proper nouns such as Hunter Douglas and PowerView). Title Case does **not** apply to link anchor phrases.
- **WRITING KEYWORD**: When an exact phrase is required, paste the WRITING KEYWORD string from the KEYWORD PUNCTUATION block exactly (canonical punctuation + Title Case). Never paste the raw lowercase ACF slug. Never stack keyword+place slug in headings.
- **Keyword placement**: WRITING KEYWORD may appear in post/SEO title (once, woven), Answer body, section **body** copy ([EXACT PRIMARY PER H2]), meta (once), and FAQ answers. **Forbidden** in any body H2 or H3 title text. **Forbidden**: repeating the keyword slug in every heading, anchor, or sentence.
- **Body H2/H3**: 3–10 words, full Title Case, **zero colons** (no \`Topic: subtitle\`). Use the exact blueprint <h2> title in harness output — do not paraphrase.
- **No colons** in post titles or body headings. One flowing phrase only.`;

/** Body harness H2/H3 in section writer output (not post title). */
export const HARNESS_HEADING_TITLE_CASE_RULE = `**Body H2/H3 Title Case (mandatory)**:
- Every body section <h2> and <h3> MUST use Title Case: capitalize the first letter of **every** word, including articles, conjunctions, and short prepositions (A, An, The, And, Or, But, For, In, On, At, To, Of, With, Near, Vs).
- Apply to pinned SAP titles (What We Offer, Next Steps, Our Recommendation for Homeowners in {place}) and all other body headings.
- Forbidden: sentence case ("Getting your ideal blinds", "next steps: booking a consultation"), colon subtitles on pinned titles ("Next Steps: Getting your ideal blinds"), or any body heading with a lowercase word start (except mixed-case brand names when already correct).
- Good: "What We Offer", "Next Steps", "Our Recommendation for Homeowners in Sunset Park", "Local Conditions That Change The Job".
- Forbidden: "What we offer", "Next Steps: Getting Your Ideal Blinds", "Our recommendation for homeowners in Sunset Park".`;

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
- Never stitch the primary keyword and a second title with a colon (forbidden: "Hunter Douglas Vs Alta: Hunter Douglas vs. Alta Shades"). One headline only.
- **Keyword is the topic signal, not the title.** Write a fresh editorial headline about that decision. Forbidden: pasting the writing keyword as the whole title. Forbidden: pasting it as a prefix or colon-block. Do not require the keyword as the first words. A natural phrase about the same choice is the title (example: How To Choose Between Hunter Douglas And Alta Shades).
${TITLE_CASE_RULE}
${TITLE_ANTI_CLICKBAIT_RULE}
- **Length**: Prefer a complete natural headline. **Never truncate, never cut mid-word, never strip trailing words.** Upload/return the full title.
- **No** site name, brand prefix, or pipe suffix (no "Brand | …"). Topic-focused title only.
${TITLE_WELL_KNOWN_ACRONYMS_RULE}`;
