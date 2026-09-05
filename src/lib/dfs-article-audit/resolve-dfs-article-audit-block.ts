import {
  formatDfsArticleAuditHarnessPromptBlock,
  formatDfsArticleAuditHarnessPromptBlockFromText,
} from "@/lib/dfs-article-audit/format-dfs-article-audit-harness";
import { loadWorkflowDfsArticleAudit } from "@/lib/workflow/workflow-dfs-article-audit-cache";
import type { WorkflowStepOutput } from "@/lib/workflow/workflow-types";

export async function resolveDfsArticleAuditBlockForUrl(args: {
  articleUrl: string;
  workflowOutputs?: WorkflowStepOutput[];
  workflowContextBlock?: string;
}): Promise<string> {
  const url = args.articleUrl.trim();
  if (!url) return "";

  if (args.workflowOutputs?.length) {
    const loaded = await loadWorkflowDfsArticleAudit(args.workflowOutputs, url);
    if (loaded?.audit) {
      return formatDfsArticleAuditHarnessPromptBlock(loaded.audit);
    }
  }

  const context = args.workflowContextBlock?.trim() ?? "";
  if (context.includes("--- DFS ARTICLE AUDIT")) {
    return context;
  }
  if (context.includes("DFS ARTICLE AUDIT") || context.includes("dfs-article-audit")) {
    return `\n--- DFS ARTICLE AUDIT (optimization directives) ---\n${context}\n--- END DFS ARTICLE AUDIT ---\n`;
  }
  if (context.startsWith("{")) {
    const cleaned = formatDfsArticleAuditHarnessPromptBlockFromText(context);
    if (cleaned.trim()) return cleaned;
  }

  return "";
}
