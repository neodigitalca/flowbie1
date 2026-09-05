import {
  dfsArticleAuditArtifactName,
  dfsArticleAuditUrlSlug,
  parseDfsArticleAuditV1,
  type DfsArticleAuditV1,
} from "@/lib/dfs-article-audit/dfs-article-audit-types";
import type { WorkflowStepOutput, WorkflowStepOutputFileRef } from "@/lib/workflow/workflow-types";
import { fetchAppApiText } from "@/lib/proxy-fetch-text";

export { dfsArticleAuditArtifactName, dfsArticleAuditUrlSlug };

function isDfsArticleAuditArtifactName(name: string): boolean {
  return name.toLowerCase().includes("dfs-article-audit");
}

function fileNameMatchesArticleUrl(fileName: string, articleUrl: string): boolean {
  const slug = dfsArticleAuditUrlSlug(articleUrl);
  if (!slug) return false;
  return fileName.toLowerCase().includes(slug);
}

export function collectWorkflowDfsArticleAuditFileRefs(
  outputs: WorkflowStepOutput[],
): WorkflowStepOutputFileRef[] {
  const refs: WorkflowStepOutputFileRef[] = [];
  for (const output of outputs) {
    for (const ref of output.fileRefs ?? []) {
      if (isDfsArticleAuditArtifactName(ref.name)) refs.push(ref);
    }
  }
  return refs;
}

export function findWorkflowDfsArticleAuditFileRef(
  outputs: WorkflowStepOutput[],
  articleUrl: string,
): WorkflowStepOutputFileRef | undefined {
  const url = articleUrl.trim();
  if (!url) return undefined;
  return [...collectWorkflowDfsArticleAuditFileRefs(outputs)]
    .reverse()
    .find((ref) => fileNameMatchesArticleUrl(ref.name, url));
}

export async function loadWorkflowDfsArticleAudit(
  outputs: WorkflowStepOutput[],
  articleUrl: string,
): Promise<{ audit: DfsArticleAuditV1; sourceUrl: string } | null> {
  const ref = findWorkflowDfsArticleAuditFileRef(outputs, articleUrl);
  if (!ref?.url?.trim()) return null;
  try {
    const audit = parseDfsArticleAuditV1(await fetchAppApiText(ref.url));
    if (!audit) return null;
    return { audit, sourceUrl: ref.url };
  } catch {
    return null;
  }
}

export function serializeWorkflowDfsArticleAudit(audit: DfsArticleAuditV1): string {
  return JSON.stringify(audit, null, 2);
}
