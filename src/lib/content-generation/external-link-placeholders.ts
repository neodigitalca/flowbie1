/**
 * External link placeholders: harness writes [[EXTERNAL:url|anchor]], code emits <a href>.
 */

export type ExternalLinkPair = { url: string; anchor: string };

export const EXTERNAL_LINK_PLACEHOLDER_RE =
  /\[\[EXTERNAL:([^|\]]+)\|([^\]]+)\]\]/g;

export const EXTERNAL_LINK_BARE_PLACEHOLDER_RE = /\[\[EXTERNAL\]\]/g;

const EXTERNAL_SEMRUSH_FEATURE_RE =
  /\[EXTERNAL_SEMRUSH\]:\s*href=(https?:\/\/[^\s|]+)\s*\|\s*anchor=([^\]]+)/i;

const LLM_AUDIT_AUTHORITY_FEATURE_RE =
  /\[LLM_AUDIT_AUTHORITY_LINK\]:\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)/i;

const BAD_LINK_ANCHOR_RE =
  /^(?:here|click here|read more|learn more|this page|this link|link|more info|more information)$/i;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeUrlKey(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function normalizeAnchorKey(anchor: string): string {
  return anchor.trim().replace(/\s+/g, " ").toLowerCase();
}

function pairKey(url: string, anchor: string): string {
  return `${normalizeUrlKey(url)}|${normalizeAnchorKey(anchor)}`;
}

export function parseExternalSemrushPairsFromAgents(
  agents: Array<{ features?: string[] }>,
): ExternalLinkPair[] {
  const out: ExternalLinkPair[] = [];
  const seen = new Set<string>();
  for (const agent of agents) {
    for (const feature of agent.features ?? []) {
      const m = feature.match(EXTERNAL_SEMRUSH_FEATURE_RE);
      if (!m) continue;
      const url = m[1]!.trim();
      const anchor = m[2]!.trim();
      if (!url || !anchor) continue;
      const key = pairKey(url, anchor);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ url, anchor });
    }
  }
  return out;
}

export function parseLlmAuditAuthorityPairsFromAgents(
  agents: Array<{ features?: string[] }>,
): ExternalLinkPair[] {
  const out: ExternalLinkPair[] = [];
  const seen = new Set<string>();
  for (const agent of agents) {
    for (const feature of agent.features ?? []) {
      const m = feature.match(LLM_AUDIT_AUTHORITY_FEATURE_RE);
      if (!m) continue;
      const anchor = m[1]!.trim();
      const url = m[2]!.trim();
      if (!url || !anchor) continue;
      const key = pairKey(url, anchor);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ url, anchor });
    }
  }
  return out;
}

export function mergeExternalLinkPairs(...groups: ExternalLinkPair[][]): ExternalLinkPair[] {
  const seen = new Set<string>();
  const out: ExternalLinkPair[] = [];
  for (const group of groups) {
    for (const pair of group) {
      const key = pairKey(pair.url, pair.anchor);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(pair);
    }
  }
  return out;
}

/** Row-only allowlist: modifier_links_json + imported_links_json + LLM audit authority links. */
export function buildRowExplicitExternalAllowlist(opts: {
  modifierExternalLinks?: Array<{ url: string; anchorText: string }>;
  importedDraftLinks?: Array<{ url: string; anchorText: string }>;
  llmAuditAuthorityLinks?: Array<{ url: string; anchorText: string }>;
}): ExternalLinkPair[] {
  const seen = new Set<string>();
  const out: ExternalLinkPair[] = [];
  const add = (url: string, anchor: string) => {
    const u = url.trim();
    const a = anchor.trim();
    if (!u || !a) return;
    const key = pairKey(u, a);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url: u, anchor: a });
  };
  for (const link of opts.modifierExternalLinks ?? []) {
    add(link.url, link.anchorText);
  }
  for (const link of opts.importedDraftLinks ?? []) {
    add(link.url, link.anchorText);
  }
  for (const link of opts.llmAuditAuthorityLinks ?? []) {
    add(link.url, link.anchorText);
  }
  return out;
}

export function externalUrlsFromPairs(pairs: ExternalLinkPair[]): string[] {
  return pairs.map((pair) => pair.url.trim()).filter(Boolean);
}

/** @deprecated Bulk upload uses buildRowExplicitExternalAllowlist only. */
export function buildAllowedExternalPairs(
  agents: Array<{ features?: string[] }>,
  modifierLinks: Array<{ url: string; anchorText: string }> = [],
): ExternalLinkPair[] {
  return buildRowExplicitExternalAllowlist({ modifierExternalLinks: modifierLinks });
}

function findPairByUrl(url: string, allowedPairs: ExternalLinkPair[]): ExternalLinkPair | null {
  const key = normalizeUrlKey(url);
  for (const pair of allowedPairs) {
    if (normalizeUrlKey(pair.url) === key) return pair;
  }
  return null;
}

function findAllowedPair(
  url: string,
  anchor: string,
  allowedPairs: ExternalLinkPair[],
): ExternalLinkPair | null {
  const key = pairKey(url, anchor);
  for (const pair of allowedPairs) {
    if (pairKey(pair.url, pair.anchor) === key) return pair;
  }
  return null;
}

const BARE_URL_TRAILING_PUNCT = new Set([".", ",", ";", ":", "!", "?", ")", "}", "]", "'", '"']);

function splitBareUrlTrailingPunctuation(raw: string): { url: string; trailing: string } {
  let url = raw;
  let trailing = "";
  while (url.length > 0 && BARE_URL_TRAILING_PUNCT.has(url[url.length - 1]!)) {
    trailing = url[url.length - 1]! + trailing;
    url = url.slice(0, -1);
  }
  return { url, trailing };
}

export function deriveAnchorFromExternalUrl(url: string): string {
  try {
    const u = new URL(url.replace(/&amp;/gi, "&"));
    const slug = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop() ?? "";
    if (slug) {
      return slug
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
    }
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function plainLinkLabel(labelHtml: string): string {
  return labelHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function isBadLinkAnchorLabel(label: string, href: string): boolean {
  if (!label) return true;
  if (BAD_LINK_ANCHOR_RE.test(label)) return true;
  if (/^https?:\/\//i.test(label)) return true;
  const normHref = href.trim().replace(/\/+$/, "").toLowerCase();
  const normLabel = label.replace(/\/+$/, "").toLowerCase();
  if (normHref === normLabel) return true;
  return false;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url.trim().replace(/&amp;/gi, "&")).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function externalLinkTag(pair: ExternalLinkPair, anchorOverride?: string): string {
  const href = pair.url.replace(/"/g, "&quot;").replace(/&/g, "&amp;");
  const anchor = (anchorOverride ?? pair.anchor).trim() || deriveAnchorFromExternalUrl(pair.url);
  return `<a href="${href}">${escapeHtml(anchor)}</a>`;
}

/** "Edmonton. edmonton.ca" → linked city keyword (not bare domain prose). */
function fixCityPeriodBareHostnameInTextSegment(text: string, allowedPairs: ExternalLinkPair[]): string {
  if (!text || !allowedPairs.length) return text;
  let out = text;
  for (const pair of allowedPairs) {
    const host = hostnameFromUrl(pair.url);
    if (!host) continue;
    const re = new RegExp(
      `\\b([A-Z][a-z]+(?:,\\s*[A-Z][a-z]+)?)\\.\\s*${escapeRegExp(host)}\\b`,
      "g",
    );
    out = out.replace(re, (_match, cityPart: string) => {
      const anchor = cityPart.trim().split(",")[0]?.trim();
      if (!anchor || BAD_LINK_ANCHOR_RE.test(anchor)) {
        return externalLinkTag(pair);
      }
      return externalLinkTag(pair, anchor);
    });
  }
  return out;
}

function wrapBareHostnamesInTextSegment(text: string, allowedPairs: ExternalLinkPair[]): string {
  if (!text || !allowedPairs.length) return text;
  let out = text;
  for (const pair of allowedPairs) {
    const host = hostnameFromUrl(pair.url);
    if (!host) continue;
    const re = new RegExp(`(?<![./:@])\\b${escapeRegExp(host)}\\b`, "gi");
    out = out.replace(re, () => externalLinkTag(pair));
  }
  return out;
}

function processPlainExternalLinkText(text: string, allowedPairs: ExternalLinkPair[]): string {
  let out = fixCityPeriodBareHostnameInTextSegment(text, allowedPairs);
  if (/<[^>]+>/.test(out)) {
    return out.replace(/(<[^>]+>)|([^<]+)/g, (_m, tag: string | undefined, plain: string | undefined) => {
      if (tag) return tag;
      if (!plain) return "";
      let chunk = wrapBareUrlsInTextSegment(plain, allowedPairs);
      chunk = wrapBareHostnamesInTextSegment(chunk, allowedPairs);
      return chunk;
    });
  }
  out = wrapBareUrlsInTextSegment(out, allowedPairs);
  out = wrapBareHostnamesInTextSegment(out, allowedPairs);
  return out;
}

function processExternalLinkTextSegment(text: string, allowedPairs: ExternalLinkPair[]): string {
  if (!text || !allowedPairs.length) return text;
  if (/<[^>]+>/.test(text)) {
    return text.replace(/(<[^>]+>)|([^<]+)/g, (_m, tag: string | undefined, plain: string | undefined) => {
      if (tag) return tag;
      return plain ? processPlainExternalLinkText(plain, allowedPairs) : "";
    });
  }
  return processPlainExternalLinkText(text, allowedPairs);
}

function wrapBareUrlsInTextSegment(text: string, allowedPairs: ExternalLinkPair[]): string {
  if (!text || !allowedPairs.length) return text;
  const bareUrlRe = /https?:\/\/[^\s<>"']+/gi;
  return text.replace(bareUrlRe, (rawMatch) => {
    const { url, trailing } = splitBareUrlTrailingPunctuation(rawMatch);
    const pair = findPairByUrl(url, allowedPairs);
    if (!pair) {
      return trailing ? trailing : "";
    }
    return `${externalLinkTag(pair)}${trailing}`;
  });
}

/** Convert bare https:// URLs and bare hostnames in HTML text nodes to anchor tags. */
export function wrapBareExternalUrlsInHtml(
  html: string,
  allowedPairs: ExternalLinkPair[] = [],
): string {
  if (!html?.trim() || allowedPairs.length === 0) return html;
  return html.replace(/(<[^>]+>)|([^<]+)/g, (_match, tag: string | undefined, text: string | undefined) => {
    if (tag) return tag;
    if (!text) return text ?? "";
    return processExternalLinkTextSegment(text, allowedPairs);
  });
}

/** Resolve placeholders, wrap bare URLs/hostnames, and fix raw URL anchor labels. */
export function finalizeExternalLinksInHtml(
  html: string,
  allowedPairs: ExternalLinkPair[] = [],
): string {
  if (!html?.trim()) return html;
  let out = resolveExternalLinkPlaceholdersInHtml(html, allowedPairs);
  out = wrapBareExternalUrlsInHtml(out, allowedPairs);
  out = ensureAllLinkAnchorsInHtml(out, allowedPairs);
  return out;
}

/** Every <a> must have visible anchor text; external links use approved Semrush anchor when URL matches. */
export function ensureAllLinkAnchorsInHtml(
  html: string,
  allowedPairs: ExternalLinkPair[] = [],
): string {
  if (!html?.trim()) return html;
  return html.replace(
    /<a\b([^>]*?)href=["']([^"']+)["']([^>]*?)>([\s\S]*?)<\/a>/gi,
    (match, before: string, href: string, after: string, labelHtml: string) => {
      const plain = plainLinkLabel(labelHtml);
      const safeHref = href.replace(/"/g, "&quot;").replace(/&/g, "&amp;");

      if (/^https?:\/\//i.test(href)) {
        const pair = findPairByUrl(href, allowedPairs);
        if (pair) {
          const approved = pair.anchor.trim() || deriveAnchorFromExternalUrl(pair.url);
          if (
            plain
            && !isBadLinkAnchorLabel(plain, href)
            && plain.replace(/\/+$/, "").toLowerCase() !== href.replace(/\/+$/, "").toLowerCase()
          ) {
            return match;
          }
          return `<a${before}href="${safeHref}"${after}>${escapeHtml(approved)}</a>`;
        }
        if (isBadLinkAnchorLabel(plain, href)) {
          const anchor = deriveAnchorFromExternalUrl(href);
          return `<a${before}href="${safeHref}"${after}>${escapeHtml(anchor)}</a>`;
        }
        return match;
      }

      if (href.startsWith("#")) {
        if (!plain) {
          const anchor = href
            .slice(1)
            .replace(/-/g, " ")
            .replace(/\b\w/g, (ch) => ch.toUpperCase());
          return `<a${before}href="${safeHref}"${after}>${escapeHtml(anchor)}</a>`;
        }
        return match;
      }

      if (isBadLinkAnchorLabel(plain, href)) {
        const anchor = deriveAnchorFromExternalUrl(href);
        return `<a${before}href="${safeHref}"${after}>${escapeHtml(anchor)}</a>`;
      }
      return match;
    },
  );
}

/** Fix external links whose visible label is the raw URL instead of anchor text. */
export function fixExternalAnchorsWithRawUrlLabels(
  html: string,
  allowedPairs: ExternalLinkPair[] = [],
): string {
  return ensureAllLinkAnchorsInHtml(html, allowedPairs);
}

function maskExternalPlaceholders(content: string): string {
  return content
    .replace(EXTERNAL_LINK_PLACEHOLDER_RE, "[[EXTERNAL:MASKED|MASKED]]")
    .replace(EXTERNAL_LINK_BARE_PLACEHOLDER_RE, "[[EXTERNAL]]");
}

function connectedSiteHost(siteUrl: string | undefined): string {
  if (!siteUrl?.trim()) return "";
  try {
    const base = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
    return new URL(base).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function isSameSiteHref(href: string, siteUrl: string | undefined): boolean {
  const host = connectedSiteHost(siteUrl);
  if (!host) return false;
  try {
    const u = new URL(href);
    return u.hostname.replace(/^www\./i, "").toLowerCase() === host;
  } catch {
    return false;
  }
}

export function assertHarnessExternalLinksValid(
  html: string,
  opts: {
    title: string;
    siteUrl?: string;
    allowedPairs?: ExternalLinkPair[];
  },
): void {
  const allowedPairs = opts.allowedPairs ?? [];
  const masked = maskExternalPlaceholders(html);
  const proseCheck = stripHtmlForFootnoteCheck(masked).replace(/\[\[EXTERNAL:MASKED\|MASKED\]\]/g, "");
  if (/https?:\/\//i.test(proseCheck)) {
    throw new Error(
      `Harness: section "${opts.title}" contains bare https URL in prose — use [[EXTERNAL:url|anchor]] placeholder only`,
    );
  }
  for (const pair of allowedPairs) {
    const host = hostnameFromUrl(pair.url);
    if (!host) continue;
    const hostRe = new RegExp(`\\b${escapeRegExp(host)}\\b`, "i");
    if (hostRe.test(proseCheck)) {
      throw new Error(
        `Harness: section "${opts.title}" contains bare hostname ${host} in prose — use [[EXTERNAL:${pair.url}|${pair.anchor}]] woven mid-sentence`,
      );
    }
  }

  const externalAnchorRe = /<a\b[^>]*href\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = externalAnchorRe.exec(html)) !== null) {
    const href = m[1]!.trim();
    if (!isSameSiteHref(href, opts.siteUrl)) {
      throw new Error(
        `Harness: section "${opts.title}" contains AI-written external link ${href} — use [[EXTERNAL:url|anchor]] placeholder only`,
      );
    }
  }

  EXTERNAL_LINK_PLACEHOLDER_RE.lastIndex = 0;
  while ((m = EXTERNAL_LINK_PLACEHOLDER_RE.exec(html)) !== null) {
    const url = m[1]!.trim();
    const anchor = m[2]!.trim();
    if (!findAllowedPair(url, anchor, allowedPairs)) {
      throw new Error(
        `Harness: section "${opts.title}" has invalid [[EXTERNAL:${url}|${anchor}]] — not in approved Semrush pairs`,
      );
    }
  }

  if (/\s\([^()]{8,120}\)(?=[.!?,;:\s]|$)/.test(stripHtmlForFootnoteCheck(masked))) {
    throw new Error(
      `Harness: section "${opts.title}" contains parenthetical footnote citation — use [[EXTERNAL:url|anchor]] instead`,
    );
  }
}

function stripHtmlForFootnoteCheck(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

export function resolveExternalLinkPlaceholdersInHtml(
  html: string,
  allowedPairs: ExternalLinkPair[] = [],
): string {
  if (!html?.trim()) return html;

  let out = html;
  const singlePair = allowedPairs.length === 1 ? allowedPairs[0]! : null;

  if (singlePair) {
    out = out.replace(EXTERNAL_LINK_BARE_PLACEHOLDER_RE, () => {
      const u = singlePair.url.replace(/"/g, "&quot;").replace(/&/g, "&amp;");
      return `<a href="${u}">${escapeHtml(singlePair.anchor)}</a>`;
    });
  }

  out = out.replace(EXTERNAL_LINK_PLACEHOLDER_RE, (_match, rawUrl: string, rawAnchor: string) => {
    const url = rawUrl.trim();
    const anchor = rawAnchor.trim();
    const pair = findAllowedPair(url, anchor, allowedPairs) ?? findPairByUrl(url, allowedPairs);
    if (!pair) {
      return escapeHtml(anchor);
    }
    const href = pair.url.replace(/"/g, "&quot;").replace(/&/g, "&amp;");
    const label = pair.anchor.trim() || anchor;
    return `<a href="${href}">${escapeHtml(label)}</a>`;
  });

  if (allowedPairs.length === 0) {
    out = out.replace(EXTERNAL_LINK_BARE_PLACEHOLDER_RE, "");
  }

  return out;
}

/** Harness / system prompt copy for placeholder-based external authority links. */
export const EXTERNAL_LINK_PLACEHOLDER_PROMPT_BLOCK = `=== EXTERNAL LINK PLACEHOLDERS (body sections — weave like internal links) ===
Format (exact): [[EXTERNAL:exact-url|exact-anchor]]
- Copy exact URL and anchor from APPROVED EXTERNAL URLs (SEMRUSH or LLM AUDIT AUTHORITY) blocks only.
- Weave **mid-sentence inside a paragraph**, same placement rules as [[LINK:query|anchor]] internal links.
- anchor = approved phrase from the list (2-6 words). Never invent anchors.
FORBIDDEN: bare hostname or domain as plain text or anchor (edmonton.ca, energy.gov); writing "City. domain.ca" instead of [[EXTERNAL:url|City]]; "for more", "here", "learn more", or "read more" as anchor; appending the link after the final period; a standalone link-only sentence.
Example: "Homeowners in [[EXTERNAL:https://www.edmonton.ca/residential/solar|Edmonton]] should review solar guidelines before applying for permits."
=== END EXTERNAL LINK PLACEHOLDERS ===`;
