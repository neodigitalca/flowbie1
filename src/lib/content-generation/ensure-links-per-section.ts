/**
 * Agentic links per section: ensure at least one internal link per H2 and H3 section.
 * Used after content generation so no post is uploaded with zero links when linkable posts exist.
 * Also provides word-based guarantee: at least one link every ~200 words.
 * Minimum links = max(10, ceil(words/200), number of H2+H3 headings).
 *
 * HTML flow: deterministic insert only — adds <a href> tags without OpenRouter rewrites.
 */

import { extractInternalLinksFromContent } from "@/lib/wordpress-api/validate-internal-links";

const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
const HREF_PATTERN = /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi;

/** Target: one internal link per this many words. */
export const WORDS_PER_LINK_TARGET = 200;

/** Minimum number of internal links required per blog post (AI-sourced, validated). */
export const MIN_LINKS_PER_POST = 10;

export type WordPressPost = { id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string };

export interface EnsureLinksPerSectionOptions {
  markdown: string;
  wordPressPosts: WordPressPost[];
  currentPageUrl?: string;
  siteUrl: string;
  apiKey: string;
  siteId?: string;
  setProgress?: (opts: { step: string; progress?: number; message?: string }) => void;
}

function getSiteHost(siteUrl: string): string {
  try {
    const u = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Normalize URL for Set lookup: lowercase, trim, strip trailing slashes. */
function normalizeUrlForSet(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

/**
 * Builds the set of valid internal URLs once. Call at pipeline entry and pass to inner functions.
 * Stores normalized form (lowercase, no trailing slash) and with trailing slash so a single has() suffices.
 */
function buildValidInternalUrlSet(
  wordPressPosts: WordPressPost[],
  siteHost: string
): Set<string> {
  const set = new Set<string>();
  wordPressPosts.forEach((post) => {
    if (!post.link?.trim()) return;
    const url = post.link.trim();
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      if (host !== siteHost) return;
      const norm = normalizeUrlForSet(url);
      set.add(norm);
      set.add(norm + "/");
    } catch {
      // skip invalid URL
    }
  });
  return set;
}

function countInternalLinksInSection(
  sectionMarkdown: string,
  siteHost: string,
  validUrls: Set<string>
): number {
  let count = 0;
  let m: RegExpExecArray | null;
  LINK_PATTERN.lastIndex = 0;
  while ((m = LINK_PATTERN.exec(sectionMarkdown)) !== null) {
    const url = m[2];
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      if (host !== siteHost) continue;
      const norm = normalizeUrlForSet(url);
      if (validUrls.has(norm) || validUrls.has(norm + "/")) count++;
    } catch {
      // skip
    }
  }
  return count;
}

export function countInternalLinksInMarkdown(
  markdown: string,
  wordPressPosts: WordPressPost[],
  siteUrl: string
): number {
  const siteHost = getSiteHost(siteUrl);
  const validUrls = buildValidInternalUrlSet(wordPressPosts, siteHost);
  let total = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(LINK_PATTERN.source, "g");
  while ((m = re.exec(markdown)) !== null) {
    const url = m[2];
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      if (host !== siteHost) continue;
      const norm = normalizeUrlForSet(url);
      if (validUrls.has(norm) || validUrls.has(norm + "/")) total++;
    } catch {
      // skip
    }
  }
  return total;
}

/** Count internal links in HTML (from href attributes). */
function countInternalLinksInHtml(
  html: string,
  siteHost: string,
  validUrls: Set<string>
): number {
  let count = 0;
  let m: RegExpExecArray | null;
  HREF_PATTERN.lastIndex = 0;
  while ((m = HREF_PATTERN.exec(html)) !== null) {
    const url = m[1];
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      if (host !== siteHost) continue;
      const norm = normalizeUrlForSet(url);
      if (validUrls.has(norm) || validUrls.has(norm + "/")) count++;
    } catch {
      // skip
    }
  }
  return count;
}

export function countInternalLinksInHtmlContent(
  html: string,
  wordPressPosts: WordPressPost[],
  siteUrl: string
): number {
  const siteHost = getSiteHost(siteUrl);
  const validUrls = buildValidInternalUrlSet(wordPressPosts, siteHost);
  return countInternalLinksInHtml(html, siteHost, validUrls);
}

/** Short anchor text from a WordPress post title (2–4 words). */
export function shortAnchorFromPostTitle(title: string): string {
  const words = title
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s'-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "related page";
  return words.slice(0, 4).join(" ");
}

const HTML_INTERNAL_LINK_RE = /<a\s[^>]*href=["']https?:\/\//i;
const MD_INTERNAL_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/;

/**
 * Inserts one internal link into the first <p> that has no http(s) link.
 * Does not rewrite or add paragraphs — appends the anchor tag at the end of that paragraph.
 */
export function insertOneInternalLinkIntoHtml(
  sectionHtml: string,
  link: { title: string; link: string },
): string {
  if (!sectionHtml.trim() || !link.link?.trim()) return sectionHtml;

  const anchor = shortAnchorFromPostTitle(link.title);
  const anchorTag = `<a href="${link.link.trim()}">${anchor}</a>`;
  let inserted = false;

  const out = sectionHtml.replace(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/gi, (full, attrs, inner) => {
    if (inserted) return full;
    if (HTML_INTERNAL_LINK_RE.test(inner)) return full;
    inserted = true;
    const trimmed = inner.trimEnd();
    const spacer = trimmed.length > 0 && !/\s$/.test(trimmed) ? " " : "";
    return `<p${attrs || ""}>${trimmed}${spacer}${anchorTag}</p>`;
  });

  return inserted ? out : sectionHtml;
}

/**
 * Inserts one markdown internal link at the end of the first paragraph without a link.
 */
export function insertOneInternalLinkIntoMarkdown(
  sectionMarkdown: string,
  link: { title: string; link: string },
): string {
  if (!sectionMarkdown.trim() || !link.link?.trim()) return sectionMarkdown;

  const anchor = shortAnchorFromPostTitle(link.title);
  const mdLink = `[${anchor}](${link.link.trim()})`;
  const parts = sectionMarkdown.split(/\n\n+/);
  for (let i = 0; i < parts.length; i++) {
    if (MD_INTERNAL_LINK_RE.test(parts[i]!)) continue;
    parts[i] = `${parts[i]!.trimEnd()} ${mdLink}`;
    return parts.join("\n\n");
  }
  return sectionMarkdown;
}

/**
 * Split HTML into chunks of ~wordsPerChunk at block boundaries (p, h2, ul, ol, table).
 * Preserves all HTML structure within each chunk.
 */
function splitHtmlIntoWordChunks(html: string, wordsPerChunk: number): string[] {
  const trimmed = html.trim();
  if (!trimmed) return [];
  // Match block elements: p, h1-h6, ul, ol, table. Use regex to split before each block.
  const blockRe = /<(p|h[1-6]|ul|ol|table)[^>]*>[\s\S]*?<\/\1>/gi;
  const blocks: string[] = [];
  let lastIndex = 0;
  let m;
  while ((m = blockRe.exec(trimmed)) !== null) {
    const before = trimmed.slice(lastIndex, m.index).trim();
    if (before) blocks.push(before);
    blocks.push(m[0]);
    lastIndex = blockRe.lastIndex;
  }
  const rest = trimmed.slice(lastIndex).trim();
  if (rest) blocks.push(rest);
  if (blocks.length === 0) return [trimmed];

  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;
  for (const block of blocks) {
    const words = block.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    if (currentWords + words >= wordsPerChunk && current.length > 0) {
      chunks.push(current.join(""));
      current = [];
      currentWords = 0;
    }
    current.push(block);
    currentWords += words;
  }
  if (current.length > 0) chunks.push(current.join(""));
  return chunks;
}

/**
 * Splits markdown into chunks of approximately `wordsPerChunk` words (by paragraph boundaries).
 */
function splitIntoWordChunks(markdown: string, wordsPerChunk: number): string[] {
  const trimmed = markdown.trim();
  if (!trimmed) return [];
  const paragraphs = trimmed.split(/\n\n+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;
  for (const p of paragraphs) {
    const words = p.split(/\s+/).filter(Boolean).length;
    if (currentWords + words >= wordsPerChunk && current.length > 0) {
      chunks.push(current.join("\n\n"));
      current = [];
      currentWords = 0;
    }
    current.push(p);
    currentWords += words;
  }
  if (current.length > 0) chunks.push(current.join("\n\n"));
  return chunks;
}

/**
 * Ensures at least one internal link per ~200 words. Chunks with 0 links get one added via AI.
 * Returns updated markdown. Does not mutate input.
 */
export async function ensureLinksEvery200Words(
  options: EnsureLinksPerSectionOptions
): Promise<string> {
  const {
    markdown,
    wordPressPosts,
    currentPageUrl,
    siteUrl,
    apiKey,
    siteId,
    setProgress,
  } = options;

  if (!markdown?.trim() || !wordPressPosts?.length) return markdown;

  const siteHost = getSiteHost(siteUrl);
  const validUrls = buildValidInternalUrlSet(wordPressPosts, siteHost);
  const normalizedCurrent = currentPageUrl?.replace(/\/+$/, "").toLowerCase() ?? "";
  const allowedForLinking = wordPressPosts.filter((p) => {
    if (!p.link?.trim()) return false;
    const norm = p.link.trim().replace(/\/+$/, "").toLowerCase();
    return norm !== normalizedCurrent && norm + "/" !== normalizedCurrent && normalizedCurrent + "/" !== norm;
  });
  if (!allowedForLinking.length) return markdown;

  const chunks = splitIntoWordChunks(markdown, WORDS_PER_LINK_TARGET);
  if (chunks.length === 0) return markdown;

  const linksPayload = allowedForLinking.map((p) => ({ title: p.title, link: p.link }));

  const revisedChunks = chunks.map((chunk, i) => {
    const count = countInternalLinksInSection(chunk, siteHost, validUrls);
    if (count >= 1) return chunk;
    setProgress?.({
      step: "Ensuring links every 200 words",
      message: `Adding internal link to chunk ${i + 1}/${chunks.length}...`,
    });
    const pick = linksPayload[i % linksPayload.length]!;
    return insertOneInternalLinkIntoMarkdown(chunk, pick);
  });

  return revisedChunks.join("\n\n");
}

export interface EnsureLinksEvery200WordsForHtmlOptions {
  htmlContent: string;
  wordPressPosts: WordPressPost[];
  currentPageUrl?: string;
  siteUrl: string;
  apiKey: string;
  siteId?: string;
  setProgress?: (opts: { step: string; progress?: number; message?: string }) => void;
}

/**
 * HTML-in/HTML-out: ensures at least one internal link per ~200 words in HTML content.
 * Deterministic: inserts <a> tags only; never rewrites body copy via OpenRouter.
 */
export async function ensureLinksEvery200WordsForHtml(
  options: EnsureLinksEvery200WordsForHtmlOptions
): Promise<string> {
  const { htmlContent, wordPressPosts, currentPageUrl, siteUrl, setProgress } = options;
  if (!htmlContent?.trim() || !wordPressPosts?.length) return htmlContent;

  const siteHost = getSiteHost(siteUrl);
  const validUrls = buildValidInternalUrlSet(wordPressPosts, siteHost);
  const normalizedCurrent = currentPageUrl?.replace(/\/+$/, "").toLowerCase() ?? "";
  const allowedForLinking = wordPressPosts.filter((p) => {
    if (!p.link?.trim()) return false;
    const norm = p.link.trim().replace(/\/+$/, "").toLowerCase();
    return norm !== normalizedCurrent && norm + "/" !== normalizedCurrent && normalizedCurrent + "/" !== norm;
  });
  if (!allowedForLinking.length) return htmlContent;

  const chunks = splitHtmlIntoWordChunks(htmlContent, WORDS_PER_LINK_TARGET);
  if (chunks.length === 0) return htmlContent;

  const linksPayload = allowedForLinking.map((p) => ({ title: p.title, link: p.link }));

  const revisedChunks = chunks.map((chunk, i) => {
    const count = countInternalLinksInHtml(chunk, siteHost, validUrls);
    if (count >= 1) return chunk;
    setProgress?.({
      step: "Ensuring links every 200 words",
      message: `Adding internal link to section ${i + 1}/${chunks.length}...`,
    });
    const pick = linksPayload[i % linksPayload.length]!;
    return insertOneInternalLinkIntoHtml(chunk, pick);
  });

  return revisedChunks.join("");
}

export interface EnsureMinimumLinksInHtmlOptions {
  htmlContent: string;
  wordPressPosts: WordPressPost[];
  currentPageUrl?: string;
  siteUrl: string;
  apiKey: string;
  siteId?: string;
  setProgress?: (opts: { step: string; progress?: number; message?: string }) => void;
  minTotalLinks?: number;
}

/**
 * Split HTML into sections by H2 and H3 headings. Each section is from one <h2 or <h3 to the next (or end).
 * First element may be intro (content before any H2/H3). Used to ensure at least one link per heading.
 */
function splitHtmlByHeadingSections(html: string): string[] {
  const trimmed = html.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/(?=<h[23]\b)/i);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Ensures the HTML content has at least minTotalLinks internal links (default MIN_LINKS_PER_POST),
 * at least 1 per 200 words, and at least one link per H2 and per H3 section. Only uses URLs not already in the content (each link once).
 * Adds links via AI until target is met or we run out of unique link targets.
 */
export async function ensureMinimumLinksInHtml(
  options: EnsureMinimumLinksInHtmlOptions
): Promise<string> {
  const {
    htmlContent,
    wordPressPosts,
    currentPageUrl,
    siteUrl,
    apiKey,
    siteId,
    setProgress,
    minTotalLinks = MIN_LINKS_PER_POST,
  } = options;

  if (!htmlContent?.trim() || !wordPressPosts?.length) return htmlContent;

  const siteHost = getSiteHost(siteUrl);
  const validUrls = buildValidInternalUrlSet(wordPressPosts, siteHost);
  const normalizedCurrent = currentPageUrl?.replace(/\/+$/, "").toLowerCase() ?? "";
  const allowedForLinking = wordPressPosts.filter((p) => {
    if (!p.link?.trim()) return false;
    const norm = p.link.trim().replace(/\/+$/, "").toLowerCase();
    return norm !== normalizedCurrent && norm + "/" !== normalizedCurrent && normalizedCurrent + "/" !== norm;
  });
  if (!allowedForLinking.length) return htmlContent;

  const wordCount = htmlContent.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const h2Count = (htmlContent.match(/<h2\b/gi) || []).length;
  const h3Count = (htmlContent.match(/<h3\b/gi) || []).length;
  const headingCount = Math.max(h2Count + h3Count, 1);
  // Target must include every validated link: use all links that passed validation in the final content.
  const target = Math.max(
    minTotalLinks,
    Math.ceil(wordCount / WORDS_PER_LINK_TARGET),
    headingCount,
  );

  let currentHtml = htmlContent;
  let usedUrls = new Set(extractInternalLinksFromContent(currentHtml, siteUrl));

  const normPostLink = (link: string): string => {
    try {
      const base = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
      const u = new URL(link.startsWith("http") ? link : link.startsWith("/") ? `${new URL(base).origin}${link}` : `${base}/${link}`, base);
      return u.href.toLowerCase().replace(/\/+$/, "");
    } catch {
      return link.trim().toLowerCase().replace(/\/+$/, "");
    }
  };

  // First pass: ensure every H2/H3 section has at least one link.
  const headingSections = splitHtmlByHeadingSections(currentHtml);
  const sectionsNeedingLink: number[] = [];
  for (let i = 0; i < headingSections.length; i++) {
    const section = headingSections[i];
    const isHeadingBlock = /^<h[23]\b/i.test(section);
    const count = countInternalLinksInHtml(section, siteHost, validUrls);
    if (isHeadingBlock && count < 1) sectionsNeedingLink.push(i);
  }
  const linkPool = allowedForLinking.map((p) => ({ title: p.title, link: p.link }));
  const assignCount = Math.min(sectionsNeedingLink.length, linkPool.length);
  for (let j = 0; j < assignCount; j++) {
    const sectionIndex = sectionsNeedingLink[j]!;
    const section = headingSections[sectionIndex]!;
    setProgress?.({
      step: "Ensuring minimum links",
      message: `Adding link ${j + 1}/${target}...`,
    });
    const revised = insertOneInternalLinkIntoHtml(section, linkPool[j]!);
    headingSections[sectionIndex] = revised;
    currentHtml = headingSections.join("");
    usedUrls = new Set(extractInternalLinksFromContent(currentHtml, siteUrl));
  }

  if (usedUrls.size >= target) return currentHtml;

  // Second pass: top up to target (word-based chunks)
  const maxTopUpAttempts = Math.max(target - usedUrls.size, 1) + 5;
  let topUpAttempts = 0;
  while (usedUrls.size < target && topUpAttempts < maxTopUpAttempts) {
    topUpAttempts += 1;
    const sizeBefore = usedUrls.size;
    const unusedPayload = allowedForLinking
      .filter((p) => !usedUrls.has(normPostLink(p.link)))
      .map((p) => ({ title: p.title, link: p.link }));
    if (unusedPayload.length === 0) break;

    const chunks = splitHtmlIntoWordChunks(currentHtml, WORDS_PER_LINK_TARGET);
    if (chunks.length === 0) break;

    const chunkCounts = chunks.map((chunk, i) => ({
      i,
      chunk,
      count: countInternalLinksInHtml(chunk, siteHost, validUrls),
    }));
    chunkCounts.sort((a, b) => a.count - b.count);
    const { i: idx, chunk } = chunkCounts[0]!;

    setProgress?.({
      step: "Ensuring minimum links",
      message: `Adding link ${usedUrls.size + 1}/${target}...`,
    });

    const revisedChunk = insertOneInternalLinkIntoHtml(chunk, unusedPayload[0]!);
    const newChunks = [...chunks];
    newChunks[idx] = revisedChunk;
    currentHtml = newChunks.join("");
    usedUrls = new Set(extractInternalLinksFromContent(currentHtml, siteUrl));
    if (usedUrls.size <= sizeBefore) break;
  }

  return currentHtml;
}

/**
 * Ensures every H2 section has at least one internal link. Sections with 0 links get one added deterministically.
 * Returns updated markdown. Does not mutate input.
 */
export async function ensureAtLeastOneLinkPerSection(
  options: EnsureLinksPerSectionOptions
): Promise<string> {
  const {
    markdown,
    wordPressPosts,
    currentPageUrl,
    siteUrl,
    setProgress,
  } = options;

  if (!markdown?.trim() || !wordPressPosts?.length) return markdown;

  const siteHost = getSiteHost(siteUrl);
  const validUrls = buildValidInternalUrlSet(wordPressPosts, siteHost);
  const normalizedCurrent = currentPageUrl?.replace(/\/+$/, "").toLowerCase() ?? "";
  const allowedForLinking = wordPressPosts.filter((p) => {
    if (!p.link?.trim()) return false;
    const norm = p.link.trim().replace(/\/+$/, "").toLowerCase();
    return norm !== normalizedCurrent && norm + "/" !== normalizedCurrent && normalizedCurrent + "/" !== norm;
  });
  if (!allowedForLinking.length) return markdown;

  const parts = markdown.split(/^##\s+/m);
  if (parts.length <= 1) return markdown;

  const linksPayload = allowedForLinking.map((p) => ({ title: p.title, link: p.link }));

  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i];
    if (!raw.trim()) continue;
    const count = countInternalLinksInSection(raw, siteHost, validUrls);
    if (count >= 1) continue;

    setProgress?.({
      step: "Ensuring links per section",
      message: `Adding internal link to section ${i + 1}/${parts.length}...`,
    });

    const pick = linksPayload[i % linksPayload.length]!;
    parts[i] = insertOneInternalLinkIntoMarkdown(raw, pick);
  }

  const intro = parts[0];
  const rest = parts.slice(1).map((p) => `## ${p}`);
  return intro + rest.join("");
}
