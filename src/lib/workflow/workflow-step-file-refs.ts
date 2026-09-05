import { fetchAgentRunArtifacts } from "@/lib/agent-runs-api";
import { getAgentRunHostedFiles } from "@/lib/agent-runs/agent-run-hosted-files";
import type { AgentRun } from "@/lib/agent-runs-types";
import { workflowClientVariableSuffix } from "@/lib/workflow/workflow-client-config";
import { saveWorkflowStepOutput } from "@/lib/workflow/workflow-api";
import type { WorkflowStepOutputFileRef } from "@/lib/workflow/workflow-types";

function isDurableUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function isBrowserPreviewArtifact(name: string): boolean {
  return /^browser-preview\.(png|jpe?g|webp)$/i.test(name.trim());
}

function isDeliverableArtifact(input: {
  name: string;
  mime?: string;
  stepKey?: string;
}): boolean {
  const name = input.name.trim();
  if (!name || isBrowserPreviewArtifact(name)) return false;
  if (
    input.stepKey === "grid_export"
    || input.stepKey === "grid_csv_input"
    || input.stepKey === "grid_summary_md"
    || input.stepKey === "entity_wiki_picks"
    || input.stepKey === "entity_hydrated_rows"
    || input.stepKey === "serp_research"
    || input.stepKey?.startsWith("serp_research_")
    || input.stepKey?.startsWith("dfs_article_audit_")
    || input.stepKey === "gsc_reporting"
    || input.stepKey === "gsc-deliverables"
    || input.stepKey === "gscdeliverables"
    || input.stepKey === "entity_bulk_csv"
    || input.stepKey === "browser_capture"
    || input.stepKey === "browser_deliverable"
  ) {
    return true;
  }
  if (input.stepKey === "chatgpt_response" || input.stepKey === "chatgpt_session") return true;
  if (
    input.mime === "text/csv"
    || input.mime === "text/markdown"
    || input.mime === "application/json"
    || input.mime === "image/jpeg"
    || input.mime === "image/png"
  ) {
    return true;
  }
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".csv")
    || lower.endsWith(".md")
    || lower.endsWith(".json")
    || lower.endsWith(".jpg")
    || lower.endsWith(".jpeg")
    || lower.endsWith(".png")
  );
}

export function isWorkflowDeliverableArtifact(input: {
  name: string;
  mime?: string;
  stepKey?: string;
}): boolean {
  return isDeliverableArtifact(input);
}

export async function resolveStepOutputFileRefs(
  teamId: number,
  agentRunId: number,
): Promise<WorkflowStepOutputFileRef[]> {
  const artifacts = await fetchAgentRunArtifacts(teamId, agentRunId);
  const fromArtifacts = artifacts
    .filter((artifact) => artifact.url && isDurableUrl(artifact.url))
    .filter((artifact) => isDeliverableArtifact(artifact))
    .map((artifact) => ({
      name: artifact.name,
      url: artifact.url,
      mime: artifact.mime,
    }));

  if (fromArtifacts.length > 0) return fromArtifacts;

  return getAgentRunHostedFiles(agentRunId)
    .filter((file) => file.mimeType === "text/csv" || file.name.toLowerCase().endsWith(".csv"))
    .map((file) => ({
      name: file.name,
      url: file.href,
      mime: file.mimeType,
    }));
}

export function durableWorkflowOutputFileRefs(
  fileRefs: WorkflowStepOutputFileRef[] | undefined,
): WorkflowStepOutputFileRef[] {
  return (fileRefs ?? []).filter((file) => file.url && isDurableUrl(file.url));
}

function readWorkflowArchiveBinding(
  run: AgentRun,
  clientSiteIds: string[],
): {
  workflowId: number;
  workflowRunId: number;
  workflowNodeId: string;
  variableKey: string;
  siteId?: string;
} | null {
  const ctx = run.context ?? {};
  const plan = run.plan ?? {};
  const workflowId = Number(ctx.workflowId ?? plan.workflowId ?? 0);
  const workflowRunId = Number(ctx.workflowRunId ?? plan.workflowRunId ?? 0);
  const workflowNodeId = String(ctx.workflowNodeId ?? plan.workflowNodeId ?? "").trim();
  if (!workflowId || !workflowRunId || !workflowNodeId) return null;
  const baseKey = String(plan.ragVariableKey ?? `step_${workflowNodeId}`).trim();
  if (!baseKey) return null;
  const siteId = String(ctx.siteId ?? "").trim() || undefined;
  const variableKey =
    siteId && clientSiteIds.length > 1
      ? `${baseKey}${workflowClientVariableSuffix(clientSiteIds, siteId)}`
      : baseKey;
  return { workflowId, workflowRunId, workflowNodeId, variableKey, siteId };
}

export async function saveAgentRunDeliverableToWorkflowArchive(
  run: AgentRun,
  input: {
    fileRefs: WorkflowStepOutputFileRef[];
    label?: string;
    textPreview?: string;
  },
  clientSiteIds: string[] = [],
): Promise<void> {
  const binding = readWorkflowArchiveBinding(run, clientSiteIds);
  if (!binding || input.fileRefs.length === 0) return;
  await saveWorkflowStepOutput(run.teamId, binding.workflowId, binding.workflowRunId, {
    nodeId: binding.workflowNodeId,
    variableKey: binding.variableKey,
    scope: "run",
    label: input.label ?? "Grid export CSV",
    textPreview: input.textPreview ?? "Complete",
    agentRunId: run.id,
    fileRefs: input.fileRefs,
    siteId: binding.siteId,
  });
}

export async function resolveStepOutputFileRefsWithRetry(
  teamId: number,
  agentRunId: number,
  attempts = 4,
  delayMs = 750,
): Promise<WorkflowStepOutputFileRef[]> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const fileRefs = await resolveStepOutputFileRefs(teamId, agentRunId);
    if (fileRefs.length > 0) return fileRefs;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return [];
}
