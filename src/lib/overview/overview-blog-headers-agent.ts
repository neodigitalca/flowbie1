import { z } from "zod";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { parseAssistantJsonObject } from "@/lib/competitor-research/competitor-report-json-parse";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import {
  appendMasterInstructionsToSystemPrompt,
  ensureMasterInstructionsInMemory,
} from "@/lib/master-instructions-storage";
import type { BlogHeadersCatalogRow } from "@/lib/overview/overview-blog-headers-catalog";

export const OVERVIEW_BLOG_HEADERS_MAX_TOKENS = 65_536;

export type BlogHeadersH2Action = {
  action: "optimize" | "add";
  index: number;
  proposedText: string;
  rationale: string;
};

export type BlogHeadersPlanResult = {
  h2Actions: BlogHeadersH2Action[];
  /** SEO H2 inserted before first paragraph when body starts without a leading H2. */
  leadingH2?: string;
};

export type BlogHeadersApplyResult = {
  updatedHtml: string;
  finalH2s: string[];
};

export type BlogHeadersAgentOptions = {
  apiKey: string;
  model: string;
  siteId?: string | null;
  siteUrl?: string;
  signal?: AbortSignal;
};

const h2ActionSchema = z.object({
  action: z.enum(["optimize", "add"]),
  index: z.number(),
  proposedText: z.string(),
  rationale: z.string().optional(),
});

const planResponseSchema = z.object({
  h2Actions: z.array(h2ActionSchema),
});

const applyResponseSchema = z.object({
  updatedHtml: z.string(),
  finalH2s: z.array(z.string()),
});

const PLAN_SYSTEM = `You are an expert content SEO strategist. Analyze blog/page HTML structure and plan H2 headings only.

Rules:
- Output a structured H2 plan: optimize weak existing H2s or add missing H2s where sections lack headings.
- Use focusKeyword and seoResearchBrief for search intent; weave keyword naturally in H2 text when relevant.
- Do not plan changes to paragraphs, lists, links, or body copy.
- For "optimize": index matches existingH2s array (0-based).
- For "add": index is insertion position in final H2 list (0 = before first section, length = after last).
- proposedText: clear, scannable H2 in Title Case; 3-12 words typical.
- Return ONLY valid JSON matching outputSchema (no markdown fences).`;

const APPLY_SYSTEM = `You are an expert content SEO editor applying an H2-only plan to WordPress HTML.

STRICT RULES:
- Change ONLY <h2> tags: insert new h2 elements or rewrite h2 inner text per h2Actions.
- Do NOT modify, add, remove, or reorder any other HTML (p, ul, ol, li, a, img, div, etc.).
- Do NOT change paragraph text, list items, or links.
- Preserve all attributes on non-h2 elements exactly.
- Return full updatedHtml with all original markup plus H2 changes only.
- finalH2s: ordered list of all H2 inner texts in the updated document.
- Return ONLY valid JSON matching outputSchema (no markdown fences).`;

function parsePlanJson(raw: string): BlogHeadersPlanResult {
  const parsed = planResponseSchema.parse(parseAssistantJsonObject(raw));
  return {
    h2Actions: parsed.h2Actions.map((a) => ({
      action: a.action,
      index: a.index,
      proposedText: a.proposedText.trim(),
      rationale: (a.rationale ?? "").trim(),
    })),
  };
}

function parseApplyJson(raw: string): BlogHeadersApplyResult {
  const parsed = applyResponseSchema.parse(parseAssistantJsonObject(raw));
  return {
    updatedHtml: parsed.updatedHtml.trim(),
    finalH2s: parsed.finalH2s.map((h) => h.trim()).filter(Boolean),
  };
}

export async function runBlogHeadersPlan(
  row: BlogHeadersCatalogRow,
  options: BlogHeadersAgentOptions,
): Promise<BlogHeadersPlanResult> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  await ensureMasterInstructionsInMemory(options.siteId ?? null);

  const user = JSON.stringify({
    task: "overview_blog_headers_plan",
    url: row.url,
    title: row.title,
    focusKeyword: row.focusKeyword || undefined,
    seoResearchBrief: row.seoResearchBrief || undefined,
    existingH2s: row.existingH2s,
    htmlCharCount: row.html.length,
    sectionLabels: row.sectionLabels,
    outputSchema: {
      h2Actions: [
        {
          action: "optimize | add",
          index: "number",
          proposedText: "string",
          rationale: "string",
        },
      ],
    },
  });

  const system = appendMasterInstructionsToSystemPrompt(PLAN_SYSTEM, options.siteId ?? null);
  const maxTokens = getCompetitorReportMaxOutputTokens(options.model);
  const { content } = await callOpenRouterChatCompletion({
    apiKey: options.apiKey,
    model: options.model,
    system,
    user,
    maxTokens,
    temperature: 0.3,
    responseFormat: { type: "json_object" },
    signal: options.signal,
  });

  return parsePlanJson(content);
}

export async function runBlogHeadersApply(
  row: BlogHeadersCatalogRow,
  plan: BlogHeadersPlanResult,
  options: BlogHeadersAgentOptions,
): Promise<BlogHeadersApplyResult> {
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  await ensureMasterInstructionsInMemory(options.siteId ?? null);

  const user = JSON.stringify({
    task: "overview_blog_headers_apply",
    url: row.url,
    html: row.html,
    h2Actions: plan.h2Actions,
    outputSchema: {
      updatedHtml: "string full HTML",
      finalH2s: ["string"],
    },
  });

  const system = appendMasterInstructionsToSystemPrompt(APPLY_SYSTEM, options.siteId ?? null);
  const maxTokens = getCompetitorReportMaxOutputTokens(options.model);
  const { content } = await callOpenRouterChatCompletion({
    apiKey: options.apiKey,
    model: options.model,
    system,
    user,
    maxTokens,
    temperature: 0.2,
    responseFormat: { type: "json_object" },
    signal: options.signal,
  });

  return parseApplyJson(content);
}
