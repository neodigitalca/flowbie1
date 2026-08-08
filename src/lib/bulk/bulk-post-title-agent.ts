import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { stripTitleSeparatorSuffix } from "@/lib/content-generation/content-sanitizer";
import { parseJsonWithRepair } from "@/lib/json-repair-utility";
import { getProductionModel } from "@/lib/optimization-settings-storage";
import { BULK_WORDPRESS_POST_TITLE_RULE } from "@/lib/prompt-builders/system-user";
import { buildKeywordPunctuationPromptBlock } from "@/lib/prompt-builders/keyword-canonical-punctuation";

/** When true, bulk publish uses one OpenRouter pass to finalize the WordPress post title. */
export const BULK_AI_TITLE_RETRY = true;

export type BulkPostTitleCandidates = {
  researchSeoTitle?: string;
  csvTitle?: string;
  blueprintTitle?: string;
};

export type BulkPostTitleResult = {
  compliant: boolean;
  wordpress_title: string;
};

const SYSTEM = `You are a WordPress post title editor. Return JSON only.

${BULK_WORDPRESS_POST_TITLE_RULE}

Candidate titles in the user message may be non-compliant (duplicated keywords, colons, topic-then-subtitle). Treat them as intent signals only. Rewrite into one fresh headline with **zero colons**; never concatenate or prefix-merge candidate strings.

If any candidate contains ":", replace it with natural joins ("and", "for", "how to", "what", "why") — never keep the colon.

Return one final wordpress_title that satisfies every rule above.
**CRITICAL**: Never shorten, truncate, or cut off the title mid-word. Return the complete title string.`;

function pickFullTitle(candidates: BulkPostTitleCandidates): string {
  const ordered = [
    candidates.csvTitle,
    candidates.blueprintTitle,
    candidates.researchSeoTitle,
  ];
  for (const raw of ordered) {
    const t = stripTitleSeparatorSuffix(typeof raw === "string" ? raw : "").trim();
    if (t) return t;
  }
  return "Untitled";
}

/**
 * Resolves the WordPress post title for bulk publish.
 * Never truncates or mid-word cuts — uploads the full title string.
 */
export async function resolveBulkWordPressPostTitle(args: {
  apiKey: string;
  focusKeyword: string;
  candidates: BulkPostTitleCandidates;
  model?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const preferred = pickFullTitle(args.candidates);
  const kw = args.focusKeyword.trim();

  if (!BULK_AI_TITLE_RETRY || !args.apiKey.trim()) {
    return preferred;
  }

  const candidateLines = [
    args.candidates.researchSeoTitle
      ? `research_seo_title: ${args.candidates.researchSeoTitle.trim()}`
      : null,
    args.candidates.csvTitle ? `csv_title: ${args.candidates.csvTitle.trim()}` : null,
    args.candidates.blueprintTitle
      ? `blueprint_title: ${args.candidates.blueprintTitle.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const user = `PRIMARY KEYWORD (stored ACF phrase): ${kw || "(none)"}
${kw ? buildKeywordPunctuationPromptBlock(kw) : ""}

Candidate titles (intent only; synthesize ONE new complete title; do not truncate; do not cut mid-word):
${candidateLines || "(no candidates)"}

Return JSON: {"compliant":boolean,"wordpress_title":"..."}`;

  try {
    const { content } = await callOpenRouterChatCompletion({
      apiKey: args.apiKey,
      model: args.model?.trim() || getProductionModel(),
      system: SYSTEM,
      user,
      maxTokens: 256,
      temperature: 0.25,
      responseFormat: { type: "json_object" },
      signal: args.signal,
    });

    const { parsed } = parseJsonWithRepair<BulkPostTitleResult>(content, {
      targetKeys: ["compliant", "wordpress_title"],
    });

    const title =
      typeof parsed.wordpress_title === "string" && parsed.wordpress_title.trim()
        ? parsed.wordpress_title.trim()
        : preferred;

    if (parsed.compliant === false) {
      console.info("[Bulk] Post title agent rewrote title for compliance");
    }

    return title;
  } catch (err) {
    console.warn("[Bulk] Post title agent failed (using preferred full title):", err);
    return preferred;
  }
}
