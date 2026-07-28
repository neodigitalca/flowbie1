import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import {
  appendMasterInstructionsToSystemPrompt,
  ensureMasterInstructionsInMemory,
} from "@/lib/master-instructions-storage";
import type { BlogHeadersCatalogRow } from "@/lib/overview/overview-blog-headers-catalog";
import type { BlogHeadersAgentOptions } from "@/lib/overview/overview-blog-headers-agent";
import { parseBlogHeadersBatchJson } from "@/lib/overview/overview-blog-headers-batch-parse";

export const OVERVIEW_BLOG_HEADERS_BATCH_SIZE = 40;

const BATCH_SYSTEM = `You are an expert content SEO strategist. Plan H2 heading changes for every url in allowedUrls.

Rules:
- Return exactly one result object per allowed url (same url string).
- h2Actions: optimize weak H2s or add missing H2s. Never plan body/paragraph edits.
- optimize: index is 0-based in existingH2s.
- add: index is insertion position in final H2 list.
- proposedText: Title Case, 3-12 words, natural keyword use when relevant.
- rationale: one short sentence max.
- Return ONLY valid JSON matching outputSchema.`;

function catalogRowPayload(row: BlogHeadersCatalogRow) {
  return {
    url: row.url,
    title: row.title,
    focusKeyword: row.focusKeyword || undefined,
    seoResearchBrief: row.seoResearchBrief || undefined,
    existingH2s: row.existingH2s,
    sectionLabels: row.sectionLabels,
  };
}

/** One OpenRouter JSON call per chunk (plan only; full briefs, no output truncation). */
export async function runBlogHeadersBatchPlan(
  catalog: BlogHeadersCatalogRow[],
  options: BlogHeadersAgentOptions,
): Promise<Map<string, import("@/lib/overview/overview-blog-headers-agent").BlogHeadersPlanResult>> {
  if (!catalog.length) return new Map();
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  await ensureMasterInstructionsInMemory(options.siteId ?? null);

  const allowedUrls = catalog.map((c) => c.url);
  const user = JSON.stringify({
    task: "overview_blog_headers_batch_plan",
    requiredCount: catalog.length,
    allowedUrls,
    catalog: catalog.map(catalogRowPayload),
    outputSchema: {
      results: [
        {
          url: "string exact from catalog",
          h2Actions: [
            {
              action: "optimize | add",
              index: "number",
              proposedText: "string",
              rationale: "string optional",
            },
          ],
        },
      ],
    },
  });

  const system = appendMasterInstructionsToSystemPrompt(BATCH_SYSTEM, options.siteId ?? null);
  const maxTokens = getCompetitorReportMaxOutputTokens(options.model);

  const { content, finishReason, nativeFinishReason } = await callOpenRouterChatCompletion({
    apiKey: options.apiKey,
    model: options.model,
    system,
    user,
    maxTokens,
    temperature: 0.25,
    responseFormat: { type: "json_object" },
    signal: options.signal,
  });

  if (finishReason === "length" || nativeFinishReason === "MAX_TOKENS") {
    throw new Error(
      `OpenRouter output hit max_tokens (${maxTokens}) for ${catalog.length} URLs. Reduce selection or use a model with a larger completion window.`,
    );
  }

  try {
    return parseBlogHeadersBatchJson(content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid JSON from OpenRouter";
    throw new Error(`Headers batch plan JSON parse failed: ${msg}`);
  }
}
