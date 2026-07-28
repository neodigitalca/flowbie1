import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { parseAssistantJsonObject } from "@/lib/competitor-research/competitor-report-json-parse";
import { appendMasterInstructionsToSystemPrompt } from "@/lib/master-instructions-storage";
import {
  availableCandidateKeywordsForIntent,
  keywordCandidatesForAnchor,
  resolveAddKeywordToUrl,
} from "@/lib/overview/overview-blog-links-agent-payload";
import type { BlogLinksCatalogRow } from "@/lib/overview/overview-blog-links-catalog";
import type { BlogLinksAgentOptions } from "@/lib/overview/overview-blog-links-agent";
import { linkPoolHasTargets } from "@/lib/overview/overview-blog-links-catalog";
import { normalizeInternalUrl } from "@/lib/wordpress-api/validate-internal-links";

const LINK_INTENT_MAX_TOKENS = 384;

const REPLACE_SYSTEM = `Each destination URL may appear once in the article.

You remap one existing internal link to a new unique destination.

Never link to sourcePageUrl (this article). availableCandidateKeywords excludes it.

Pick a meaningful, useful destination: related depth for the reader, not filler or tangents.

forbiddenDestinationUrls lists URLs already used in the body plus currentHref — never choose these.

Never use numbered slug clone paths (ending -2, -3, -2-2, etc.). availableCandidateKeywords excludes them.

availableCandidateKeywords is the only allowed source for proposedKeyword. Copy one line exactly.

If availableCandidateKeywords is empty return:
{"proposedKeyword":""}`;

const ADD_SYSTEM = `Each destination URL may appear once in the article.

You add one internal link inside a <p> body paragraph only.

paragraphText is plain text from a single <p> block — not a heading.

NEVER use heading, title, h1, h2, h3, h4, h5, h6, or subheading text for anchorText.

Never link to sourcePageUrl (this article). availableCandidateKeywords excludes it.

Pick a meaningful, useful destination and anchor: related depth for the reader where the phrase naturally fits, not filler.

forbiddenDestinationUrls lists URLs already linked in the body — never choose these.

Never use numbered slug clone paths (ending -2, -3, -2-2, etc.). availableCandidateKeywords excludes them.

availableCandidateKeywords is the only allowed source for proposedKeyword. Copy one line exactly.

anchorText MUST be copied character-for-character from paragraphText.

If availableCandidateKeywords is empty return:
{"proposedKeyword":"","anchorText":""}`;

function readProposedKeyword(raw: Record<string, unknown>): string {
  for (const key of ["proposedKeyword", "keyword", "focusKeyword", "destinationKeyword"]) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function readAnchorText(raw: Record<string, unknown>): string {
  const v = raw.anchorText;
  return typeof v === "string" ? v.trim() : "";
}

function resolveOrKeywordToUrl(
  keyword: string,
  row: BlogLinksCatalogRow,
  siteUrl: string,
): string {
  return resolveAddKeywordToUrl(keyword, row.linkPool, siteUrl);
}

function gscKeywords(row: BlogLinksCatalogRow): string[] {
  return row.gscPicks?.headingKeywords ?? [];
}

function forbiddenUrlsForReplace(
  usedDestinationUrls: string[],
  currentHref: string,
  siteUrl: string,
): string[] {
  const currentNorm = normalizeInternalUrl(siteUrl, currentHref);
  if (!currentNorm || usedDestinationUrls.includes(currentNorm)) return usedDestinationUrls;
  return [...usedDestinationUrls, currentNorm];
}

export type ArticleLinkForIntent = { index: number; anchor: string; href: string };

export async function runBlogLinksReplaceIntent(
  row: BlogLinksCatalogRow,
  linkIndex: number,
  options: BlogLinksAgentOptions,
  usedDestinationUrls: string[],
  articleLinks: ArticleLinkForIntent[],
): Promise<{ proposedKeyword: string; proposedUrl: string } | null> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  const siteUrl = options.siteUrl?.trim() ?? "";
  if (!linkPoolHasTargets(row.linkPool, siteUrl, row.url)) {
    return null;
  }

  const link = articleLinks[linkIndex];
  if (!link) return null;

  const forbiddenDestinationUrls = forbiddenUrlsForReplace(
    usedDestinationUrls,
    link.href,
    siteUrl,
  );
  const availableCandidateKeywords = availableCandidateKeywordsForIntent(
    keywordCandidatesForAnchor(link.anchor, row.linkPool, gscKeywords(row)),
    row.linkPool,
    siteUrl,
    forbiddenDestinationUrls,
    row.url,
  );

  if (!availableCandidateKeywords.trim()) {
    return null;
  }

  const system = appendMasterInstructionsToSystemPrompt(REPLACE_SYSTEM, options.siteId ?? null);
  const user = JSON.stringify({
    forbiddenDestinationUrls,
    sourcePageUrl: row.url,
    articleLinks,
    linkIndex,
    anchor: link.anchor,
    currentHref: link.href,
    sourceFocusKeyword: row.focusKeyword || undefined,
    gscHeadingKeywords: gscKeywords(row),
    availableCandidateKeywords,
  });

  const { content, finishReason } = await callOpenRouterChatCompletion({
    apiKey: options.apiKey,
    model: options.model,
    system,
    user,
    maxTokens: LINK_INTENT_MAX_TOKENS,
    temperature: 0.1,
    responseFormat: { type: "json_object" },
    signal: options.signal,
  });

  if (finishReason === "length") {
    throw new Error(`OpenRouter output hit max_tokens for replace #${linkIndex + 1}`);
  }

  let rawJson: Record<string, unknown>;
  try {
    rawJson = parseAssistantJsonObject(content) as Record<string, unknown>;
  } catch {
    return null;
  }

  const proposedKeyword = readProposedKeyword(rawJson);
  const proposedUrl = proposedKeyword ? resolveOrKeywordToUrl(proposedKeyword, row, siteUrl) : "";
  if (!proposedKeyword || !proposedUrl) return null;
  return { proposedKeyword, proposedUrl };
}

export async function runBlogLinksAddIntent(
  row: BlogLinksCatalogRow,
  paragraphIndex: number,
  paragraphText: string,
  options: BlogLinksAgentOptions,
  usedDestinationUrls: string[],
  articleLinks: ArticleLinkForIntent[],
): Promise<{ proposedKeyword: string; proposedUrl: string; anchorText: string } | null> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  const siteUrl = options.siteUrl?.trim() ?? "";
  if (!linkPoolHasTargets(row.linkPool, siteUrl, row.url)) {
    return null;
  }

  const forbiddenDestinationUrls = usedDestinationUrls;
  const availableCandidateKeywords = availableCandidateKeywordsForIntent(
    keywordCandidatesForAnchor(paragraphText.slice(0, 200), row.linkPool, gscKeywords(row)),
    row.linkPool,
    siteUrl,
    forbiddenDestinationUrls,
    row.url,
  );

  if (!availableCandidateKeywords.trim()) {
    return null;
  }

  const system = appendMasterInstructionsToSystemPrompt(ADD_SYSTEM, options.siteId ?? null);
  const user = JSON.stringify({
    forbiddenDestinationUrls,
    sourcePageUrl: row.url,
    articleLinks,
    paragraphIndex,
    paragraphText,
    sourceFocusKeyword: row.focusKeyword || undefined,
    gscHeadingKeywords: gscKeywords(row),
    availableCandidateKeywords,
  });

  const { content, finishReason } = await callOpenRouterChatCompletion({
    apiKey: options.apiKey,
    model: options.model,
    system,
    user,
    maxTokens: LINK_INTENT_MAX_TOKENS,
    temperature: 0.1,
    responseFormat: { type: "json_object" },
    signal: options.signal,
  });

  if (finishReason === "length") {
    throw new Error(`OpenRouter output hit max_tokens for add at ¶${paragraphIndex + 1}`);
  }

  let rawJson: Record<string, unknown>;
  try {
    rawJson = parseAssistantJsonObject(content) as Record<string, unknown>;
  } catch {
    return null;
  }

  const proposedKeyword = readProposedKeyword(rawJson);
  const anchorText = readAnchorText(rawJson);
  const proposedUrl = proposedKeyword ? resolveOrKeywordToUrl(proposedKeyword, row, siteUrl) : "";
  if (!proposedKeyword || !proposedUrl || !anchorText) return null;
  return { proposedKeyword, proposedUrl, anchorText };
}
