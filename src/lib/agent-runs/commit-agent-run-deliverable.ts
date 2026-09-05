import { persistAgentRunArtifact } from "@/lib/agent-runs/agent-run-artifacts";
import type { AgentRun } from "@/lib/agent-runs-types";
import { persistTaskArchiveFiles, type TaskArchiveFileInput } from "@/lib/task-execution-archive";
import { effectiveSaveLocalArchive } from "@/lib/schedule-output-destination";
import { executionKindFromRun } from "@/lib/automation-email-delivery";
import {
  syncWorkflowRunArchiveDeliverables,
} from "@/lib/workflow/workflow-rag-archive";
import type {
  WorkflowDefinition,
  WorkflowStepOutput,
  WorkflowStepOutputFileRef,
} from "@/lib/workflow/workflow-types";
import { fetchWorkflow, fetchWorkflowStepOutputs } from "@/lib/workflow/workflow-api";
import { saveAgentRunDeliverableToWorkflowArchive } from "@/lib/workflow/workflow-step-file-refs";
import { listWorkflowAvailableSiteIds } from "@/lib/workflow/workflow-available-sites";
import { resolveWorkflowClientSiteIds } from "@/lib/workflow/workflow-client-config";
import type { WorkflowClientConfig } from "@/lib/workflow/workflow-types";
import { getStoredSites } from "@/components/integrations/storage";

function readWorkflowBinding(run: AgentRun): {
  workflowId: number;
  workflowRunId: number;
} | null {
  const ctx = run.context ?? {};
  const plan = run.plan ?? {};
  const workflowId = Number(ctx.workflowId ?? plan.workflowId ?? 0);
  const workflowRunId = Number(ctx.workflowRunId ?? plan.workflowRunId ?? 0);
  if (!workflowId || !workflowRunId) return null;
  return { workflowId, workflowRunId };
}

function resolveAgentRunSiteId(run: AgentRun): string | undefined {
  const fromContext = run.context?.siteId?.trim();
  if (fromContext) return fromContext;
  const contract = run.plan?.clientRunContract as { siteId?: string } | undefined;
  const fromContract = contract?.siteId?.trim();
  if (fromContract) return fromContract;
  const payload = run.plan?.executionPayload as { siteId?: string } | undefined;
  return payload?.siteId?.trim() || undefined;
}

function resolveSiteName(siteId: string | undefined): string | undefined {
  if (!siteId?.trim()) return undefined;
  return getStoredSites().find((site) => site.id === siteId)?.name?.trim() || undefined;
}

function resolveWorkflowClientSiteIdsFromWorkflow(workflow: WorkflowDefinition): string[] {
  const clientNode = workflow.nodes.find((node) => node.kind === "workflow_client");
  const config = (clientNode?.config ?? {}) as WorkflowClientConfig;
  return resolveWorkflowClientSiteIds(config, listWorkflowAvailableSiteIds());
}

/** Persist deliverable files to agent artifacts, task archive, and workflow run archive as each completes. */
export async function commitAgentRunDeliverable(args: {
  run: AgentRun;
  stepKey: string;
  stepLabel: string;
  files: TaskArchiveFileInput[];
  textPreview?: string;
  saveLocalArchive?: boolean;
  workflowOutputs?: WorkflowStepOutput[];
  extraFileRefs?: WorkflowStepOutputFileRef[];
  /** When true, workflow output saves replace the prior row for the same variable key. */
  replaceOutput?: boolean;
}): Promise<WorkflowStepOutputFileRef[]> {
  const fileRefs: WorkflowStepOutputFileRef[] = [];

  for (const file of args.files) {
    if (!file.fileName.trim() || !file.content.trim()) continue;
    const artifact = await persistAgentRunArtifact(args.run.teamId, args.run, {
      stepKey: args.stepKey,
      stepLabel: args.stepLabel,
      name: file.fileName,
      mime: file.mime,
      content: file.content,
    });
    if (artifact?.url) {
      fileRefs.push({ name: file.fileName, url: artifact.url, mime: file.mime });
    }
  }

  const kind = executionKindFromRun(args.run);
  const shouldArchive =
    args.saveLocalArchive ??
    effectiveSaveLocalArchive(kind, (args.run.plan ?? {}) as Record<string, unknown>);

  if (shouldArchive && args.run.taskId > 0 && args.files.length > 0) {
    await persistTaskArchiveFiles(args.run.teamId, args.run.taskId, args.files);
  }

  const binding = readWorkflowBinding(args.run);
  if (binding) {
    const workflow = await fetchWorkflow(args.run.teamId, binding.workflowId);
    if (workflow) {
      const outputs =
        args.workflowOutputs ??
        (await fetchWorkflowStepOutputs(
          args.run.teamId,
          binding.workflowId,
          binding.workflowRunId,
        ));
      const extraFileRefs = [...(args.extraFileRefs ?? []), ...fileRefs];
      const siteId = resolveAgentRunSiteId(args.run);
      const clientSiteIds = resolveWorkflowClientSiteIdsFromWorkflow(workflow);
      if (extraFileRefs.length > 0) {
        await syncWorkflowRunArchiveDeliverables({
          teamId: args.run.teamId,
          workflowId: binding.workflowId,
          workflowRunId: binding.workflowRunId,
          nodes: workflow.nodes,
          outputs,
          agentRunId: args.run.id,
          textPreview: args.textPreview ?? args.stepLabel,
          extraFileRefs,
          siteId,
          clientSiteIds,
          siteName: resolveSiteName(siteId),
        });
        await saveAgentRunDeliverableToWorkflowArchive(
          args.run,
          {
            fileRefs: extraFileRefs,
            label: args.stepLabel,
            textPreview: args.textPreview ?? args.stepLabel,
          },
          clientSiteIds,
        );
      }
    }
  }

  return fileRefs;
}
