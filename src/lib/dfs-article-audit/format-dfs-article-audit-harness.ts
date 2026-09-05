import type { DfsArticleAuditV1 } from "@/lib/dfs-article-audit/dfs-article-audit-types";
import {
  formatDfsArticleAuditForOpenRouter,
  formatDfsArticleAuditForOpenRouterFromRaw,
} from "@/lib/dfs-article-audit/format-dfs-article-audit-for-openrouter";

export const DFS_ARTICLE_AUDIT_OPTIMIZATION_RULES = `- Treat the audit checklist as optimization directives for existing structure and meta.
- Improve sections, copy, and meta based on gaps; do not add new H2 sections solely to satisfy audit items.
- Do not promise or reference downloadable worksheets, PDFs, or printables unless they already exist on the page.
- Prioritize checklist items that raise the lowest scorecard categories first.`;

export function formatDfsArticleAuditHarnessPromptBlock(audit: DfsArticleAuditV1 | null | undefined): string {
  const platformBody = formatDfsArticleAuditForOpenRouter(audit);
  if (!platformBody.trim()) return "";
  return `
--- DFS ARTICLE AUDIT (optimization directives) ---
Use this audit to improve existing content and meta toward a 10/10. Apply checklist items within the current article structure.

${platformBody}

Rules:
${DFS_ARTICLE_AUDIT_OPTIMIZATION_RULES}
--- END DFS ARTICLE AUDIT ---
`;
}

export function formatDfsArticleAuditHarnessPromptBlockFromText(text: string): string {
  const body = formatDfsArticleAuditForOpenRouterFromRaw(text);
  if (!body) return "";
  return `
--- DFS ARTICLE AUDIT (optimization directives) ---
${body}

Rules:
${DFS_ARTICLE_AUDIT_OPTIMIZATION_RULES}
--- END DFS ARTICLE AUDIT ---
`;
}
