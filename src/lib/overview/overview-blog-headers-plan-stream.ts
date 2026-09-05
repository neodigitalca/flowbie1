import { z } from "zod";
import { streamChatCompletion } from "@/lib/api";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { parseAssistantJsonObject } from "@/lib/competitor-research/competitor-report-json-parse";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import {
  appendMasterInstructionsToSystemPrompt,
} from "@/lib/master-instructions-storage";
import {
  buildBlogHeadersPlanSystemPrompt,
  buildBlogHeadersPlanUserExtras,
  isGenericHarnessHeadingTitle,
} from "@/lib/content-optimization/harness-heading-titles";
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

/** Second OpenRouter call when the plan skipped indices (placeholder H2s would stay in HTML). */
async function fillMissingBlogHeadersPlanActions(
  row: BlogHeadersCatalogRow,
  plan: BlogHeadersPlanResult,
  options: BlogHeadersAgentOptions,
): Promise<BlogHeadersPlanResult> {
  const covered = new Set(
    plan.h2Actions.filter((a) => a.action === "optimize").map((a) => a.index),
  );
  const missingIndices: number[] = [];
  for (let i = 0; i < row.existingH2s.length; i++) {
    if (!covered.has(i)) missingIndices.push(i);
  }
  if (!missingIndices.length) return plan;

  const gsc = row.gscPicks;
  const user = JSON.stringify({
    task: "overview_blog_headers_plan_missing_indices",
    url: row.url,
    title: row.title,
    focusKeyword: row.focusKeyword || undefined,
    seoResearchBrief: row.seoResearchBrief || undefined,
    ...buildBlogHeadersPlanUserExtras(row.existingH2s),
    missingIndices,
    existingH2s: row.existingH2s,
    gscHeadingKeywords: gsc?.headingKeywords ?? [],
    mandate: `Output exactly one optimize action per missing index (${missingIndices.join(", ")}). proposedText must differ from existingH2s[index] and must not be a placeholder (Section, Intro, Section N).`,
    outputSchema: {
      h2Actions: [
        {
          action: "optimize",
          index: "0-based index from missingIndices",
          proposedText: "specific SEO topic title",
          rationale: "string",
        },
      ],
    },
  });

  const system = appendMasterInstructionsToSystemPrompt(
    buildBlogHeadersPlanSystemPrompt(),
    options.siteId ?? null,
  );
  const { content } = await callOpenRouterChatCompletion({
    apiKey: options.apiKey,
    model: options.model,
    system,
    user,
    maxTokens: getCompetitorReportMaxOutputTokens(options.model),
    temperature: 0.35,
    responseFormat: { type: "json_object" },
    signal: options.signal,
  });

  const parsed = planResponseSchema.parse(parseAssistantJsonObject(content));
  const merged = [...plan.h2Actions];
  const mergedIndexes = new Set(merged.map((a) => a.index));
  for (const a of parsed.h2Actions) {
    if (!missingIndices.includes(a.index)) continue;
    const proposedText = a.proposedText.trim();
    if (!proposedText || isGenericHarnessHeadingTitle(proposedText)) continue;
    if (mergedIndexes.has(a.index)) continue;
    merged.push({
      action: "optimize",
      index: a.index,
      proposedText,
      rationale: (a.rationale ?? "").trim(),
    });
    mergedIndexes.add(a.index);
  }
  return { ...plan, h2Actions: merged };
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
    ...buildBlogHeadersPlanUserExtras(row.existingH2s),
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

  const system = appendMasterInstructionsToSystemPrompt(
    buildBlogHeadersPlanSystemPrompt(),
    options.siteId ?? null,
  );
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

  const parsedPlan = parsePlanContent(content);
  const filledPlan = await fillMissingBlogHeadersPlanActions(row, parsedPlan, options);

  return clampBlogHeadersPlanToExistingH2s(
    filledPlan,
    row.existingH2s.length,
    row.missingLeadingH2,
  );
}
