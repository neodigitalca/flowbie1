/**
 * Overview (AI Overview H2) link rules for the bulk harness user prompt.
 * Hash-only by default; entity Wikipedia is the sole http(s) exception when URL + entity are present.
 */
export function buildOverviewLinkRulesBlock(opts?: {
  entity?: string;
  wikipediaUrl?: string;
}): string {
  const entity = opts?.entity?.trim() ?? "";
  const wikipediaUrl = opts?.wikipediaUrl?.trim() ?? "";
  const hasEntityWiki =
    Boolean(entity) && entity !== "N/A" && Boolean(wikipediaUrl);

  const hashRules =
    `Every same-page citation <a> MUST use href starting with # and MUST be an id from IN-PAGE SECTION ANCHORS. ` +
    `Anchor text MUST be a subtle 2–4 word phrase woven into the sentence (e.g. "cost factors", "system pricing") — NEVER the full section / H2 title as link text, NEVER "as detailed in [Full Title]". ` +
    `NON-NEGOTIABLE: one <li> per IN-PAGE anchor (N bullets for N body sections). Each bullet MUST contain exactly one # citation to its assigned anchor.`;

  if (hasEntityWiki) {
    return (
      `\nOverview LINKS (MANDATORY — overrides all other link rules for this section): ` +
      `${hashRules} ` +
      `ENTITY WIKIPEDIA (REQUIRED): Additionally include exactly one Wikipedia <a href="${wikipediaUrl}"> whose anchor text is the entity/area name "${entity}" (or a short phrase containing it). Copy the href character-for-character. ` +
      `FORBIDDEN: other http/https URLs, site page paths, Semrush externals, or any Wikipedia URL other than ${wikipediaUrl}. Body sections below may use site links — not Overview.\n`
    );
  }

  return (
    `\nOverview LINKS (MANDATORY — overrides all other link rules for this section): ` +
    `${hashRules} ` +
    `FORBIDDEN: http/https URLs, site page paths, Wikipedia, Semrush externals, or any non-# href. Body sections below may use site links — not Overview.\n`
  );
}
