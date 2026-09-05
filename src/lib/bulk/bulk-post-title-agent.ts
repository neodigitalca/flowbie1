import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getProductionModel } from "@/lib/optimization-settings-storage";
import { BULK_WORDPRESS_POST_TITLE_RULE } from "@/lib/prompt-builders/title-rules";
import { buildKeywordPunctuationPromptBlock } from "@/lib/prompt-builders/keyword-canonical-punctuation";

export type BulkPostTitleCandidates = {
  researchSeoTitle?: string;
  csvTitle?: string;
  blueprintTitle?: string;
};

const SYSTEM = `You are a WordPress post title editor. Return JSON only: {"wordpress_title":"..."}.

${BULK_WORDPRESS_POST_TITLE_RULE}

The writing keyword in the user message is the topic to write about. It is not the title. Candidate titles are intent signals only. Write one fresh headline. Never concatenate, prefix-merge, or paste the keyword as a block.

If any candidate contains ":", replace it with natural joins ("and", "for", "how to", "what", "why") — never keep the colon.

Return the complete wordpress_title string. Never shorten, truncate, or cut off mid-word.`;

function titleCandidateLine(label: string, value: string | undefined): string | null {
  const t = value?.trim();
  if (!t) return null;
  return `${label}: ${t}`;
}

/** OpenRouter writes the WordPress post title. No CSV, blueprint, or keyword substitute. */
export async function resolveBulkWordPressPostTitle(args: {
  apiKey: string;
  focusKeyword: string;
  candidates: BulkPostTitleCandidates;
  model?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const kw = args.focusKeyword.trim();
  const apiKey = args.apiKey.trim();
  if (!apiKey) {
    throw new Error("Title agent requires an OpenRouter API key");
  }

  const candidateLines = [
    titleCandidateLine("research_seo_title", args.candidates.researchSeoTitle),
    titleCandidateLine("csv_title", args.candidates.csvTitle),
    titleCandidateLine("blueprint_title", args.candidates.blueprintTitle),
  ]
    .filter(Boolean)
    .join("\n");

  const user = `TOPIC KEYWORD (do not paste as the title): ${kw || "(none)"}
${kw ? buildKeywordPunctuationPromptBlock(kw) : ""}

Candidate titles (intent only; write ONE new complete title):
${candidateLines || "(no candidates)"}

Return JSON: {"wordpress_title":"..."}`;

  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model: args.model?.trim() || getProductionModel(),
    system: SYSTEM,
    user,
    maxTokens: 256,
    temperature: 0.25,
    responseFormat: { type: "json_object" },
    signal: args.signal,
  });

  const parsed = JSON.parse(content) as { wordpress_title?: unknown };
  return String(parsed.wordpress_title ?? "").trim();
}
