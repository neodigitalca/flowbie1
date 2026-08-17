import type { StartAgentRunPayload } from "@/lib/agent-runs-types";
import { taskExecutionKindToRecipe } from "@/lib/agent-runs-types";
import { fetchAgentRun } from "@/lib/agent-runs-api";
import { getAgentRunHostedFiles } from "@/lib/agent-runs/agent-run-hosted-files";
import type { TeamTask } from "@/lib/tasks-types";
import { mergeExecutionPayloadForSave } from "@/lib/post-creator/post-creator-schedule-payload";
import { fetchTaskDetail } from "@/lib/tasks-api";
import {
  ackPendingWorkflowTrigger,
  fetchWorkflow,
  fetchWorkflowRun,
  fetchWorkflowStepOutputs,
  patchWorkflowRun,
  saveWorkflowStepOutput,
} from "@/lib/workflow/workflow-api";
import { buildRunContextBlock, resolveRagInputKeys } from "@/lib/workflow/workflow-rag-utils";
import {
  findClientNode,
  findTriggerNode,
  nodeById,
  outgoingEdges,
} from "@/lib/workflow/workflow-graph-utils";
import { pickPathBranchId } from "@/lib/workflow/workflow-path-evaluator";
import type {
  WorkflowActionConfig,
  WorkflowClientConfig,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowPathRulesConfig,
  WorkflowRun,
  WorkflowStepOutput,
  WorkflowStepOutputFileRef,
} from "@/lib/workflow/workflow-types";

export type WorkflowRunCallbacks = {
  startRun: (
    payload: StartAgentRunPayload,
    options?: { openSidebar?: boolean },
  ) => Promise<{ ok: boolean; run?: { id: number; status: string; result?: Record<string, unknown> }; error?: string }>;
  startRunFromTask?: (
    task: TeamTask,
    options?: { openSidebar?: boolean },
  ) => Promise<{ ok: boolean; run?: { id: number; status: string; result?: Record<string, unknown> }; error?: string }>;
  waitForAgentRun?: (runId: number) => Promise<{ status: string; result?: Record<string, unknown> }>;
};

function actionConfig(node: WorkflowNode): WorkflowActionConfig {
  return (node.config ?? {}) as WorkflowActionConfig;
}

function pathConfig(node: WorkflowNode): WorkflowPathRulesConfig {
  const config = node.config as WorkflowPathRulesConfig;
  return { branches: config?.branches ?? [] };
}

function resolveWorkflowSiteId(workflow: WorkflowDefinition): string | undefined {
  if (workflow.wordpressSiteId?.trim()) return workflow.wordpressSiteId.trim();
  const client = findClientNode(workflow);
  const siteIds = (client?.config as WorkflowClientConfig | undefined)?.siteIds ?? [];
  return siteIds[0]?.trim() || undefined;
}

function stepOutputPreview(
  result: Record<string, unknown> | undefined,
  status: string,
  agentRunId: number,
): string {
  const message = result?.message;
  if (typeof message === "string" && message.trim()) return message.trim();
  if (status === "done") return "Complete";
  return JSON.stringify(result ?? { status, agentRunId }).slice(0, 4000);
}

function stepOutputFileRefs(agentRunId: number): WorkflowStepOutputFileRef[] {
  return getAgentRunHostedFiles(agentRunId).map((file) => ({
    name: file.name,
    url: file.href,
    mime: file.mimeType,
  }));
}

function buildActionPayload(
  workflow: WorkflowDefinition,
  node: WorkflowNode,
  contextBlock: string,
  run: WorkflowRun,
): StartAgentRunPayload | null {
  const config = actionConfig(node);
  const kind = config.executionKind as TaskExecutionKind;
  const recipeKey = taskExecutionKindToRecipe(kind);
  if (!recipeKey) return null;
  const payload: TaskExecutionPayload = {
    ...config.executionPayload,
    workflowContextBlock: contextBlock,
  };
  return {
    teamId: workflow.teamId,
    source: "workflow",
    recipeKey,
    title: config.title ?? node.label,
    context: {
      siteId: resolveWorkflowSiteId(workflow),
      workflowId: workflow.id,
      workflowRunId: run.id,
      workflowNodeId: node.id,
    },
    plan: {
      executionKind: kind,
      executionPayload: payload,
      workflowRunId: run.id,
      workflowNodeId: node.id,
    },
  };
}

function collectContextBlock(outputs: WorkflowStepOutput[], ragInputKeys: string[]): string {
  return buildRunContextBlock(outputs, ragInputKeys);
}

async function walkFromNode(
  workflow: WorkflowDefinition,
  run: WorkflowRun,
  nodeId: string,
  outputs: WorkflowStepOutput[],
  callbacks: WorkflowRunCallbacks,
  visited: Set<string>,
): Promise<{ ok: boolean; error?: string }> {
  if (visited.has(nodeId)) return { ok: true };
  visited.add(nodeId);
  const node = nodeById(workflow.nodes, nodeId);
  if (!node) return { ok: true };

  if (node.kind === "path_rules") {
    const branchId = pickPathBranchId(pathConfig(node).branches, {
      triggerPayload: run.triggerPayload,
      stepOutputs: outputs,
    });
    const edge = outgoingEdges(workflow.edges, nodeId, branchId)[0]
      ?? outgoingEdges(workflow.edges, nodeId, "default")[0]
      ?? outgoingEdges(workflow.edges, nodeId)[0];
    if (!edge) return { ok: true };
    return walkFromNode(workflow, run, edge.target, outputs, callbacks, visited);
  }

  if (node.kind === "action_agent") {
    await patchWorkflowRun(workflow.teamId, workflow.id, run.id, {
      status: "running",
      currentNodeId: node.id,
    });
    const config = actionConfig(node) as WorkflowActionConfig & { compiledTaskId?: number };
    const contextBlock = collectContextBlock(outputs, resolveRagInputKeys(config));
    let started: { ok: boolean; run?: { id: number; status: string; result?: Record<string, unknown> }; error?: string };

    if (config.compiledTaskId && callbacks.startRunFromTask) {
      const detail = await fetchTaskDetail(workflow.teamId, config.compiledTaskId);
      const task = detail.task;
      if (!task) return { ok: false, error: "Compiled task missing" };
      const mergedTask: TeamTask = {
        ...task,
        executionPayload: mergeExecutionPayloadForSave(
          {
            ...task.executionPayload,
            ...config.executionPayload,
            workflowContextBlock: contextBlock,
          },
          task.executionPayload,
        ),
      };
      started = await callbacks.startRunFromTask(mergedTask, { openSidebar: false });
    } else {
      const payload = buildActionPayload(workflow, node, contextBlock, run);
      if (!payload) return { ok: false, error: "Invalid action node" };
      started = await callbacks.startRun(payload, { openSidebar: false });
    }

    if (!started.ok || !started.run) {
      return { ok: false, error: started.error ?? "Agent run failed to start" };
    }
    let result = started.run.result;
    let status = started.run.status;
    if (callbacks.waitForAgentRun && status !== "done" && status !== "failed") {
      const terminal = await callbacks.waitForAgentRun(started.run.id);
      status = terminal.status;
      result = terminal.result;
    }
    const agentRunId = started.run.id;
    const latestRun = await fetchAgentRun(workflow.teamId, agentRunId);
    const resolvedResult = (latestRun?.result ?? result) as Record<string, unknown> | undefined;
    const variableKey = config.ragVariableKey ?? `step_${node.id}`;
    const preview = stepOutputPreview(resolvedResult, status, agentRunId);
    const saved = await saveWorkflowStepOutput(workflow.teamId, workflow.id, run.id, {
      nodeId: node.id,
      variableKey,
      scope: "run",
      label: config.title ?? node.label,
      textPreview: preview,
      agentRunId,
      fileRefs: stepOutputFileRefs(agentRunId),
    });
    if (saved.ok && saved.output) outputs.push(saved.output);
    if (status === "failed") {
      return { ok: false, error: "Agent run failed" };
    }
  }

  if (node.kind === "rag_archive") {
    const config = node.config as { variableKey?: string; scope?: string; label?: string };
    const last = outputs[outputs.length - 1];
    if (last && config.variableKey) {
      await saveWorkflowStepOutput(workflow.teamId, workflow.id, run.id, {
        nodeId: node.id,
        variableKey: config.variableKey,
        scope: "run",
        label: config.label ?? config.variableKey,
        textPreview: last.textPreview,
        fileRefs: last.fileRefs ?? [],
      });
    }
  }

  for (const edge of outgoingEdges(workflow.edges, nodeId)) {
    const next = await walkFromNode(workflow, run, edge.target, outputs, callbacks, visited);
    if (!next.ok) return next;
  }
  return { ok: true };
}

export async function executeWorkflowRun(
  teamId: number,
  workflowId: number,
  runId: number,
  callbacks: WorkflowRunCallbacks,
): Promise<{ ok: boolean; error?: string }> {
  const workflow = await fetchWorkflow(teamId, workflowId);
  if (!workflow) return { ok: false, error: "Workflow not found" };
  const run = await fetchWorkflowRun(teamId, workflowId, runId);
  if (!run) return { ok: false, error: "Run not found" };

  const trigger = findTriggerNode(workflow);
  if (!trigger) return { ok: false, error: "Workflow has no trigger" };

  const existingOutputs = await fetchWorkflowStepOutputs(teamId, workflowId, runId);
  const outputs = [...existingOutputs];
  const firstEdge = outgoingEdges(workflow.edges, trigger.id)[0];
  if (!firstEdge) {
    await patchWorkflowRun(teamId, workflowId, runId, { status: "done", currentNodeId: trigger.id });
    return { ok: true };
  }

  await patchWorkflowRun(teamId, workflowId, runId, { status: "running", currentNodeId: trigger.id });
  const result = await walkFromNode(workflow, run, firstEdge.target, outputs, callbacks, new Set());
  await patchWorkflowRun(teamId, workflowId, runId, {
    status: result.ok ? "done" : "failed",
    errorMessage: result.error ?? null,
    currentNodeId: null,
  });
  return result;
}

export async function handlePendingWorkflowDispatch(
  teamId: number,
  workflowId: number,
  runId: number | undefined,
  callbacks: WorkflowRunCallbacks,
): Promise<void> {
  if (!runId) {
    await ackPendingWorkflowTrigger(teamId, workflowId);
    return;
  }
  await executeWorkflowRun(teamId, workflowId, runId, callbacks);
  await ackPendingWorkflowTrigger(teamId, workflowId);
}
