/**
 * Overview scroll-link rules: model writes contextual <ul>; code completes exact # hrefs.
 */
import type { HarnessSectionAnchorEntry } from "@/lib/bulk/harness-section-anchor-ids";
import { stripHtmlTagsForSentenceCheck } from "@/lib/bulk/harness-section-complete-sentences";

export type OverviewAnchorTarget = { id: string; label: string };

const SCROLL_PLACEHOLDER_RE = /\[\[SCROLL:#([^|\]]+)\|([^\]]+)\]\]/gi;
const BOILERPLATE_SCROLL_LINK_RE = /\bsee\s+.+\s+below\b/i;

/** Parse anchor targets from formatHarnessInPageAnchorBlock output. */
export function parseInPageAnchorsFromBlock(block: string): OverviewAnchorTarget[] {
  const anchors: OverviewAnchorTarget[] = [];
  const bulletRe = /Bullet\s+\d+\s+→\s+#([^\s→]+)\s+→\s+"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = bulletRe.exec(block)) !== null) {
    anchors.push({ id: m[1], label: m[2] });
  }
  const sectionRe = /Section\s+\d+\s+→\s+#([^\s→]+)\s+→\s+"([^"]+)"/g;
  while ((m = sectionRe.exec(block)) !== null) {
    anchors.push({ id: m[1], label: m[2] });
  }
  return anchors;
}

export function anchorsFromHarnessEntries(entries: HarnessSectionAnchorEntry[]): OverviewAnchorTarget[] {
  return entries.map((e) => ({ id: e.anchorId, label: e.displayTitle }));
}

/** Model may use [[SCROLL:#id|phrase]] — code expands to <a href="#id">phrase</a>. */
export function expandOverviewScrollLinkPlaceholders(html: string): string {
  return html.replace(SCROLL_PLACEHOLDER_RE, (_match, rawId, rawText) => {
    const id = String(rawId).trim().replace(/^#/, "");
    const text = String(rawText).trim();
    return `<a href="#${id}">${text}</a>`;
  });
}

/** Expand [[SCROLL:#id|phrase]] to markdown [phrase](#id) before marked. */
export function expandOverviewScrollLinkPlaceholdersInMarkdown(markdown: string): string {
  return markdown.replace(SCROLL_PLACEHOLDER_RE, (_match, rawId, rawText) => {
    const id = String(rawId).trim().replace(/^#/, "");
    const text = String(rawText).trim();
    return `[${text}](#${id})`;
  });
}

export function overviewScrollLinkUsesBoilerplate(liInnerHtml: string): boolean {
  const plain = stripHtmlTagsForSentenceCheck(liInnerHtml);
  return BOILERPLATE_SCROLL_LINK_RE.test(plain);
}

function normalizeBoilerplateLiInner(inner: string): string {
  return inner.replace(
    /\bSee\s+(<a\b[^>]*>[\s\S]*?<\/a>)\s+below\.?/gi,
    "Explore $1 as part of this guide.",
  );
}

function findScrollLinkInLiInner(inner: string): { index: number; length: number; linkText: string } | null {
  const expanded = expandOverviewScrollLinkPlaceholders(inner);
  const aMatch = expanded.match(/<a\s+[^>]*href\s*=\s*(["'])#?[^"']*\1[^>]*>([\s\S]*?)<\/a>/i);
  if (!aMatch || aMatch.index === undefined) return null;
  return { index: aMatch.index, length: aMatch[0].length, linkText: aMatch[2].trim() };
}

function extractStrongLabel(inner: string): string | null {
  const m = inner.match(/<strong>([^<]*)<\/strong>/i);
  return m ? m[1].trim() : null;
}

function findOverviewUlInsertIndex(html: string): number {
  const lower = html.toLowerCase();
  const h2End = lower.indexOf("</h2>");
  if (h2End < 0) return html.trimEnd().length;
  const tail = html.slice(h2End + 5);
  const lastP = tail.toLowerCase().lastIndexOf("</p>");
  if (lastP >= 0) return h2End + 5 + lastP + 4;
  return h2End + 5 + tail.trimEnd().length;
}

function splitOverviewUlParts(html: string): { before: string; liInners: string[]; after: string } {
  const lower = html.toLowerCase();
  const ulOpen = lower.indexOf("<ul");
  if (ulOpen < 0) {
    const insertAt = findOverviewUlInsertIndex(html);
    return {
      before: html.slice(0, insertAt).trimEnd(),
      liInners: [],
      after: html.slice(insertAt).trimStart(),
    };
  }
  const ulClose = lower.indexOf("</ul>", ulOpen);
  if (ulClose < 0) {
    const before = html.slice(0, ulOpen).trimEnd();
    const partialUl = html.slice(ulOpen);
    const liInners = [...partialUl.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]);
    return { before, liInners, after: "" };
  }
  const before = html.slice(0, ulOpen).trimEnd();
  const ulBlock = html.slice(ulOpen, ulClose + 5);
  const after = html.slice(ulClose + 5).trim();
  const liInners = [...ulBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]);
  return { before, liInners, after };
}

function removeOverviewHashLinks(fragment: string): string {
  let out = fragment.replace(/<a\b[^>]*href\s*=\s*(["'])#?[^"']*\1[^>]*>[\s\S]*?<\/a>/gi, "");
  out = out.replace(/,\s*including\s*/gi, " ");
  out = out.replace(/\s{2,}/g, " ");
  out = out.replace(/\s+([,.!?;:])/g, "$1");
  return out.trim();
}

function finalizeOverviewScrollLi(
  existingInner: string | undefined,
  anchor: OverviewAnchorTarget,
  index: number,
): string {
  if (!existingInner?.trim()) {
    throw new Error(
      `Overview scroll links: missing bullet for anchor #${anchor.id} (index ${index + 1})`,
    );
  }

  let inner = existingInner.trim();
  if (overviewScrollLinkUsesBoilerplate(inner)) {
    throw new Error(`Overview scroll links: boilerplate bullet for anchor #${anchor.id}`);
  }

  inner = normalizeBoilerplateLiInner(inner);
  inner = expandOverviewScrollLinkPlaceholders(inner);
  const label = extractStrongLabel(inner);
  const labelPrefix = label ? `<strong>${label}</strong>: ` : "";
  const body = inner.replace(/^\s*<strong>[^<]*<\/strong>:?\s*/i, "").trim();

  const hit = findScrollLinkInLiInner(body);
  if (!hit?.linkText) {
    throw new Error(`Overview scroll links: no scroll link in bullet for anchor #${anchor.id}`);
  }

  const beforeLink = body.slice(0, hit.index).trimEnd();
  let afterLink = body.slice(hit.index + hit.length);
  afterLink = removeOverviewHashLinks(afterLink);

  const fixedLink = `<a href="#${anchor.id}">${hit.linkText}</a>`;
  const sentence = [beforeLink, fixedLink, afterLink].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return `<li>${labelPrefix}${sentence}</li>`;
}

/**
 * Model writes contextual overview prose and bullets; code completes exact # hrefs on existing bullets.
 * Throws when bullets are missing or malformed — upload prep uses OpenRouter for bullet copy instead.
 */
export function completeOverviewScrollLinks(
  html: string,
  anchors: OverviewAnchorTarget[] | HarnessSectionAnchorEntry[],
): string {
  const targets: OverviewAnchorTarget[] =
    anchors.length > 0 && 'anchorId' in anchors[0]!
      ? anchorsFromHarnessEntries(anchors as HarnessSectionAnchorEntry[])
      : (anchors as OverviewAnchorTarget[]);

  if (targets.length === 0) return html.trim();

  const prepared = expandOverviewScrollLinkPlaceholders(html);
  const { before, liInners, after } = splitOverviewUlParts(prepared);

  const fixedLis = targets.map((anchor, i) => finalizeOverviewScrollLi(liInners[i], anchor, i));
  const newUl = `<ul>\n${fixedLis.join("\n")}\n</ul>`;
  return after ? `${before}\n${newUl}\n${after}` : `${before}\n${newUl}`;
}

/** @deprecated Use completeOverviewScrollLinks */
export function enforceOverviewScrollLinkHrefs(html: string, anchors: OverviewAnchorTarget[]): string {
  return completeOverviewScrollLinks(html, anchors);
}

export function buildOverviewLinkRulesBlock(opts?: {
  entity?: string;
  wikipediaUrl?: string;
}): string {
  const entity = opts?.entity?.trim() ?? "";
  const wikipediaUrl = opts?.wikipediaUrl?.trim() ?? "";
  const hasEntityWiki =
    Boolean(entity) && entity !== "N/A" && Boolean(wikipediaUrl);

  const base =
    "Overview rules: (1) First sentence answers the primary keyword. (2) Lead paragraphs = plain prose only (optional entity Wikipedia in first paragraph when required). NO em dashes (Unicode U+2014 or U+2013) anywhere in Overview; use comma, period, or hyphen. Obey WORD BLACKLIST in system and user prompts. " +
    "(3) Mandatory - bullet list after lead paragraphs: exactly one item per IN-PAGE anchor, in order. " +
    "(4) Each bullet starts **2-3 word label**: then one short contextual sentence with exactly ONE [2-4 word phrase](#exact-id) woven in. " +
    "(5) FORBIDDEN per bullet: two links, duplicate #id links, keyword-echo second links, or \"including [link]\" phrasing. " +
    '(6) FORBIDDEN: "see below", "below", "click here", boilerplate pointers. (7) Stop after the bullet list.';

  if (hasEntityWiki) {
    return (
      `\nOverview LINKS: ${base} ` +
      `Optional entity Wikipedia in lead prose only: [${entity}](${wikipediaUrl}). ` +
      `No other http(s) URLs.\n`
    );
  }

  return `\nOverview LINKS: ${base} No links in lead prose unless entity Wikipedia is required. No http(s) URLs.\n`;
}

export function buildOverviewScrollLinkExampleLi(anchor: OverviewAnchorTarget): string {
  const words = anchor.label.trim().split(/\s+/).filter(Boolean);
  const phrase = words.slice(0, 3).join(" ").toLowerCase() || "learn more";
  return `<li><strong>${words.slice(0, 2).join(" ") || "Topic"}</strong>: See how [[SCROLL:#${anchor.id}|${phrase}]] fits your SEO plan.</li>`;
}
