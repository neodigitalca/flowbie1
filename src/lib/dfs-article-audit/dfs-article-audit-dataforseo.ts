import {
  clipDataForSeoLlmPrompt,
  DATAFORSEO_LLM_PROMPT_MAX,
  extractLlmAuditPlatformResult,
  type LlmAuditPlatform,
} from "@/lib/llm-audit/llm-audit-dataforseo";
import { dataforseoLlmResponsesLive } from "@/lib/llm-audit/dataforseo-llm-responses-live";
import {
  auditQuestionsForSave,
} from "@/lib/chatgpt-audit-questions";
import {
  DFS_ARTICLE_AUDIT_SCORECARD_CATEGORIES,
} from "@/lib/dfs-article-audit/dfs-article-audit-types";
import type { LlmAuditPlatformBrief } from "@/lib/overview-seo-content-brief";
import type { DfsArticleAuditPlatformResult } from "@/lib/dfs-article-audit/dfs-article-audit-types";

export type DfsArticleAuditPlatform = LlmAuditPlatform;

const DFS_ARTICLE_AUDIT_PLATFORM_CONFIG: Record<
  DfsArticleAuditPlatform,
  {
    label: string;
    model_name: string;
    force_web_search: boolean;
    web_search_country_iso_code: boolean;
    web_search_city: boolean;
  }
> = {
  chat_gpt: {
    label: "ChatGPT",
    model_name: "o4-mini",
    force_web_search: true,
    web_search_country_iso_code: true,
    web_search_city: true,
  },
  gemini: {
    label: "Gemini",
    model_name: "gemini-2.5-flash",
    force_web_search: true,
    web_search_country_iso_code: true,
    web_search_city: true,
  },
  perplexity: {
    label: "Perplexity",
    model_name: "sonar-reasoning-pro",
    force_web_search: true,
    web_search_country_iso_code: true,
    web_search_city: true,
  },
};

const SCORECARD_SUMMARY = DFS_ARTICLE_AUDIT_SCORECARD_CATEGORIES.join(", ");

/** Clip ACF seo_research for audit user_prompt (plain text, max 500). */
export function clipSeoResearchBriefForAudit(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const summary = String(parsed.summary ?? parsed.brief ?? parsed.markdown ?? "").trim();
      if (summary) return clipDataForSeoLlmPrompt(summary);
    } catch {
      /* not JSON */
    }
  }
  const plain = trimmed.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return clipDataForSeoLlmPrompt(plain);
}

const ARTICLE_AUDIT_SYSTEM_CORE = `You are an expert content editor grading an existing web article. Use web search to read the live page at the given URL.

Required output (markdown): 10-point scorecard table, letter grade, what it does well, what keeps it from 10, how to make it a 10 (inline checklist only, no PDFs).

Categories: ${SCORECARD_SUMMARY}. Be specific to page content.`;

export function buildDfsArticleAuditSystemMessage(): string {
  return clipDataForSeoLlmPrompt(ARTICLE_AUDIT_SYSTEM_CORE);
}

function buildDfsArticleAuditContextLines(input: {
  auditQuestions?: string[];
  seoResearchBrief?: string;
}): string[] {
  const lines: string[] = [];
  const brief = input.seoResearchBrief?.trim();
  if (brief) lines.push(`SEO research: ${brief}`);
  const questions = auditQuestionsForSave(input.auditQuestions);
  for (const q of questions) lines.push(q);
  if (questions.length === 0) {
    lines.push(
      "Give this article a letter grade on a ten-point scorecard and list concrete edits to reach a perfect ten.",
    );
  }
  return lines;
}

export function buildDfsArticleAuditUserPrompt(input: {
  platform: DfsArticleAuditPlatform;
  platformLabel: string;
  articleUrl: string;
  focusKeyword: string;
  siteName?: string;
  location?: string;
  auditQuestions?: string[];
  seoResearchBrief?: string;
}): string {
  const headerLines = [
    `For ${input.platformLabel}: audit this article.`,
    `URL: ${input.articleUrl.trim()}`,
    `Focus keyword: ${input.focusKeyword.trim()}`,
  ];
  if (input.siteName?.trim()) headerLines.push(`Site: ${input.siteName.trim()}`);
  if (input.location?.trim()) headerLines.push(`Market: ${input.location.trim()}`);
  headerLines.push("Grade on the ten scorecard categories. Use web search to read the live page.");

  const header = headerLines.join("\n");
  const context = buildDfsArticleAuditContextLines(input).join("\n");
  if (!context) return clipDataForSeoLlmPrompt(header);

  const combined = `${header}\n${context}`;
  if (combined.length <= DATAFORSEO_LLM_PROMPT_MAX) return combined;

  const separator = "\n";
  const contextBudget = DATAFORSEO_LLM_PROMPT_MAX - header.length - separator.length;
  if (contextBudget <= 0) return clipDataForSeoLlmPrompt(header);
  return `${header}${separator}${clipDataForSeoLlmPrompt(context, contextBudget)}`;
}

function webSearchCountryIso(location: string): string | undefined {
  const parts = location.split(",").map((p) => p.trim());
  const country = parts[parts.length - 1];
  if (!country) return undefined;
  if (country.length === 2) return country.toUpperCase();
  const map: Record<string, string> = {
    "united states": "US",
    usa: "US",
    canada: "CA",
    "united kingdom": "GB",
    uk: "GB",
    australia: "AU",
  };
  return map[country.toLowerCase()] ?? undefined;
}

function webSearchCity(location: string): string | undefined {
  return location.split(",")[0]?.trim() || undefined;
}

export function buildDfsArticleAuditTask(
  platform: DfsArticleAuditPlatform,
  input: {
    articleUrl: string;
    focusKeyword: string;
    siteName?: string;
    location?: string;
    auditQuestions?: string[];
    seoResearchBrief?: string;
  },
): Record<string, unknown> {
  const cfg = DFS_ARTICLE_AUDIT_PLATFORM_CONFIG[platform];
  const task: Record<string, unknown> = {
    model_name: cfg.model_name,
    user_prompt: buildDfsArticleAuditUserPrompt({
      platform,
      platformLabel: cfg.label,
      articleUrl: input.articleUrl,
      focusKeyword: input.focusKeyword,
      siteName: input.siteName,
      location: input.location,
      auditQuestions: input.auditQuestions,
      seoResearchBrief: input.seoResearchBrief,
    }),
    system_message: buildDfsArticleAuditSystemMessage(),
    web_search: true,
    max_output_tokens: 4096,
  };
  const location = input.location?.trim() || "";
  const iso = webSearchCountryIso(location);
  const city = webSearchCity(location);
  if (cfg.web_search_country_iso_code !== false && iso) {
    task.web_search_country_iso_code = iso;
  }
  if (cfg.web_search_city !== false && city) {
    task.web_search_city = city;
  }
  return task;
}

export async function fetchDfsArticleAuditPlatforms(input: {
  articleUrl: string;
  focusKeyword: string;
  siteName?: string;
  location?: string;
  auditQuestions?: string[];
  seoResearchBrief?: string;
  platforms?: DfsArticleAuditPlatform[];
  onPlatform?: (result: DfsArticleAuditPlatformResult) => void;
}): Promise<DfsArticleAuditPlatformResult[]> {
  const platforms = input.platforms ?? (["chat_gpt", "gemini", "perplexity"] as DfsArticleAuditPlatform[]);
  const results: DfsArticleAuditPlatformResult[] = [];

  for (const platform of platforms) {
    const cfg = DFS_ARTICLE_AUDIT_PLATFORM_CONFIG[platform];
    const task = buildDfsArticleAuditTask(platform, input);
    let result: DfsArticleAuditPlatformResult;
    try {
      const dfsJson = await dataforseoLlmResponsesLive({
        platform,
        model_name: cfg.model_name,
        user_prompt: String(task.user_prompt),
        system_message: String(task.system_message),
        web_search: true,
        web_search_country_iso_code:
          typeof task.web_search_country_iso_code === "string"
            ? task.web_search_country_iso_code
            : undefined,
        web_search_city:
          typeof task.web_search_city === "string" ? task.web_search_city : undefined,
        max_output_tokens: 4096,
      });
      result = extractLlmAuditPlatformResult(platform, cfg.label, cfg.model_name, dfsJson);
    } catch (err) {
      result = {
        platform,
        label: cfg.label,
        model_name: cfg.model_name,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      };
    }
    results.push(result);
    input.onPlatform?.(result);
  }

  return results;
}

export function countOkDfsArticleAuditPlatforms(
  platforms: DfsArticleAuditPlatformResult[],
): number {
  return platforms.filter((p) => p.status === "ok").length;
}

/** Guidance text from ok platform audits for harness / workflow optimize step. */
export function dfsArticleAuditPlatformGuidance(platforms: LlmAuditPlatformBrief[]): string {
  if (!platforms.length) return "";
  const blocks: string[] = [];
  for (const p of platforms) {
    if (p.status !== "ok" || !p.responseText?.trim()) continue;
    blocks.push(`## ${p.label}\n${p.responseText.trim()}`);
  }
  return blocks.join("\n\n");
}

export { DATAFORSEO_LLM_PROMPT_MAX };
