/**
 * Agentic links per section: ensure at least one internal link per H2 and H3 section via AI.
 * Used after content generation so no post is uploaded with zero links when linkable posts exist.
 * Also provides word-based guarantee: at least one link every ~200 words.
 * Minimum links = max(10, ceil(words/200), number of H2+H3 headings) - so more links when content has more sections.
 *
 * HTML flow is AI-driven: operates on HTML directly, no manual HTML→Markdown→HTML conversion.
 * Preserves lists, tables, and all structure.
 */

import pLimit from "p-limit";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { streamChatCompletion } from "@/lib/api";
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

  const model = getResearchModel(siteId);
  const linksPayload = allowedForLinking.map((p) => ({ title: p.title, link: p.link }));

  const limit = pLimit(3);
  const revisedChunks = await Promise.all(
    chunks.map((chunk, i) =>
      limit(async () => {
        const count = countInternalLinksInSection(chunk, siteHost, validUrls);
        if (count >= 1) return chunk;
        setProgress?.({
          step: "Ensuring links every 200 words",
          message: `Adding internal link to chunk ${i + 1}/${chunks.length}...`,
        });
        return addOneLinkToSectionViaAI(chunk, linksPayload, apiKey, model);
      })
    )
  );

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
 * AI-driven: operates on HTML only. Splits at block boundaries, sends chunks to AI, gets HTML back.
 * Preserves lists, tables, and all structure.
 */
export async function ensureLinksEvery200WordsForHtml(
  options: EnsureLinksEvery200WordsForHtmlOptions
): Promise<string> {
  const { htmlContent, wordPressPosts, currentPageUrl, siteUrl, apiKey, siteId, setProgress } = options;
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

  const model = getResearchModel(siteId);
  const linksPayload = allowedForLinking.map((p) => ({ title: p.title, link: p.link }));

  const limit = pLimit(3);
  const revisedChunks = await Promise.all(
    chunks.map((chunk, i) =>
      limit(async () => {
        const count = countInternalLinksInHtml(chunk, siteHost, validUrls);
        if (count >= 1) return chunk;
        setProgress?.({
          step: "Ensuring links every 200 words",
          message: `Adding internal link to section ${i + 1}/${chunks.length}...`,
        });
        return addOneLinkToSectionViaAI_HTML(chunk, linksPayload, apiKey, model);
      })
    )
  );

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
    allowedForLinking.length
  );

  let currentHtml = htmlContent;
  let usedUrls = new Set(extractInternalLinksFromContent(currentHtml, siteUrl));

  const model = getResearchModel(siteId);
  const limit = pLimit(2);

  const normPostLink = (link: string): string => {
    try {
      const base = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
      const u = new URL(link.startsWith("http") ? link : link.startsWith("/") ? `${new URL(base).origin}${link}` : `${base}/${link}`, base);
      return u.href.toLowerCase().replace(/\/+$/, "");
    } catch {
      return link.trim().toLowerCase().replace(/\/+$/, "");
    }
  };

  // First pass: ensure every H2/H3 section has at least one link. Pre-assign ONE unique link per section so the AI cannot reuse the same URL.
  const headingSections = splitHtmlByHeadingSections(currentHtml);
  const sectionsNeedingLink: number[] = [];
  for (let i = 0; i < headingSections.length; i++) {
    const section = headingSections[i];
    const isHeadingBlock = /^<h[23]\b/i.test(section);
    const count = countInternalLinksInHtml(section, siteHost, validUrls);
    if (isHeadingBlock && count < 1) sectionsNeedingLink.push(i);
  }
  // Assign one unique link per section (link 0 → first section needing link, etc.). AI gets only that link so it cannot reuse.
  const linkPool = allowedForLinking.map((p) => ({ title: p.title, link: p.link }));
  const assignCount = Math.min(sectionsNeedingLink.length, linkPool.length);
    for (let j = 0; j < assignCount; j++) {
    const sectionIndex = sectionsNeedingLink[j];
    const section = headingSections[sectionIndex];
    const singleLinkPayload = [linkPool[j]];
    setProgress?.({
      step: "Ensuring minimum links",
      message: `Adding link ${j + 1}/${target}...`,
    });
    const revised = await limit(() =>
      addOneLinkToSectionViaAI_HTML(section, singleLinkPayload, apiKey, model)
    );
    headingSections[sectionIndex] = revised;
    currentHtml = headingSections.join("");
    usedUrls = new Set(extractInternalLinksFromContent(currentHtml, siteUrl));
      }

  if (usedUrls.size >= target) return currentHtml;

  // Second pass: top up to target (word-based chunks) when we need more than one-per-heading
  const maxTopUpAttempts = Math.max(target - usedUrls.size, 1) + 5; // cap to avoid infinite loop if AI never adds a detectable link
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
    const { i: idx, chunk } = chunkCounts[0];

    setProgress?.({
      step: "Ensuring minimum links",
      message: `Adding link ${usedUrls.size + 1}/${target}...`,
    });

    const revisedChunk = await limit(() =>
      addOneLinkToSectionViaAI_HTML(chunk, unusedPayload, apiKey, model)
    );
    const newChunks = [...chunks];
    newChunks[idx] = revisedChunk;
    currentHtml = newChunks.join("");
    usedUrls = new Set(extractInternalLinksFromContent(currentHtml, siteUrl));
    // Avoid infinite loop if AI didn't add a link that we can detect (e.g. wrong URL format)
    if (usedUrls.size <= sizeBefore) break;
  }

  return currentHtml;
}

async function addOneLinkToSectionViaAI(
  sectionMarkdown: string,
  allowedLinks: Array<{ title: string; link: string }>,
  apiKey: string,
  model: string
): Promise<string> {
  const linksList = allowedLinks.map((p) => `- URL: ${p.link}\n  Page title (reference only): ${p.title}`).join("\n\n");
  const systemPrompt = `You add exactly one internal link from the allowed list into the given section. Use markdown [anchor](url) with an exact URL from the list. Copy the URL character-for-character - do NOT use example.com or any other domain. Return ONLY the revised section markdown, no explanation or prefix. Preserve all existing content and formatting; only insert one natural sentence or phrase that includes the link.

CRITICAL - HEADING LOCK (SEO extra text): Do not add, remove, or edit <h2> or <h3> tags. Keep exactly one <h2> and one <h3> in the section.

CRITICAL - AEO-OPTIMIZED ANCHOR: Do NOT use the page title as the anchor text. Write the link in context: craft a short, natural phrase (2-6 words) that fits the sentence and the section topic, is relevant to what the linked page is about, and reads naturally for both users and search engines (AEO-friendly).

CRITICAL - EMBED LINK IN MEANINGFUL CONTEXT: Every link must have meaningful sentence content on BOTH sides so readers and LLMs get clear context. NEVER use "here" after the link (no "...guide here" or "learn more here"). Embed the link in the middle of a substantive sentence. Good: "Our guide to dental insurance [explains](url) deductibles and annual maximums in plain language." Bad: "You can review our guide to insurance [here](url)."

CRITICAL - NO LINK ENDS IN A PERIOD: No link may be the last thing before a period. Add at least one word after the link before the period - and that word must NOT be "here". Use substantive wording.`;
  const userPrompt = `Section to revise:\n\n${sectionMarkdown}\n\nAllowed link(s) (use exact URL; write contextual, AEO-optimized anchor text, not the page title):\n${linksList}`;

  let out = "";
  await streamChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 2048,
    topP: 0.9,
    onContentChunk: (chunk) => {
      out += chunk;
    },
  });

  let trimmed = out.trim();
  const codeBlock = trimmed.match(/^```(?:markdown)?\s*\n?([\s\S]*?)\n?```$/);
  if (codeBlock) trimmed = codeBlock[1].trim();
  return trimmed || sectionMarkdown;
}

/**
 * AI adds exactly one internal link to an HTML chunk. Returns HTML with structure preserved.
 * AI receives HTML and must return HTML - no conversion.
 */
async function addOneLinkToSectionViaAI_HTML(
  sectionHtml: string,
  allowedLinks: Array<{ title: string; link: string }>,
  apiKey: string,
  model: string
): Promise<string> {
  const linksList = allowedLinks.map((p) => `- URL: ${p.link}\n  Page title (reference only): ${p.title}`).join("\n\n");
  const oneLinkOnly = allowedLinks.length === 1
    ? " You must use ONLY the single link provided below for this section; do not use any other URL."
    : " Use exactly one link from the list below; each link may only appear once in the entire document.";
  const systemPrompt = `You add exactly one internal link from the allowed list into the given HTML section. Use an <a href="URL">anchor text</a> tag. Copy the URL character-for-character from the list - NEVER use example.com or any other domain.${oneLinkOnly} Return ONLY the revised HTML, no explanation or prefix.

CRITICAL - AEO-OPTIMIZED ANCHOR: Do NOT use the page title as the anchor text. Write the link in context: craft a short, natural phrase (2-6 words) that fits the sentence and the section topic, is relevant to what the linked page is about, and reads naturally for both users and search engines (AEO-friendly). Examples: "our guide to crowns", "restorative crown options", "how to choose a dentist". NEVER use "here" in or after the link (e.g. never "...guide here" or "learn more here"). The anchor must feel like part of the sentence, not a pasted title.

CRITICAL - PRESERVE STRUCTURE: Keep all existing HTML exactly as-is: lists (<ul>, <ol>, <li>), tables (<table>, <tr>, <td>), headings, paragraphs. Only insert one natural phrase or sentence that includes the link. Do NOT convert lists to paragraphs or change any structure.

CRITICAL - HEADINGS: <h2> and <h3> must contain ONLY the heading phrase (3-10 words). NEVER put paragraph text or multiple sentences inside a heading tag. Paragraphs belong in <p> tags. Do NOT wrap body text inside <h2> or <h3>.

CRITICAL - EMBED LINK IN MEANINGFUL CONTEXT: Every link must have meaningful sentence content on BOTH sides so readers and LLMs get clear context for what the link is about. Do NOT use "link → here" or end with "here". Embed the link in the middle of a substantive sentence. Good: "Understanding your coverage helps; our guide to dental insurance explains deductibles and annual maximums in plain language." Bad: "You can review our guide to navigating your dental insurance plan here." or "...dental crown here." The link must sit inside a full phrase with real content before and after the anchor.

CRITICAL - NO LINK ENDS IN A PERIOD: No link may be the last thing before a period. Do not end a sentence with only the link. Do not put a period inside the anchor. Add at least one word after the closing </a> before the period - and that word must NOT be "here". Use substantive wording (e.g. "...our guide to insurance</a> explains your options.").`;
  const userPrompt = `HTML section to revise:\n\n${sectionHtml}\n\nAllowed link(s) (use exact URL; write contextual, AEO-optimized anchor text, not the page title):\n${linksList}`;

  let out = "";
  await streamChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 2048,
    topP: 0.9,
    onContentChunk: (chunk) => {
      out += chunk;
    },
  });

  let trimmed = out.trim();
  const codeBlock = trimmed.match(/^```(?:html)?\s*\n?([\s\S]*?)\n?```$/);
  if (codeBlock) trimmed = codeBlock[1].trim();
  return trimmed || sectionHtml;
}

/**
 * Ensures every H2 section has at least one internal link. Sections with 0 links get one added via AI.
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

  const parts = markdown.split(/^##\s+/m);
  if (parts.length <= 1) return markdown;

  const model = getResearchModel(siteId);
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

    const revised = await addOneLinkToSectionViaAI(raw, linksPayload, apiKey, model);
    parts[i] = revised;
  }

  const intro = parts[0];
  const rest = parts.slice(1).map((p) => `## ${p}`);
  return intro + rest.join("");
}
