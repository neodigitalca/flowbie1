import { normalizeInternalUrl } from "@/lib/wordpress-api/validate-internal-links";

export type BlogInternalLinkSpan = {
  index: number;
  href: string;
  anchor: string;
  normalizedHref: string;
};

export type BlogInternalLinkRange = BlogInternalLinkSpan & {
  hrefStart: number;
  hrefEnd: number;
};

function readInternalLinkMatch(
  m: RegExpExecArray,
  site: { siteHost: string; baseOrigin: string },
  siteBaseUrl: string,
  selfNorm: string,
): BlogInternalLinkRange | null {
  const rawHref = (m[1] ?? "").trim();
  if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
    return null;
  }
  const resolved = resolveHref(rawHref, site.baseOrigin);
  if (!resolved || !isInternalHref(resolved, site.siteHost)) return null;
  const normalizedHref = normalizeInternalUrl(siteBaseUrl, resolved);
  if (selfNorm && normalizedHref === selfNorm) return null;

  const openTag = m[0].slice(0, m[0].indexOf(">") + 1);
  const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(openTag);
  if (!hrefMatch?.[1]) return null;
  const hrefStart = m.index + openTag.indexOf(hrefMatch[0]) + hrefMatch[0].indexOf(hrefMatch[1]!);
  const hrefEnd = hrefStart + hrefMatch[1]!.length;

  return {
    index: 0,
    href: resolved,
    anchor: plainAnchorFromInnerHtml(m[2] ?? ""),
    normalizedHref,
    hrefStart,
    hrefEnd,
  };
}

/** Internal link spans with source href character ranges (aligned with extractInternalLinksFromHtml). */
export function extractInternalLinkRangesFromHtml(
  html: string,
  siteBaseUrl: string,
  pageUrl?: string,
): BlogInternalLinkRange[] {
  const trimmed = (html ?? "").trim();
  if (!trimmed) return [];
  const site = siteHostFromBase(siteBaseUrl);
  if (!site) return [];

  const selfNorm = pageUrl?.trim() ? normalizeInternalUrl(siteBaseUrl, pageUrl) : "";
  const out: BlogInternalLinkRange[] = [];
  const anchorRe = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(trimmed)) !== null) {
    const link = readInternalLinkMatch(m, site, siteBaseUrl, selfNorm);
    if (!link) continue;
    out.push({ ...link, index: out.length });
  }
  return out;
}

function siteHostFromBase(siteBaseUrl: string): { siteHost: string; baseOrigin: string } | null {
  try {
    const base = siteBaseUrl.startsWith("http") ? siteBaseUrl : `https://${siteBaseUrl}`;
    const baseUrl = new URL(base);
    return {
      siteHost: baseUrl.hostname.replace(/^www\./, "").toLowerCase(),
      baseOrigin: baseUrl.origin,
    };
  } catch {
    return null;
  }
}

function resolveHref(raw: string, baseOrigin: string): string | null {
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("/")) return `${baseOrigin}${raw}`;
    return new URL(raw, baseOrigin).href;
  } catch {
    return null;
  }
}

function isInternalHref(href: string, siteHost: string): boolean {
  try {
    const host = new URL(href).hostname.replace(/^www\./, "").toLowerCase();
    return host === siteHost;
  } catch {
    return false;
  }
}

function plainAnchorFromInnerHtml(inner: string): string {
  let out = "";
  let cursor = 0;
  while (cursor < inner.length) {
    const lt = inner.indexOf("<", cursor);
    if (lt === -1) {
      out += inner.slice(cursor);
      break;
    }
    out += inner.slice(cursor, lt);
    const gt = inner.indexOf(">", lt + 1);
    if (gt === -1) break;
    cursor = gt + 1;
  }
  return out.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntityAt(html: string, start: number): { char: string; end: number } | null {
  if (html[start] !== "&") return null;
  const semi = html.indexOf(";", start + 1);
  if (semi === -1 || semi - start > 12) return null;
  const raw = html.slice(start, semi + 1);
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
  };
  if (named[raw]) return { char: named[raw]!, end: semi + 1 };
  const dec = /^&#(\d+);$/.exec(raw);
  if (dec) {
    const cp = Number(dec[1]);
    if (cp > 0 && cp < 0x110000) return { char: String.fromCodePoint(cp), end: semi + 1 };
  }
  const hex = /^&#x([0-9a-f]+);$/i.exec(raw);
  if (hex) {
    const cp = Number.parseInt(hex[1]!, 16);
    if (cp > 0 && cp < 0x110000) return { char: String.fromCodePoint(cp), end: semi + 1 };
  }
  return null;
}

function decodeVisibleChar(ch: string): string {
  if (ch === "\u2019" || ch === "\u2018" || ch === "\u2032") return "'";
  if (ch === "\u201c" || ch === "\u201d") return '"';
  if (ch === "\u00a0") return " ";
  return ch;
}

function normalizePhraseChar(ch: string): string {
  return decodeVisibleChar(ch).toLowerCase();
}

type VisibleTextSpan = { htmlStart: number; htmlEnd: number; char: string };

function visibleTextSpansOutsideTags(html: string): VisibleTextSpan[] {
  const spans: VisibleTextSpan[] = [];
  let inTag = false;
  let i = 0;
  while (i < html.length) {
    const ch = html[i]!;
    if (ch === "<") {
      inTag = true;
      i += 1;
      continue;
    }
    if (ch === ">") {
      inTag = false;
      i += 1;
      continue;
    }
    if (inTag) {
      i += 1;
      continue;
    }
    const entity = decodeHtmlEntityAt(html, i);
    if (entity) {
      spans.push({ htmlStart: i, htmlEnd: entity.end, char: decodeVisibleChar(entity.char) });
      i = entity.end;
      continue;
    }
    spans.push({ htmlStart: i, htmlEnd: i + 1, char: decodeVisibleChar(ch) });
    i += 1;
  }
  return spans;
}

/** Plain visible text with HTML entities decoded (tags stripped). */
export function plainVisibleTextFromHtml(html: string): string {
  return visibleTextSpansOutsideTags(html)
    .map((s) => s.char)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ordered internal <a> links in document order (includes duplicate URLs). */
export function extractInternalLinksFromHtml(
  html: string,
  siteBaseUrl: string,
  pageUrl?: string,
): BlogInternalLinkSpan[] {
  const trimmed = (html ?? "").trim();
  if (!trimmed) return [];
  const site = siteHostFromBase(siteBaseUrl);
  if (!site) return [];

  const selfNorm = pageUrl?.trim() ? normalizeInternalUrl(siteBaseUrl, pageUrl) : "";
  const out: BlogInternalLinkSpan[] = [];
  const anchorRe = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(trimmed)) !== null) {
    const link = readInternalLinkMatch(m, site, siteBaseUrl, selfNorm);
    if (!link) continue;
    out.push({
      index: out.length,
      href: link.href,
      anchor: link.anchor,
      normalizedHref: link.normalizedHref,
    });
  }
  return out;
}

export function countInternalLinksInHtml(html: string, siteBaseUrl: string, pageUrl?: string): number {
  return extractInternalLinksFromHtml(html, siteBaseUrl, pageUrl).length;
}

/** Visible word count: strip tags, split on whitespace (same rule as ensure-links-per-section). */
export function countVisibleWordsInHtml(html: string): number {
  return (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export type HtmlParagraphSpan = {
  index: number;
  start: number;
  end: number;
  html: string;
};

/** h2/h3 section headings (link-add count driver). */
export function countSectionHeadingsInHtml(html: string): number {
  const trimmed = (html ?? "").trim();
  if (!trimmed) return 0;
  return (trimmed.match(/<h[23]\b[^>]*>[\s\S]*?<\/h[23]>/gi) ?? []).length;
}

/** Ordered `<p>...</p>` blocks; falls back to whole document as one paragraph. */
export function findHtmlParagraphSpans(html: string): HtmlParagraphSpan[] {
  const trimmed = (html ?? "").trim();
  if (!trimmed) return [];
  const spans: HtmlParagraphSpan[] = [];
  const re = /<p\b[^>]*>[\s\S]*?<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    spans.push({
      index: spans.length,
      start: m.index,
      end: m.index + m[0].length,
      html: m[0],
    });
  }
  if (!spans.length) {
    spans.push({ index: 0, start: 0, end: trimmed.length, html: trimmed });
  }
  return spans;
}

const BLOCK_TAG_RE = /<(p|h[1-6]|li|td|th|div|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Full HTML block containing an internal link (smallest matching p/li/div/etc.). */
export function paragraphHtmlForInternalLink(
  html: string,
  linkIndex: number,
  siteBaseUrl: string,
  pageUrl?: string,
): string {
  const ranges = extractInternalLinkRangesFromHtml(html, siteBaseUrl, pageUrl);
  const link = ranges[linkIndex];
  if (!link) return "";

  const containing: string[] = [];
  const trimmed = html.trim();
  let m: RegExpExecArray | null;
  BLOCK_TAG_RE.lastIndex = 0;
  while ((m = BLOCK_TAG_RE.exec(trimmed)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (link.hrefStart >= start && link.hrefEnd <= end) {
      containing.push(m[0]);
    }
  }
  if (containing.length) {
    const block = containing.reduce((shortest, next) => (next.length < shortest.length ? next : shortest));
    return block.length > 5000 ? `${block.slice(0, 5000)}…` : block;
  }

  for (const p of findHtmlParagraphSpans(html)) {
    if (link.hrefStart >= p.start && link.hrefEnd <= p.end) {
      return p.html.length > 5000 ? `${p.html.slice(0, 5000)}…` : p.html;
    }
  }

  return trimmed.slice(Math.max(0, link.hrefStart - 500), Math.min(trimmed.length, link.hrefEnd + 500));
}

/** Plain-text paragraph containing an internal link (for plan). */
export function paragraphTextForInternalLink(
  html: string,
  linkIndex: number,
  siteBaseUrl: string,
  pageUrl?: string,
): string {
  return plainAnchorFromInnerHtml(
    paragraphHtmlForInternalLink(html, linkIndex, siteBaseUrl, pageUrl),
  ).trim();
}

/** `<p>` blocks only — headings are never link-add targets. */
export function listHtmlParagraphBlocksForAddLinks(html: string): HtmlContentBlockSpan[] {
  return findHtmlParagraphSpans(html).map((p) => ({
    index: p.index,
    start: p.start,
    end: p.end,
    html: p.html,
  }));
}

/** Body `<p>` blocks without internal links, plain text for add planning. */
export function paragraphBlocksForLinkAdds(
  html: string,
  maxBlocks = 40,
): Array<{ index: number; text: string }> {
  const blocks = listHtmlParagraphBlocksForAddLinks(html);
  const out: Array<{ index: number; text: string }> = [];
  for (const block of blocks) {
    if (/<a\s+[^>]*href\s*=/i.test(block.html)) continue;
    const text = plainVisibleTextFromHtml(block.html);
    if (!text) continue;
    out.push({ index: block.index, text });
    if (out.length >= maxBlocks) break;
  }
  return out;
}

export type HtmlContentBlockSpan = {
  index: number;
  start: number;
  end: number;
  html: string;
};

/** Ordered body blocks (p, h1–h6, li, etc.) for link context. */
export function listHtmlParagraphBlocksForLinks(html: string): HtmlContentBlockSpan[] {
  const trimmed = (html ?? "").trim();
  if (!trimmed) return [];
  const blocks: HtmlContentBlockSpan[] = [];
  let m: RegExpExecArray | null;
  BLOCK_TAG_RE.lastIndex = 0;
  while ((m = BLOCK_TAG_RE.exec(trimmed)) !== null) {
    blocks.push({
      index: blocks.length,
      start: m.index,
      end: m.index + m[0].length,
      html: m[0],
    });
  }
  if (blocks.length) return blocks;
  return findHtmlParagraphSpans(html).map((p) => ({
    index: p.index,
    start: p.start,
    end: p.end,
    html: p.html,
  }));
}

/** First case-insensitive match of phrase outside HTML tags (HTML entities + apostrophe variants). */
export function findPhraseOutsideTags(
  html: string,
  phrase: string,
): { start: number; length: number } | null {
  const needle = phrase.trim();
  if (!needle) return null;
  const normalizedNeedle = [...needle].map((c) => normalizePhraseChar(c)).join("");
  const spans = visibleTextSpansOutsideTags(html).map((s) => ({
    ...s,
    char: normalizePhraseChar(s.char),
  }));
  if (!normalizedNeedle.length || spans.length < normalizedNeedle.length) return null;

  for (let j = normalizedNeedle.length - 1; j < spans.length; j += 1) {
    let matches = true;
    for (let k = 0; k < normalizedNeedle.length; k += 1) {
      if (spans[j - normalizedNeedle.length + 1 + k]!.char !== normalizedNeedle[k]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;
    const first = spans[j - normalizedNeedle.length + 1]!;
    const last = spans[j]!;
    return { start: first.htmlStart, length: last.htmlEnd - first.htmlStart };
  }
  return null;
}

/** Unwrap 2nd+ internal links that share the same destination URL (keep first). */
export function unwrapDuplicateInternalLinks(
  html: string,
  siteBaseUrl: string,
  pageUrl?: string,
): { html: string; dupesRemoved: number } {
  const trimmed = (html ?? "").trim();
  if (!trimmed) return { html, dupesRemoved: 0 };
  const site = siteHostFromBase(siteBaseUrl);
  if (!site) return { html, dupesRemoved: 0 };
  const selfNorm = pageUrl?.trim() ? normalizeInternalUrl(siteBaseUrl, pageUrl) : "";
  const seen = new Set<string>();
  let dupesRemoved = 0;
  const anchorRe = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const out = trimmed.replace(anchorRe, (full, rawHref: string, inner: string) => {
    const resolved = resolveHref(rawHref.trim(), site.baseOrigin);
    if (!resolved || !isInternalHref(resolved, site.siteHost)) return full;
    const norm = normalizeInternalUrl(siteBaseUrl, resolved);
    if (selfNorm && norm === selfNorm) return full;
    if (seen.has(norm)) {
      dupesRemoved += 1;
      return inner;
    }
    seen.add(norm);
    return full;
  });
  return { html: out, dupesRemoved };
}

/** Compare body with hrefs normalized (anchors preserved). */
export function stripLinkHrefsForCompare(html: string, siteBaseUrl: string): string {
  const spans = extractInternalLinksFromHtml(html, siteBaseUrl);
  let out = html ?? "";
  const anchorRe = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let linkOrdinal = 0;
  out = out.replace(anchorRe, (full, href: string, inner: string) => {
    const resolved = resolveHref(href.trim(), siteHostFromBase(siteBaseUrl)?.baseOrigin ?? "");
    if (!resolved) return full;
    const site = siteHostFromBase(siteBaseUrl);
    if (!site || !isInternalHref(resolved, site.siteHost)) return full;
    const norm = normalizeInternalUrl(siteBaseUrl, resolved);
    const span = spans[linkOrdinal];
    linkOrdinal += 1;
    const compareHref = span ? `href="${span.normalizedHref}"` : `href="${norm}"`;
    return `<a ${compareHref}>${inner}</a>`;
  });
  return out;
}
