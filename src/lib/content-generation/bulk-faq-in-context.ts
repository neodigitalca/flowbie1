/**
 * Bulk prompt generator: FAQ Q/A pairs grounded in article + SEO research JSON (same intent as
 * Overview optimizeFaq with includeAnswers: true).
 */

import type { WordPressSite } from "@/components/integrations/types";
import { streamChatCompletion } from "@/lib/api";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { parseFaqEntries, type FaqEntry } from "@/lib/faq-entries";

const BODY_MAX = 12000;
const BRIEF_MAX = 24000;

/** Compact NAP/locations string for FAQ prompts (mirrors Overview napSummary role). */
export function buildNapSummaryFromSite(site: WordPressSite): string {
  const parts: string[] = [];
  const nap = site.napInfo;
  if (nap?.name) parts.push(`Business: ${nap.name}`);
  if (nap?.address) parts.push(`Address: ${nap.address}`);
  if (nap?.phone) parts.push(`Phone: ${nap.phone}`);
  if (nap?.email) parts.push(`Email: ${nap.email}`);
  const locs = nap?.locations?.length ? nap.locations : site.locations;
  if (locs?.length) {
    const lines = locs.map((l) =>
      [l.name, l.address, l.city, l.state, l.zip, l.phone].filter(Boolean).join(", ")
    );
    parts.push(`Locations:\n${lines.join("\n")}`);
  }
  return parts.join("\n").trim();
}

/** Same shape as wordpress-uploader for buildFAQSchemaScriptFromEntries. */
export function napLocationsFromSite(site: WordPressSite): Array<{ city: string; state: string }> {
  const raw = site.napInfo?.locations?.length ? site.napInfo.locations : site.locations;
  if (!raw?.length) return [];
  return raw
    .map((l) => ({ city: l.city || "", state: l.state || "" }))
    .filter((l) => l.city || l.state);
}

export interface GenerateBulkFaqEntriesInContextParams {
  markdownContent: string;
  postTitle: string;
  pageMeta: string;
  primaryKeyword: string;
  postUrl: string;
  /** Stringified seo_research object (keyword/Semrush/optimized meta) - primary intent signal when non-empty. */
  seoResearchBrief: string;
  site: WordPressSite;
  apiKey: string;
  siteId?: string | null;
  pairCount?: number;
}

/**
 * Returns up to `pairCount` Q/A entries (default 4). Empty array on failure or empty response.
 */
export async function generateBulkFaqEntriesInContext(
  params: GenerateBulkFaqEntriesInContextParams
): Promise<FaqEntry[]> {
  const pairCount = Math.min(8, Math.max(1, params.pairCount ?? 4));
  const briefTrimmed = params.seoResearchBrief.trim();
  const hasBrief = briefTrimmed.length > 0;
  const dfsForPrompt = hasBrief ? "(none - use JSON SEO content brief below)" : "(none)";

  const napSummary = buildNapSummaryFromSite(params.site);
  const body = params.markdownContent
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BODY_MAX);

  const sharedContext = `
Location & NAP context (use to localize questions and answers, but do NOT restate it verbatim or change its meaning)
${napSummary || "(none)"}

Page intent (derive topic and searcher needs from this; FAQs MUST stay aligned with this intent)
Title: ${params.postTitle || "(none)"}
Meta: ${params.pageMeta || "(none)"}

${
  hasBrief
    ? `JSON SEO content brief (primary - organics, PAA, related, GSC, Semrush; parse intent; do not copy verbatim)
${briefTrimmed.slice(0, BRIEF_MAX)}

`
    : ""
}Supplementary SERP/research slot (if brief above is "(none)", use this; otherwise ignore)
${dfsForPrompt}

Article body (ground answers in this content; reflect its themes, facts, and vocabulary; do not invent unrelated topics)
${body}

URL
${params.postUrl}

Focus keyword (use exactly as shown when relevant)
${params.primaryKeyword.trim() || "(none)"}

Existing FAQ content (if any)
(none)
`;

  const prompt = `You are acting as a senior SEO strategist creating FAQ schema for a specific page.

Output exactly ${pairCount} question-and-answer pairs (no more, no fewer).

Output format (strict - the app parses lines starting with Q: and A:)
- Repeat this block exactly ${pairCount} times:
  Q: <single-line question>
  A: <answer: 2-4 concise sentences. You may continue the answer on following lines until the next "Q:" line - do not start continuation lines with "Q:" or "A:" unless they are a new pair.>
- Each question must be meaningfully different (no duplicate angles).
- Do NOT start more than one question with the same first 3 words.
- Vary question openings (what, how, why, can, do I need, etc.).
- Answers must be helpful and grounded in the article body above; tie specifics to that content where possible.
- Use NAP/service area only to localize; do NOT broaden geography beyond the business area.
- Do NOT mention brand or site name in answers unless the article or brief already does.
- Avoid generic "contact our team" filler unless the article discusses contact or support.
${hasBrief ? `- Use the JSON SEO content brief as the primary signal for intent. Do NOT paste JSON into your output.\n` : ""}
${sharedContext}

Return only Q:/A: blocks as specified - no numbering, no markdown headings, no JSON.`;

  const systemPrompt = hasBrief
    ? "You are an SEO specialist who writes FAQ question-and-answer pairs for schema. Follow the Q:/A: format exactly. Use the JSON SEO content brief as the main signal; localize to the NAP service area without broadening geography."
    : "You are an SEO specialist who writes FAQ question-and-answer pairs for schema. Follow the Q:/A: format exactly. Ground answers in the article body; match searcher intent and the site's local service area.";

  let aiResponse = "";
  try {
    const result = await streamChatCompletion({
      apiKey: params.apiKey,
      model: getResearchModel(params.siteId ?? null),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.55,
      maxTokens: 4500,
      topP: 0.9,
      onContentChunk: (chunk) => {
        aiResponse += chunk;
      },
    });
    if (result.content) aiResponse = result.content;
  } catch (e) {
    console.warn("[Bulk FAQ in-context] OpenRouter failed:", e);
    return [];
  }

  const entries = parseFaqEntries(aiResponse);
  const cleaned = entries
    .filter((e) => e.question.trim())
    .map((e) => ({
      question: e.question.trim(),
      answer: e.answer.trim(),
    }))
    .slice(0, pairCount);

  return cleaned;
}
