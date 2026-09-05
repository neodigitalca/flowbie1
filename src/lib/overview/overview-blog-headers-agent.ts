import { z } from "zod";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { parseAssistantJsonObject } from "@/lib/competitor-research/competitor-report-json-parse";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import {
  appendMasterInstructionsToSystemPrompt,
  ensureMasterInstructionsInMemory,
} from "@/lib/master-instructions-storage";
import type { BlogHeadersCatalogRow } from "@/lib/overview/overview-blog-headers-catalog";
import { runBlogHeadersPlanStream } from "@/lib/overview/overview-blog-headers-plan-stream";

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

const applyResponseSchema = z.object({
  updatedHtml: z.string(),
  finalH2s: z.array(z.string()),
});

const APPLY_SYSTEM = `You are an expert content SEO editor applying an H2-only plan to WordPress HTML.

STRICT RULES:
- Change ONLY <h2> tags: insert new h2 elements or rewrite h2 inner text per h2Actions.
- Do NOT modify, add, remove, or reorder any other HTML (p, ul, ol, li, a, img, div, etc.).
- Do NOT change paragraph text, list items, or links.
- Preserve all attributes on non-h2 elements exactly.
- Return full updatedHtml with all original markup plus H2 changes only.
- finalH2s: ordered list of all H2 inner texts in the updated document.
- Return ONLY valid JSON matching outputSchema (no markdown fences).`;

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
  return runBlogHeadersPlanStream(row, options, () => {});
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
