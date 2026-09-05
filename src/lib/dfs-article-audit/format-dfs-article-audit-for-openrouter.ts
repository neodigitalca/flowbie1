import { dfsArticleAuditPlatformGuidance } from "@/lib/dfs-article-audit/dfs-article-audit-dataforseo";
import {
  parseDfsArticleAuditV1,
  type DfsArticleAuditMerged,
  type DfsArticleAuditV1,
} from "@/lib/dfs-article-audit/dfs-article-audit-types";

export const DFS_ARTICLE_AUDIT_OPENROUTER_MAX = 12000;

function clipOpenRouterContext(text: string, max = DFS_ARTICLE_AUDIT_OPENROUTER_MAX): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function formatDfsArticleAuditMergedBlock(merged: DfsArticleAuditMerged | null | undefined): string {
  if (!merged) return "";
  const scorecardLines = merged.scorecard
    .map((entry) => `- ${entry.category}: ${entry.score}/10`)
    .join("\n");
  const checklist = merged.optimizationChecklist.map((c) => `- ${c}`).join("\n");
  const strengths = merged.strengths.slice(0, 6).map((s) => `- ${s}`).join("\n");
  const gaps = merged.gaps.slice(0, 6).map((g) => `- ${g}`).join("\n");
  return [
    `Letter grade: ${merged.letterGrade} (${merged.overallScore}/10)`,
    "",
    "Scorecard:",
    scorecardLines,
    "",
    "Strengths:",
    strengths,
    "",
    "Gaps:",
    gaps,
    "",
    "Optimization checklist:",
    checklist,
  ].join("\n");
}

/** Deterministic: DFS audit artifact → compact markdown for OpenRouter optimizer context. */
export function formatDfsArticleAuditForOpenRouter(
  audit: DfsArticleAuditV1 | null | undefined,
): string {
  if (!audit) return "";
  const mergedBody = formatDfsArticleAuditMergedBlock(audit.merged);
  const platformBody = mergedBody.trim() || dfsArticleAuditPlatformGuidance(audit.platforms ?? []);
  return clipOpenRouterContext(platformBody);
}

/** Parse JSON artifact or pass through markdown; never forward raw JSON wrappers to OpenRouter. */
export function formatDfsArticleAuditForOpenRouterFromRaw(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const parsed = parseDfsArticleAuditV1(trimmed);
  if (parsed) return formatDfsArticleAuditForOpenRouter(parsed);

  if (trimmed.startsWith("{") && trimmed.includes('"platforms"')) {
    return "";
  }

  return clipOpenRouterContext(trimmed);
}
