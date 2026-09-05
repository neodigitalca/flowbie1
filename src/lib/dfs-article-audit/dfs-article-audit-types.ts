import { z } from "zod";
import type { LlmAuditPlatform } from "@/lib/llm-audit/llm-audit-dataforseo";
import type { LlmAuditPlatformBrief } from "@/lib/overview-seo-content-brief";

export type DfsArticleAuditPlatform = LlmAuditPlatform;

export const DFS_ARTICLE_AUDIT_ALL_PLATFORMS: DfsArticleAuditPlatform[] = [
  "chat_gpt",
  "gemini",
  "perplexity",
];

export const DFS_ARTICLE_AUDIT_PLATFORM_OPTIONS: ReadonlyArray<{
  value: DfsArticleAuditPlatform;
  label: string;
}> = [
  { value: "chat_gpt", label: "ChatGPT" },
  { value: "gemini", label: "Gemini" },
  { value: "perplexity", label: "Perplexity" },
];

const DFS_ARTICLE_AUDIT_PLATFORM_SET = new Set<string>(DFS_ARTICLE_AUDIT_ALL_PLATFORMS);

/** Normalize saved workflow payload; default all three when unset. */
export function auditPlatformsForSave(raw: unknown): DfsArticleAuditPlatform[] {
  if (!Array.isArray(raw)) return [...DFS_ARTICLE_AUDIT_ALL_PLATFORMS];
  const out: DfsArticleAuditPlatform[] = [];
  for (const item of raw) {
    const platform = String(item ?? "").trim();
    if (!DFS_ARTICLE_AUDIT_PLATFORM_SET.has(platform)) continue;
    const typed = platform as DfsArticleAuditPlatform;
    if (!out.includes(typed)) out.push(typed);
  }
  return out.length > 0 ? out : [...DFS_ARTICLE_AUDIT_ALL_PLATFORMS];
}

/** Platforms explicitly stored on payload for UI (empty array allowed). */
export function auditPlatformsFromPayload(raw: unknown): DfsArticleAuditPlatform[] {
  if (!Array.isArray(raw)) return [...DFS_ARTICLE_AUDIT_ALL_PLATFORMS];
  const out: DfsArticleAuditPlatform[] = [];
  for (const item of raw) {
    const platform = String(item ?? "").trim();
    if (!DFS_ARTICLE_AUDIT_PLATFORM_SET.has(platform)) continue;
    const typed = platform as DfsArticleAuditPlatform;
    if (!out.includes(typed)) out.push(typed);
  }
  return out;
}

/** Resolve platforms for a run; fails when the user cleared every checkbox. */
export function auditPlatformsForRun(raw: unknown): DfsArticleAuditPlatform[] {
  if (!Array.isArray(raw)) return [...DFS_ARTICLE_AUDIT_ALL_PLATFORMS];
  const out = auditPlatformsFromPayload(raw);
  if (out.length === 0) {
    throw new Error("Select at least one LLM platform for the DFS article audit.");
  }
  return out;
}

/** Resolve platforms for a run from contract or plan execution payload. */
export function resolveDfsArticleAuditPlatformsForRun(sources: {
  auditPlatforms?: unknown;
  executionPayload?: { auditPlatforms?: unknown } | null;
}): DfsArticleAuditPlatform[] {
  const raw = sources.auditPlatforms ?? sources.executionPayload?.auditPlatforms;
  return auditPlatformsForRun(raw);
}

export function formatDfsArticleAuditPlatformLabels(platforms: DfsArticleAuditPlatform[]): string {
  const labels = new Map(DFS_ARTICLE_AUDIT_PLATFORM_OPTIONS.map((o) => [o.value, o.label]));
  return platforms.map((p) => labels.get(p) ?? p).join(", ");
}

export const DFS_ARTICLE_AUDIT_SCORECARD_CATEGORIES = [
  "Search intent match",
  "Accuracy and usefulness",
  "Readability",
  "Structure and organization",
  "Originality",
  "E-E-A-T",
  "SEO optimization",
  "Visual support",
  "Conversion without being pushy",
  "Overall quality",
] as const;

export type DfsArticleAuditScorecardCategory = (typeof DFS_ARTICLE_AUDIT_SCORECARD_CATEGORIES)[number];

export type DfsArticleAuditScorecardEntry = {
  category: string;
  score: number;
  maxScore: 10;
};

export type DfsArticleAuditMerged = {
  overallScore: number;
  letterGrade: string;
  scorecard: DfsArticleAuditScorecardEntry[];
  strengths: string[];
  gaps: string[];
  improvements: string[];
  optimizationChecklist: string[];
};

export type DfsArticleAuditV1 = {
  version: 1;
  articleUrl: string;
  focusKeyword: string;
  siteName?: string;
  generatedAt: string;
  platforms: LlmAuditPlatformBrief[];
  merged: DfsArticleAuditMerged | null;
};

export type DfsArticleAuditPlatformResult = LlmAuditPlatformBrief;

const scorecardEntrySchema = z.object({
  category: z.string().min(1),
  score: z.number().min(0).max(10),
  maxScore: z.literal(10).optional(),
});

export const dfsArticleAuditMergedSchema = z.object({
  overallScore: z.number().min(0).max(10),
  letterGrade: z.string().min(1),
  scorecard: z.array(scorecardEntrySchema).min(1),
  strengths: z.array(z.string().min(1)),
  gaps: z.array(z.string().min(1)),
  improvements: z.array(z.string().min(1)),
  optimizationChecklist: z.array(z.string().min(1)),
});

export function normalizeDfsArticleAuditMerged(raw: z.infer<typeof dfsArticleAuditMergedSchema>): DfsArticleAuditMerged {
  return {
    overallScore: raw.overallScore,
    letterGrade: raw.letterGrade.trim(),
    scorecard: raw.scorecard.map((entry) => ({
      category: entry.category.trim(),
      score: entry.score,
      maxScore: 10 as const,
    })),
    strengths: raw.strengths.map((s) => s.trim()).filter(Boolean),
    gaps: raw.gaps.map((s) => s.trim()).filter(Boolean),
    improvements: raw.improvements.map((s) => s.trim()).filter(Boolean),
    optimizationChecklist: raw.optimizationChecklist.map((s) => s.trim()).filter(Boolean),
  };
}

export function dfsArticleAuditUrlSlug(articleUrl: string): string {
  const trimmed = articleUrl.trim();
  if (!trimmed) return "article";
  try {
    const path = new URL(trimmed).pathname.split("/").filter(Boolean);
    const last = path[path.length - 1]?.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");
    if (last) return last.toLowerCase().slice(0, 80);
  } catch {
    /* fall through */
  }
  return trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "article";
}

export function dfsArticleAuditArtifactName(articleUrl: string): string {
  return `dfs-article-audit-${dfsArticleAuditUrlSlug(articleUrl)}.json`;
}

export function serializeDfsArticleAudit(audit: DfsArticleAuditV1): string {
  return JSON.stringify(audit, null, 2);
}

export function parseDfsArticleAuditV1(raw: string | null | undefined): DfsArticleAuditV1 | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as DfsArticleAuditV1;
    if (!parsed || parsed.version !== 1 || !parsed.articleUrl?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function dfsArticleAuditCompletionSummary(audit: DfsArticleAuditV1): string {
  const merged = audit.merged;
  if (merged) {
    return `${merged.letterGrade} (${merged.overallScore}/10)`;
  }
  const okLabels = audit.platforms
    .filter((p) => p.status === "ok" && p.responseText?.trim())
    .map((p) => p.label);
  if (okLabels.length === 0) return "DFS article audit complete";
  return `DFS audit received from ${okLabels.join(", ")}`;
}

const DFS_ARTICLE_AUDIT_PREVIEW_EXCERPT_MAX = 400;

export function dfsArticleAuditTextPreview(audit: DfsArticleAuditV1): string {
  const merged = audit.merged;
  if (!merged) {
    const lines = [
      `URL: ${audit.articleUrl}`,
      `Keyword: ${audit.focusKeyword}`,
      "",
    ];
    for (const p of audit.platforms) {
      if (p.status !== "ok" || !p.responseText?.trim()) continue;
      const excerpt = p.responseText.trim().slice(0, DFS_ARTICLE_AUDIT_PREVIEW_EXCERPT_MAX);
      lines.push(`${p.label}:`, excerpt, "");
    }
    const ok = audit.platforms.filter((p) => p.status === "ok" && p.responseText?.trim()).length;
    if (lines.length <= 3) {
      return `DFS article audit (${ok}/${audit.platforms.length} platforms): ${audit.articleUrl}`;
    }
    return lines.join("\n").trim();
  }
  const lines = [
    `Grade: ${merged.letterGrade} (${merged.overallScore}/10)`,
    `URL: ${audit.articleUrl}`,
    `Keyword: ${audit.focusKeyword}`,
    "",
    "Top gaps:",
    ...merged.gaps.slice(0, 4).map((g) => `- ${g}`),
    "",
    "Optimization checklist:",
    ...merged.optimizationChecklist.slice(0, 8).map((c) => `- ${c}`),
  ];
  return lines.join("\n");
}
