import { z } from "zod";
import { streamChatCompletion } from "@/lib/api";
import { parseAssistantJsonObject } from "@/lib/competitor-research/competitor-report-json-parse";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import {
  appendMasterInstructionsToSystemPrompt,
} from "@/lib/master-instructions-storage";
import type { BlogHeadersCatalogRow } from "@/lib/overview/overview-blog-headers-catalog";
import type { BlogHeadersAgentOptions, BlogHeadersPlanResult } from "@/lib/overview/overview-blog-headers-agent";

export function clampBlogHeadersPlanToExistingH2s(
  plan: BlogHeadersPlanResult,
  existingH2Count: number,
  missingLeadingH2 = false,
): BlogHeadersPlanResult {
  return {
    leadingH2: missingLeadingH2 ? plan.leadingH2?.trim() || undefined : undefined,
    h2Actions: plan.h2Actions.filter(
      (a) =>
        a.action === "optimize" &&
        a.index >= 0 &&
        a.index < existingH2Count &&
        a.proposedText.trim().length > 0,
    ),
  };
}

const PLAN_SYSTEM = `You are an expert content SEO strategist. Rewrite blog H2 headings for search intent and clicks.

Rules:
- For every index in existingH2s, output exactly one { action: "optimize", index, proposedText, rationale }.
- proposedText MUST be an SEO rewrite: clearer intent, entities, and keywords. It MUST NOT equal existingH2s[index] (no copy-paste).
- When missingLeadingH2 is true, also set leadingH2: exactly ONE new intro H2 before the first paragraph (must differ from every existingH2s entry). Do not duplicate the post title if it already appears as an H2 in the body.
- When missingLeadingH2 is false, omit leadingH2 entirely.
- Replace existing H2 inner text only. Never insert additional H2 tags beyond the single leadingH2 when flagged.
- Use gscHeadingKeywords, focusKeyword, and seoResearchBrief when planning each rewrite.
- Do not use "add". Do not plan indices outside existingH2s.
- Do not change body copy. Headings only.
- proposedText: Title Case, scannable, 3-14 words.
- rationale: one short sentence.
- Return ONLY valid JSON matching outputSchema (no markdown fences).`;

const planResponseSchema = z.object({
  h2Actions: z.array(
    z.object({
      action: z.enum(["optimize", "add"]),
      index: z.number(),
      proposedText: z.string(),
      rationale: z.string().optional(),
    }),
  ),
  leadingH2: z.string().optional(),
});

function parsePlanContent(content: string): BlogHeadersPlanResult {
  const parsed = planResponseSchema.parse(parseAssistantJsonObject(content));
  return {
    leadingH2: parsed.leadingH2?.trim() || undefined,
    h2Actions: parsed.h2Actions.map((a) => ({
      action: a.action,
      index: a.index,
      proposedText: a.proposedText.trim(),
      rationale: (a.rationale ?? "").trim(),
    })),
  };
}

function buildPlanUserMessage(row: BlogHeadersCatalogRow): string {
  const gsc = row.gscPicks;
  const gscSparse = !gsc?.totalQueries || !gsc.headingKeywords.length;
  return JSON.stringify({
    task: "overview_blog_headers_plan",
    url: row.url,
    title: row.title,
    focusKeyword: row.focusKeyword || undefined,
    seoResearchBrief: row.seoResearchBrief || undefined,
    gscSparse,
    missingLeadingH2: row.missingLeadingH2,
    requiredOptimizeCount: row.existingH2s.length,
    mandate:
      "Rewrite every existingH2s[i] via OpenRouter. One optimize action per index 0..n-1. proposedText must differ from existingH2s[index].",
    gscDateRange: gsc?.dateRange,
    gscTopByClicks: gsc?.byClicks ?? [],
    gscTopByImpressions: gsc?.byImpressions ?? [],
    gscTopByCtr: gsc?.byCtr ?? [],
    gscHeadingKeywords: gsc?.headingKeywords ?? [],
    existingH2s: row.existingH2s,
    htmlCharCount: row.html.length,
    sectionLabels: row.sectionLabels,
    outputSchema: {
      leadingH2: "string when missingLeadingH2 is true",
      h2Actions: [
        {
          action: "optimize",
          index: "0-based index in existingH2s",
          proposedText: "SEO rewrite; must not equal existingH2s[index]",
          rationale: "string",
        },
      ],
    },
  });
}

/** One blog, streaming OpenRouter plan (full output, no truncation). */
export async function runBlogHeadersPlanStream(
  row: BlogHeadersCatalogRow,
  options: BlogHeadersAgentOptions,
  onChunk: (partial: string) => void,
): Promise<BlogHeadersPlanResult> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }

  const system = appendMasterInstructionsToSystemPrompt(PLAN_SYSTEM, options.siteId ?? null);
  const maxTokens = getCompetitorReportMaxOutputTokens(options.model);
  let buf = "";
  let finishReason: string | undefined;

  const result = await streamChatCompletion({
    apiKey: options.apiKey,
    model: options.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: buildPlanUserMessage(row) },
    ],
    temperature: 0.45,
    maxTokens,
    topP: 1,
    signal: options.signal,
    onContentChunk: (chunk) => {
      buf += chunk;
      onChunk(buf);
    },
    onFinishReason: (reason) => {
      finishReason = reason;
    },
  });

  const content = (result.content || buf).trim();
  if (finishReason === "length" || result.finishReason === "length") {
    throw new Error(`OpenRouter output hit max_tokens (${maxTokens}) for ${row.url}`);
  }
  if (!content) {
    throw new Error("Empty plan response from OpenRouter");
  }

  return clampBlogHeadersPlanToExistingH2s(
    parsePlanContent(content),
    row.existingH2s.length,
    row.missingLeadingH2,
  );
}
