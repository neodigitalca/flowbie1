import { durableWorkflowOutputFileRefs } from "@/lib/workflow/workflow-step-file-refs";
import { saveWorkflowStepOutput } from "@/lib/workflow/workflow-api";
import { workflowClientVariableSuffix } from "@/lib/workflow/workflow-client-config";
import {
  clientDeliverableOutputs,
  effectiveClientSiteIds,
} from "@/lib/workflow/workflow-rag-client";
import type {
  WorkflowNode,
  WorkflowRagArchiveDeliverableScope,
  WorkflowRagArchiveConfig,
  WorkflowStepOutput,
  WorkflowStepOutputFileRef,
} from "@/lib/workflow/workflow-types";

function isGscFinalReportFile(ref: WorkflowStepOutputFileRef): boolean {
  const name = ref.name.toLowerCase();
  return name.startsWith("gsc-report-") && name.endsWith(".md");
}

function isSerpResearchBriefFile(ref: WorkflowStepOutputFileRef): boolean {
  const name = ref.name.toLowerCase();
  return name.includes("serp-research-brief") || name.includes("seo_research_brief");
}

function isDfsArticleAuditFile(ref: WorkflowStepOutputFileRef): boolean {
  return ref.name.toLowerCase().includes("dfs-article-audit");
}

function pickSinglePrimaryDeliverable(
  fileRefs: WorkflowStepOutputFileRef[],
  siteName?: string,
): WorkflowStepOutputFileRef[] {
  if (fileRefs.length === 0) return [];

  const gscReports = fileRefs.filter(isGscFinalReportFile);
  if (gscReports.length > 0) {
    const slug = siteName?.trim() ? siteNameSlug(siteName) : "";
    if (slug) {
      const matched = gscReports.find((file) => file.name.toLowerCase().includes(slug));
      if (matched) return [matched];
    }
    if (gscReports.length === 1) return [gscReports[0]!];
    return [];
  }

  const markdown = fileRefs.filter(
    (file) => file.mime === "text/markdown" || file.name.toLowerCase().endsWith(".md"),
  );
  if (markdown.length === 1) return markdown;
  if (markdown.length > 1) {
    const report = markdown.find((file) => file.name.toLowerCase().includes("report"));
    return [report ?? markdown[0]!];
  }

  const csv = fileRefs.filter(
    (file) => file.mime === "text/csv" || file.name.toLowerCase().endsWith(".csv"),
  );
  if (csv.length === 1) return csv;
  if (csv.length > 0) return [csv[0]!];

  return [fileRefs[0]!];
}

function siteNameSlug(siteName: string): string {
  return siteName.replace(/\s+/g, "-").replace(/[^\w-]/g, "").toLowerCase();
}

export function filterWorkflowArchiveFileRefs(
  fileRefs: WorkflowStepOutputFileRef[] | undefined,
  scope: WorkflowRagArchiveDeliverableScope,
  siteName?: string,
): WorkflowStepOutputFileRef[] {
  const durable = durableWorkflowOutputFileRefs(fileRefs);
  if (scope === "all") return durable;
  if (durable.length === 0) return [];

  const serpBriefs = durable.filter(isSerpResearchBriefFile);
  const dfsAudits = durable.filter(isDfsArticleAuditFile);
  const withoutSecondary = durable.filter(
    (file) => !isSerpResearchBriefFile(file) && !isDfsArticleAuditFile(file),
  );
  const primary = pickSinglePrimaryDeliverable(withoutSecondary, siteName);
  return dedupeWorkflowFileRefs([...primary, ...serpBriefs, ...dfsAudits]);
}

export function resolveArchiveSourceOutput(
  outputs: WorkflowStepOutput[],
  sourceVariableKey: string,
): WorkflowStepOutput | undefined {
  const key = sourceVariableKey.trim();
  if (!key) return undefined;
  return [...outputs].reverse().find((output) => output.variableKey === key);
}

export function workflowRagArchiveNodeIds(nodes: WorkflowNode[]): Set<string> {
  return new Set(nodes.filter((node) => node.kind === "rag_archive").map((node) => node.id));
}

export function actionAgentNodeIds(nodes: WorkflowNode[]): Set<string> {
  return new Set(nodes.filter((node) => node.kind === "action_agent").map((node) => node.id));
}

function dedupeWorkflowFileRefs(
  fileRefs: WorkflowStepOutputFileRef[],
): WorkflowStepOutputFileRef[] {
  const seen = new Set<string>();
  const out: WorkflowStepOutputFileRef[] = [];
  for (const ref of fileRefs) {
    const key = `${ref.url?.trim() || ""}|${ref.name.trim()}`;
    if (!ref.name.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

/** Collect durable deliverables from every completed action_agent step in the run. */
export function mergeWorkflowDeliverableFileRefs(
  outputs: WorkflowStepOutput[],
  nodes: WorkflowNode[],
  extraFileRefs: WorkflowStepOutputFileRef[] = [],
): WorkflowStepOutputFileRef[] {
  const agentNodeIds = actionAgentNodeIds(nodes);
  const merged: WorkflowStepOutputFileRef[] = [...extraFileRefs];
  for (const output of outputs) {
    if (!agentNodeIds.has(output.nodeId)) continue;
    merged.push(...durableWorkflowOutputFileRefs(output.fileRefs));
  }
  return dedupeWorkflowFileRefs(merged);
}

/** Merge action-agent deliverables, prior archive saves, and new file refs for incremental commits. */
export function accumulateWorkflowArchiveFileRefs(
  outputs: WorkflowStepOutput[],
  nodes: WorkflowNode[],
  extraFileRefs: WorkflowStepOutputFileRef[] = [],
  siteId?: string,
  clientSiteIds?: string[],
): WorkflowStepOutputFileRef[] {
  const effectiveClientIds = clientSiteIds ?? [];
  const allSiteIds = effectiveClientSiteIds(outputs, effectiveClientIds);
  const scopedOutputs =
    siteId?.trim() && allSiteIds.length > 1
      ? clientDeliverableOutputs(outputs, nodes, siteId, allSiteIds)
      : outputs;
  const archiveNodeIds = workflowRagArchiveNodeIds(nodes);
  const existingArchiveRefs = scopedOutputs
    .filter((output) => archiveNodeIds.has(output.nodeId))
    .flatMap((output) => durableWorkflowOutputFileRefs(output.fileRefs));
  return mergeWorkflowDeliverableFileRefs(scopedOutputs, nodes, [
    ...existingArchiveRefs,
    ...extraFileRefs,
  ]);
}

export async function syncWorkflowRunArchiveDeliverables(args: {
  teamId: number;
  workflowId: number;
  workflowRunId: number;
  nodes: WorkflowNode[];
  outputs: WorkflowStepOutput[];
  agentRunId?: number;
  textPreview?: string;
  extraFileRefs?: WorkflowStepOutputFileRef[];
  siteId?: string;
  clientSiteIds?: string[];
  siteName?: string;
}): Promise<WorkflowStepOutput | null> {
  const archiveNode = args.nodes.find((node) => node.kind === "rag_archive");
  if (!archiveNode) return null;
  const config = (archiveNode.config ?? {}) as WorkflowRagArchiveConfig;
  const clientSiteIds = args.clientSiteIds ?? [];
  const siteId = args.siteId?.trim();
  const allSiteIds = effectiveClientSiteIds(args.outputs, clientSiteIds);
  const merged = accumulateWorkflowArchiveFileRefs(
    args.outputs,
    args.nodes,
    args.extraFileRefs ?? [],
    siteId,
    allSiteIds.length > 1 ? allSiteIds : clientSiteIds,
  );
  const fileRefs = filterWorkflowArchiveFileRefs(
    merged,
    config.deliverableScope ?? "final",
    args.siteName,
  );
  if (fileRefs.length === 0) return null;

  const baseKey = config.variableKey ?? "workflow_output";
  const variableKey =
    siteId && allSiteIds.length > 1
      ? `${baseKey}${workflowClientVariableSuffix(allSiteIds, siteId)}`
      : baseKey;

  const saved = await saveWorkflowStepOutput(args.teamId, args.workflowId, args.workflowRunId, {
    nodeId: archiveNode.id,
    variableKey,
    scope: config.scope ?? "run",
    label: config.label ?? archiveNode.label ?? "Archive",
    textPreview: args.textPreview ?? `${fileRefs.length} deliverable${fileRefs.length === 1 ? "" : "s"}`,
    agentRunId: args.agentRunId,
    fileRefs,
    siteId: siteId || undefined,
  });
  return saved.ok ? saved.output ?? null : null;
}

export function workflowRunArchiveOutputs(
  outputs: WorkflowStepOutput[],
  nodes: WorkflowNode[],
  siteId?: string,
  clientSiteIds?: string[],
): WorkflowStepOutput[] {
  const archiveNodeIds = workflowRagArchiveNodeIds(nodes);
  if (archiveNodeIds.size === 0) return outputs;
  let archived = outputs.filter((output) => archiveNodeIds.has(output.nodeId));
  if (siteId && clientSiteIds && clientSiteIds.length > 1) {
    archived = clientDeliverableOutputs(outputs, nodes, siteId, clientSiteIds).filter((output) =>
      archiveNodeIds.has(output.nodeId),
    );
  }
  if (archived.length === 0) {
    if (siteId && clientSiteIds && clientSiteIds.length > 1) {
      return clientDeliverableOutputs(outputs, nodes, siteId, clientSiteIds);
    }
    return outputs;
  }
  return [archived[archived.length - 1]!];
}
