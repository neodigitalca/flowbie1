import type { StartAgentRunPayload } from "@/lib/agent-runs-types";
import { isAgentRunTerminal, taskExecutionKindToRecipe, type AgentRun } from "@/lib/agent-runs-types";
import {
  resolveStepOutputFileRefsWithRetry,
} from "@/lib/workflow/workflow-step-file-refs";
import type { TaskExecutionKind, TaskExecutionPayload, TeamTask } from "@/lib/tasks-types";
import { browserAutomationRequiresClient } from "@/lib/browser-automation/resolve-browser-target-url";
import { isClientAgnosticExecutionKind } from "@/lib/agent-runs-types";
import { resolveWorkflowLocalDominatorGridKeyword } from "@/lib/local-dominator/local-dominator-export-keyword";
import { fetchAgentRun } from "@/lib/agent-runs-api";
import { fetchAgentRunDeliverableFiles } from "@/lib/agent-runs-api";
import {
  ackPendingWorkflowTrigger,
  claimPendingWorkflowDispatch,
  fetchWorkflow,
  fetchWorkflowRun,
  fetchWorkflowStepOutputs,
  patchWorkflowRun,
  saveWorkflowStepOutput,
} from "@/lib/workflow/workflow-api";
import { buildRunContextBlock, resolveArchiveOutputForClient, resolveRagInputKeys } from "@/lib/workflow/workflow-rag-utils";
import {
  buildWorkflowWalkClientScope,
  type WorkflowWalkClientScope,
} from "@/lib/workflow/workflow-client-context";
import {
  filterWorkflowArchiveFileRefs,
  mergeWorkflowDeliverableFileRefs,
  syncWorkflowRunArchiveDeliverables,
} from "@/lib/workflow/workflow-rag-archive";
import {
  resolveWorkflowClientSiteIds,
  workflowClientScope,
  workflowClientVariableSuffix,
} from "@/lib/workflow/workflow-client-config";
import { pickPathBranchId } from "@/lib/workflow/workflow-path-evaluator";
import { executeWorkflowThenStep } from "@/lib/workflow/workflow-then-runner";
import {
  finalizeWorkflowBoundAgentRunsOnFailure,
} from "@/lib/workflow/workflow-agent-run-finalize";
import {
  mergeThenStepScheduleIntoPayload,
  stripWorkflowAgentDeliveryPayload,
  thenConfig,
  workflowAgentUsesThenDelivery,
} from "@/lib/workflow/workflow-then-utils";
import {
  applyWorkflowTriggerScheduleToPayload,
} from "@/lib/workflow/workflow-agent-plan";
import { workflowRunThenEmailAlreadySent } from "@/lib/workflow/workflow-then-aggregate";
import {
  awaitThenUpstreamTerminal,
  shouldDeferThenStepForParallelWait,
} from "@/lib/workflow/workflow-then-wait";
import { readWorkflowAgentBinding } from "@/lib/workflow/workflow-agent-binding";
import {
  findClientNode,
  nodeById,
  outgoingEdges,
  resolveWorkflowRunStart,
  resolveWorkflowTestWalkStart,
} from "@/lib/workflow/workflow-graph-utils";
import {
  applyContentGapPostCountToPostCreatorPayload,
  resolveUpstreamContentGapPostCount,
} from "@/lib/workflow/resolve-workflow-content-gap-post-count";
import { fetchTaskDetail } from "@/lib/tasks-api";
import { resolveDfsArticleAuditWorkflowPayload } from "@/lib/workflow/resolve-dfs-article-audit-workflow-payload";
import { ensureChatGptAuditExecutionPayload } from "@/lib/workflow/resolve-chatgpt-audit-workflow-payload";
import { resolveWorkflowActionPayload } from "@/lib/workflow/resolve-workflow-action-payload";
import { applyCsvRowsPayloadForNode } from "@/lib/workflow/apply-csv-rows-payload";
import {
  ensureWorkflowCsvRowsStashForAction,
  executeWorkflowCsvRowsStep,
} from "@/lib/workflow/workflow-csv-rows-runner";
import { peekWorkflowCsvSequential, stashWorkflowCsvSequential } from "@/lib/workflow/workflow-csv-rows-stash";
import { applyUpstreamContextToPostCreatorPayload } from "@/lib/workflow/upstream-research-facts";
import { getStoredSites } from "@/components/integrations/storage";
import { wordpressSiteDisplayName } from "@/lib/wordpress-site-display-name";
import type {
  WorkflowActionConfig,
  WorkflowClientConfig,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowPathRulesConfig,
  WorkflowRagArchiveConfig,
  WorkflowRun,
  WorkflowStepOutput,
} from "@/lib/workflow/workflow-types";
import { isWorkflowThenKind } from "@/lib/workflow/workflow-types";
import { awaitAgentRunTerminal } from "@/lib/workflow/workflow-await-agent-run";
import { isLdGridCsvReceived } from "@/lib/workflow/workflow-ld-continue-watchdog";
import {
  findWorkflowNodeAgentRun,
} from "@/lib/workflow/workflow-node-agent-dedupe";
import {
  completeParallelWorkflowChain,
  registerParallelWorkflowChains,
  clearParallelWorkflowChains,
} from "@/lib/workflow/workflow-parallel-completion";
import { hasIncompleteWorkflowSteps, isContentGapGoalMetFromPreview, workflowNodeHasReadyRunOutput } from "@/lib/workflow/workflow-run-completion";
import { validateWorkflowForRun, workflowHasActionAgent } from "@/lib/workflow/workflow-run-validation";
import { linearExecutableTailNodes } from "@/lib/workflow/workflow-linear-tail";
import { findUpstreamActionAgent, linearOrderedNodes } from "@/lib/workflow/workflow-graph-mutations";
import { filterWorkflowOutputsForSite, clientDeliverableOutputs } from "@/lib/workflow/workflow-rag-client";
import { runAgentMailEmailIntake } from "@/lib/agentmail/agentmail-email-intake";
import { isGridCsvFileRef } from "@/lib/entity-page-creator/resolve-upstream-grid-csv";

export type WorkflowAgentBinding = {
  workflowId: number;
  workflowRunId: number;
  workflowNodeId: string;
  ragVariableKey?: string;
  workflowThenDelivery?: boolean;
};

type WorkflowStartRunResult = {
  ok: boolean;
  run?: { id: number; status: string; result?: Record<string, unknown> };
  error?: string;
};

export type WorkflowRunCallbacks = {
  startRun: (
    payload: StartAgentRunPayload,
    options?: {
      openSidebar?: boolean;
      workflowBinding?: WorkflowAgentBinding;
    },
  ) => Promise<WorkflowStartRunResult>;
  /** Waits for client harness completion. Used for downstream workflow agents after grid export. */
  startRunAndWait?: (
    payload: StartAgentRunPayload,
    options?: {
      openSidebar?: boolean;
      workflowBinding?: WorkflowAgentBinding;
    },
  ) => Promise<WorkflowStartRunResult>;
  startRunFromTask?: (
    task: TeamTask,
    options?: { openSidebar?: boolean; workflowBinding?: WorkflowAgentBinding },
  ) => Promise<WorkflowStartRunResult>;
  startRunFromTaskAndWait?: (
    task: TeamTask,
    options?: { openSidebar?: boolean; workflowBinding?: WorkflowAgentBinding },
  ) => Promise<WorkflowStartRunResult>;
  listAvailableSiteIds?: () => string[] | Promise<string[]>;
  /** Manual workflow Test: show each agent run in the Agents sidebar as it starts. */
  openAgentSidebar?: boolean;
  /** Run through this node, then stop without downstream steps. */
  stopAfterNodeId?: string;
  /** Test: skip Client and Schedule; walk from first actionable step. */
  skipSetupSteps?: boolean;
};

type WalkFromNodeResult = { ok: boolean; error?: string; deferWorkflowCompletion?: boolean };

const workflowDispatchPromises = new Map<string, Promise<{ ok: boolean; error?: string }>>();
const workflowRunsInProgress = new Set<string>();
const workflowStepChainStarted = new Set<string>();

function workflowDispatchKey(teamId: number, workflowId: number, runId: number): string {
  return `${teamId}:${workflowId}:${runId}`;
}

function workflowRunInProgressKey(teamId: number, workflowId: number, runId: number): string {
  return workflowDispatchKey(teamId, workflowId, runId);
}

function markWorkflowRunFinished(teamId: number, workflowId: number, runId: number): void {
  workflowRunsInProgress.delete(workflowRunInProgressKey(teamId, workflowId, runId));
}

function resolveWorkflowResumeNodeId(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">,
  outputs: WorkflowStepOutput[],
  defaultNodeId: string,
): string {
  for (const node of linearOrderedNodes(workflow)) {
    if (node.kind !== "action_agent" && !isWorkflowThenKind(node.kind) && node.kind !== "rag_archive" && node.kind !== "csv_rows") {
      continue;
    }
    if (!workflowNodeHasReadyRunOutput(node, outputs)) return node.id;
  }
  return defaultNodeId;
}

function resolveWorkflowWalkEntryNodeId(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">,
  outputs: WorkflowStepOutput[],
  defaultNodeId: string,
  stopAfterNodeId?: string,
): string {
  if (stopAfterNodeId) {
    const stopNode = workflow.nodes.find((node) => node.id === stopAfterNodeId);
    if (stopNode?.kind === "then_google_drive") {
      return stopAfterNodeId;
    }
  }
  return resolveWorkflowResumeNodeId(workflow, outputs, defaultNodeId);
}

async function walkRemainingLinearSteps(
  workflow: WorkflowDefinition,
  run: WorkflowRun,
  afterNodeId: string,
  outputs: WorkflowStepOutput[],
  callbacks: WorkflowRunCallbacks,
  visited: Set<string>,
  clientScope: WorkflowWalkClientScope,
): Promise<WalkFromNodeResult> {
  for (const tailNode of linearExecutableTailNodes(workflow, afterNodeId)) {
    if (visited.has(tailNode.id)) continue;
    const next = await walkFromNode(
      workflow,
      run,
      tailNode.id,
      outputs,
      callbacks,
      visited,
      clientScope,
    );
    if (!next.ok) return next;
    if (next.deferWorkflowCompletion) return next;
  }
  return { ok: true };
}

async function finishDeferredWorkflowRun(
  teamId: number,
  workflowId: number,
  runId: number,
  patch: { status: "done" | "failed"; errorMessage?: string | null },
): Promise<void> {
  await patchWorkflowRun(teamId, workflowId, runId, {
    status: patch.status,
    errorMessage: patch.errorMessage ?? null,
    currentNodeId: null,
  });
  markWorkflowRunFinished(teamId, workflowId, runId);
  await ackPendingWorkflowTrigger(teamId, workflowId);
}

function workflowStepChainKey(workflowRunId: number, nodeId: string, agentRunId?: number): string {
  if (agentRunId != null && agentRunId > 0) {
    return `${workflowRunId}:${nodeId}:${agentRunId}`;
  }
  return `${workflowRunId}:${nodeId}`;
}

type SiteAgentRunResult = {
  ok: boolean;
  error?: string;
  defer?: boolean;
  goalMet?: boolean;
  siteId?: string;
  stepOutput?: WorkflowStepOutput;
  archiveOutput?: WorkflowStepOutput | null;
};

async function startWorkflowAgentForSite(args: {
  workflow: WorkflowDefinition;
  run: WorkflowRun;
  node: WorkflowNode;
  config: WorkflowActionConfig & { compiledTaskId?: number };
  siteId: string;
  sitesToRun: string[];
  outputs: WorkflowStepOutput[];
  contextBlock: string;
  usesThenDelivery: boolean;
  showAgentInSidebar: boolean;
  callbacks: WorkflowRunCallbacks;
  ignoreExistingAgent?: boolean;
}): Promise<SiteAgentRunResult> {
  const {
    workflow,
    run,
    node,
    config,
    siteId,
    sitesToRun,
    outputs,
    contextBlock,
    usesThenDelivery,
    showAgentInSidebar,
    callbacks,
    ignoreExistingAgent,
  } = args;

  const awaitAgentCompletion = config.executionKind !== "local_dominator_export";

  await ensureWorkflowCsvRowsStashForAction({
    teamId: workflow.teamId,
    workflowRunId: run.id,
    workflow,
    actionNode: node,
    outputs,
  });

  const startRunFn = awaitAgentCompletion
    ? (callbacks.startRunAndWait ?? callbacks.startRun)
    : callbacks.startRun;

  const existingNodeRun = ignoreExistingAgent
    ? null
    : await findWorkflowNodeAgentRun(workflow.teamId, run.id, node.id, siteId);
  if (existingNodeRun) {
    const existingGoalMet =
      config.executionKind === "content_gap_check"
        ? contentGapGoalMetFromAgentResult(existingNodeRun.result)
        : undefined;
    const existingOutput = outputs.find(
      (output) => output.nodeId === node.id && output.agentRunId === existingNodeRun.id,
    );
    if (existingOutput) {
      return {
        ok: true,
        stepOutput: existingOutput,
        goalMet: existingGoalMet,
        siteId,
      };
    }
    // Agent already ran (e.g. bound Then finished) but workflow output was never saved.
    const baseVariableKey = config.ragVariableKey ?? `step_${node.id}`;
    const variableKey = `${baseVariableKey}${workflowClientVariableSuffix(sitesToRun, siteId)}`;
    const preview = stepOutputPreview(
      existingNodeRun.result as Record<string, unknown> | undefined,
      existingNodeRun.status,
      existingNodeRun.id,
    );
    const fileRefs = await resolveStepOutputFileRefsWithRetry(workflow.teamId, existingNodeRun.id);
    // Local Dominator: never persist an empty placeholder; resume treats that as complete.
    if (config.executionKind === "local_dominator_export") {
      const hasCsv = fileRefs.some((file) => Boolean(file.url) && isGridCsvFileRef(file));
      if (!hasCsv) {
        const cleanupRace =
          existingNodeRun.status === "failed"
          && /job not found|already cleaned up/i.test(String(existingNodeRun.errorMessage ?? ""));
        const stillInFlight =
          existingNodeRun.status === "queued" || existingNodeRun.status === "running";
        if (cleanupRace || stillInFlight) {
          return { ok: true, defer: true, siteId };
        }
        return {
          ok: false,
          error:
            existingNodeRun.errorMessage?.trim()
            || "Local Dominator export did not produce a grid CSV.",
          siteId,
        };
      }
    }
    const saved = await saveWorkflowStepOutput(workflow.teamId, workflow.id, run.id, {
      nodeId: node.id,
      variableKey,
      scope: "run",
      label: config.title ?? node.label,
      textPreview:
        config.executionKind === "local_dominator_export" ? "Grid export CSV" : preview,
      agentRunId: existingNodeRun.id,
      fileRefs,
      siteId,
    });
    const ldJobCleanupRace =
      config.executionKind === "local_dominator_export"
      && existingNodeRun.status === "failed"
      && /job not found|already cleaned up/i.test(String(existingNodeRun.errorMessage ?? ""));
    return {
      ok:
        ldJobCleanupRace
        || (existingNodeRun.status !== "failed" && existingNodeRun.status !== "cancelled"),
      error:
        ldJobCleanupRace
          ? undefined
          : existingNodeRun.status === "failed"
            ? existingNodeRun.errorMessage?.trim() || "Agent run failed"
            : existingNodeRun.status === "cancelled"
              ? "Agent run cancelled"
              : undefined,
      stepOutput: saved.ok ? saved.output : undefined,
      goalMet: existingGoalMet,
      siteId,
    };
  }

  if (config.executionKind === "post_creator" && siteId.trim()) {
    const gapCount = resolveUpstreamContentGapPostCount(
      workflow,
      node.id,
      outputs,
      siteId,
      sitesToRun,
    );
    if (gapCount === 0) {
      const baseVariableKey = config.ragVariableKey ?? `step_${node.id}`;
      const variableKey = `${baseVariableKey}${workflowClientVariableSuffix(sitesToRun, siteId)}`;
      const preview = "Skipped: content gap already met (0 posts needed).";
      const saved = await saveWorkflowStepOutput(workflow.teamId, workflow.id, run.id, {
        nodeId: node.id,
        variableKey,
        scope: "run",
        label: config.title ?? node.label,
        textPreview: preview,
        siteId,
      });
      return {
        ok: true,
        siteId,
        stepOutput: saved.ok ? saved.output : undefined,
      };
    }
  }

  const payload = await buildActionPayload(
    workflow,
    node,
    contextBlock,
    run,
    siteId,
    outputs,
    sitesToRun,
  ).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "Workflow action payload failed";
    return { error: message } as const;
  });
  if (!payload || "error" in payload) {
    return { ok: false, error: "error" in payload ? payload.error : "Invalid action node" };
  }

  const workflowBinding = {
    workflowId: workflow.id,
    workflowRunId: run.id,
    workflowNodeId: node.id,
    ragVariableKey: config.ragVariableKey ?? `step_${node.id}`,
    workflowThenDelivery: true,
  };
  const runOptions = {
    openSidebar: showAgentInSidebar,
    workflowBinding,
  };

  let started: WorkflowStartRunResult;
  if (
    config.compiledTaskId
    && config.executionKind === "dfs_llm_article_audit"
    && callbacks.startRunFromTaskAndWait
  ) {
    const detail = await fetchTaskDetail(workflow.teamId, config.compiledTaskId);
    if (!detail.task) {
      return {
        ok: false,
        error: detail.error ?? "Compiled task missing for DFS LLM article audit.",
      };
    }
    let executionPayload: TaskExecutionPayload = applyCsvRowsPayloadForNode(
      run.id,
      node.id,
      { ...(config.executionPayload ?? {}) },
    );
    if (siteId.trim()) {
      const site = getStoredSites().find((item) => item.id === siteId);
      if (site) {
        try {
          executionPayload = await resolveDfsArticleAuditWorkflowPayload(site, executionPayload);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "DFS LLM article audit setup failed";
          return { ok: false, error: message };
        }
      }
    }
    started = await callbacks.startRunFromTaskAndWait(
      {
        ...detail.task,
        wordpressSiteId: siteId || detail.task.wordpressSiteId,
        executionKind: "dfs_llm_article_audit",
        executionPayload,
      },
      runOptions,
    );
  } else {
    started = await startRunFn(payload, runOptions);
  }

  if (!started.ok || !started.run) {
    return { ok: false, error: started.error ?? "Agent run failed to start" };
  }

  let agentRunId = started.run.id;
  let status = started.run.status;
  let resolvedResult = started.run.result as Record<string, unknown> | undefined;
  let terminalRun: AgentRun | null = null;

  if (
    awaitAgentCompletion
    && status !== "cancelled"
    && status !== "failed"
    && status !== "done"
  ) {
    const terminal = await awaitAgentRunTerminal(workflow.teamId, agentRunId);
    if (!terminal) return { ok: false, error: "Agent run missing after wait" };
    terminalRun = terminal;
    agentRunId = terminal.id;
    status = terminal.status;
    resolvedResult = terminal.result as Record<string, unknown> | undefined;
  } else if (awaitAgentCompletion && isAgentRunTerminal(status)) {
    terminalRun = await fetchAgentRun(workflow.teamId, agentRunId);
    if (terminalRun) {
      status = terminalRun.status;
      resolvedResult = terminalRun.result as Record<string, unknown> | undefined;
    }
  }

  if (status === "cancelled") {
    return { ok: false, error: "Agent run cancelled" };
  }
  if (status === "failed") {
    const failedRun = terminalRun ?? (await fetchAgentRun(workflow.teamId, agentRunId));
    const resultMessage =
      typeof resolvedResult?.message === "string" ? resolvedResult.message.trim() : "";
    const message = failedRun?.errorMessage?.trim() || resultMessage || "Agent run failed";
    return { ok: false, error: message };
  }
  // Grid CSV is written later; do not save a step output yet or resume will skip past this node.
  if (config.executionKind === "local_dominator_export") {
    return { ok: true, defer: true };
  }

  const baseVariableKey = config.ragVariableKey ?? `step_${node.id}`;
  const variableKey = `${baseVariableKey}${workflowClientVariableSuffix(sitesToRun, siteId)}`;
  const preview = stepOutputPreview(resolvedResult, status, agentRunId);
  const fileRefs = await resolveStepOutputFileRefsWithRetry(workflow.teamId, agentRunId);
  const saved = await saveWorkflowStepOutput(workflow.teamId, workflow.id, run.id, {
    nodeId: node.id,
    variableKey,
    scope: "run",
    label: config.title ?? node.label,
    textPreview: preview,
    agentRunId,
    fileRefs,
    siteId,
  });

  const stepOutput = saved.ok ? saved.output : undefined;

  const goalMet = contentGapGoalMetFromAgentResult(resolvedResult);
  return {
    ok: true,
    stepOutput,
    siteId,
    goalMet: config.executionKind === "content_gap_check" ? goalMet : undefined,
  };
}

function contentGapGoalMetFromAgentResult(
  result: AgentRun["result"] | Record<string, unknown> | null | undefined,
): boolean {
  if (!result || typeof result !== "object") return false;
  const record = result as Record<string, unknown>;
  if (record.goalMet === true) return true;
  if (typeof record.gapCount === "number" && record.gapCount === 0) return true;
  if (typeof record.message === "string" && isContentGapGoalMetFromPreview(record.message)) {
    return true;
  }
  return false;
}

function actionConfig(node: WorkflowNode): WorkflowActionConfig {
  return (node.config ?? {}) as WorkflowActionConfig;
}

function actionRequiresClient(config: WorkflowActionConfig): boolean {
  if (config.executionKind === "browser_automation") {
    return browserAutomationRequiresClient(config.executionPayload);
  }
  return !isClientAgnosticExecutionKind(config.executionKind);
}

function workflowRequiresClient(workflow: Pick<WorkflowDefinition, "nodes">): boolean {
  return workflow.nodes.some(
    (node) => node.kind === "action_agent" && actionRequiresClient(actionConfig(node)),
  );
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

async function buildActionPayload(
  workflow: WorkflowDefinition,
  node: WorkflowNode,
  contextBlock: string,
  run: WorkflowRun,
  siteId: string | undefined,
  outputs: WorkflowStepOutput[],
  clientSiteIds: string[],
): Promise<StartAgentRunPayload | null> {
  const config = actionConfig(node);
  const kind = config.executionKind as TaskExecutionKind;
  const recipeKey = taskExecutionKindToRecipe(kind);
  if (!recipeKey) return null;
  await ensureWorkflowCsvRowsStashForAction({
    teamId: workflow.teamId,
    workflowRunId: run.id,
    workflow,
    actionNode: node,
    outputs,
  });
  let basePayload: TaskExecutionPayload = {
    ...config.executionPayload,
    workflowContextBlock: contextBlock,
  };
  basePayload = applyWorkflowTriggerScheduleToPayload(workflow, kind, basePayload);
  basePayload = mergeThenStepScheduleIntoPayload(workflow, node.id, basePayload);
  const strippedPayload = stripWorkflowAgentDeliveryPayload(basePayload);

  if (run.triggerKind === "trigger_agentmail" && kind === "post_creator") {
    const messageId = String(run.triggerPayload?.messageId ?? "").trim();
    if (!messageId) {
      throw new Error("Agent Mail trigger is missing messageId.");
    }
    const intake = await runAgentMailEmailIntake(workflow.teamId, messageId);
    const intentParts = [intake.classification.intent, intake.contextNotes].filter(Boolean);
    strippedPayload.optionalPrompt = intentParts.join("\n\n").trim() || strippedPayload.optionalPrompt;
    strippedPayload.prefilledImportRows = intake.rows;
    strippedPayload.postCount = intake.rows.length;
    strippedPayload.agentMailMessageId = messageId;
  }

  const resolvedSiteId = siteId?.trim() || resolveWorkflowSiteId(workflow);
  const siteContext = resolveSiteContext(resolvedSiteId);
  const withKeyword =
    kind === "local_dominator_export"
      ? applyLocalDominatorWorkflowKeyword(strippedPayload, config.executionPayload, siteContext.name)
      : strippedPayload;
  let payload = resolveWorkflowActionPayload(
    kind,
    withKeyword,
    siteContext.site,
    run.id,
    { outputs, siteId: resolvedSiteId, clientSiteIds },
  );
  if (resolvedSiteId) {
    payload = { ...payload, siteId: resolvedSiteId };
  }
  const clientSiteUrl = (siteContext.url ?? siteContext.site.siteUrl ?? siteContext.site.productionSiteUrl ?? "").trim();
  if (clientSiteUrl) {
    payload = {
      ...payload,
      siteUrl: clientSiteUrl,
      productionSiteUrl: (siteContext.site.productionSiteUrl ?? clientSiteUrl).trim(),
    };
  }
  if (siteContext.name.trim() && !payload.businessName?.trim()) {
    payload = { ...payload, businessName: siteContext.name.trim() };
  }
  if (kind === "post_creator" && resolvedSiteId) {
    payload = applyContentGapPostCountToPostCreatorPayload(
      payload,
      workflow,
      node.id,
      outputs,
      resolvedSiteId,
      clientSiteIds,
    );
  }
  payload = applyCsvRowsPayloadForNode(run.id, node.id, payload);
  if (kind === "post_creator") {
    payload = applyUpstreamContextToPostCreatorPayload(payload);
  }
  if (kind === "dfs_llm_article_audit" && resolvedSiteId) {
    const fullSite = getStoredSites().find((item) => item.id === resolvedSiteId);
    if (fullSite) {
      payload = await resolveDfsArticleAuditWorkflowPayload(fullSite, payload);
    }
  }
  if (kind === "chatgpt_website_audit") {
    payload = ensureChatGptAuditExecutionPayload(payload);
  }
  return {
    teamId: workflow.teamId,
    source: "workflow",
    recipeKey,
    title: config.title ?? node.label,
    context: {
      siteId: resolvedSiteId,
      workflowId: workflow.id,
      workflowRunId: run.id,
      workflowNodeId: node.id,
    },
    plan: {
      executionKind: kind,
      executionPayload: payload,
      workflowId: workflow.id,
      workflowRunId: run.id,
      workflowNodeId: node.id,
      ragVariableKey: config.ragVariableKey ?? `step_${node.id}`,
      workflowThenDelivery: true,
      ...(kind === "local_dominator_export" ? { executionMode: "server" as const } : {}),
    },
  };
}

function collectContextBlock(
  outputs: WorkflowStepOutput[],
  ragInputKeys: string[],
  siteId: string,
  clientSiteIds: string[],
): string {
  return buildRunContextBlock(outputs, ragInputKeys, siteId, clientSiteIds);
}

function applyLocalDominatorWorkflowKeyword(
  payload: TaskExecutionPayload,
  nodePayload: TaskExecutionPayload | undefined,
  siteName: string,
): TaskExecutionPayload {
  const businessName = siteName.trim();
  return {
    ...payload,
    keyword: resolveWorkflowLocalDominatorGridKeyword(
      nodePayload,
      payload.keyword,
      businessName,
    ),
  };
}

function resolveSiteContext(siteId: string | undefined): {
  name: string;
  url?: string;
  site: { name: string; siteUrl?: string; productionSiteUrl?: string };
} {
  if (!siteId?.trim()) {
    return { name: "", site: { name: "" } };
  }
  const site = getStoredSites().find((item) => item.id === siteId.trim());
  const name = site ? wordpressSiteDisplayName(site) : "";
  const url = site?.siteUrl ?? site?.productionSiteUrl;
  return {
    name,
    url,
    site: {
      name,
      siteUrl: site?.siteUrl,
      productionSiteUrl: site?.productionSiteUrl,
    },
  };
}

async function walkFromNode(
  workflow: WorkflowDefinition,
  run: WorkflowRun,
  nodeId: string,
  outputs: WorkflowStepOutput[],
  callbacks: WorkflowRunCallbacks,
  visited: Set<string>,
  clientScope: WorkflowWalkClientScope,
): Promise<WalkFromNodeResult> {
  let walkScope = clientScope;
  const { allSiteIds } = walkScope;
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
    return walkFromNode(workflow, run, edge.target, outputs, callbacks, visited, walkScope);
  }

  if (node.kind === "csv_rows") {
    await patchWorkflowRun(workflow.teamId, workflow.id, run.id, {
      status: "running",
      currentNodeId: node.id,
    });
    try {
      const executed = await executeWorkflowCsvRowsStep({
        teamId: workflow.teamId,
        workflowRunId: run.id,
        workflow,
        node,
        outputs,
      });
      const config = (node.config ?? {}) as { ragVariableKey?: string };
      const saved = await saveWorkflowStepOutput(workflow.teamId, workflow.id, run.id, {
        nodeId: node.id,
        variableKey: config.ragVariableKey ?? `csv_${node.id}`,
        scope: "run",
        label: node.label,
        textPreview: executed.preview,
      });
      if (saved.ok && saved.output) outputs.push(saved.output);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "CSV rows step failed";
      return { ok: false, error: message };
    }
  }

  if (node.kind === "action_agent") {
    await patchWorkflowRun(workflow.teamId, workflow.id, run.id, {
      status: "running",
      currentNodeId: node.id,
    });
    const config = actionConfig(node) as WorkflowActionConfig & { compiledTaskId?: number };
    const existingOutput = outputs.find((item) => item.nodeId === node.id && item.agentRunId);
    if (existingOutput?.agentRunId) {
      const existingAgent = await fetchAgentRun(workflow.teamId, existingOutput.agentRunId);
      // Failed/cancelled prior attempts are ignored so the walk can start a fresh agent
      // (e.g. entity pages after Local Dominator finally has a grid CSV).
      // LD "Job not found" is a worker cleanup race — recover CSV or defer, never spawn another export.
      if (
        existingAgent
        && config.executionKind === "local_dominator_export"
        && (existingAgent.status === "failed" || existingAgent.status === "cancelled")
      ) {
        const binding = readWorkflowAgentBinding(existingAgent);
        if (binding) {
          const csv = await isLdGridCsvReceived(workflow.teamId, binding, existingAgent.id);
          if (csv.ready) {
            const tail = await walkRemainingLinearSteps(
              workflow,
              run,
              nodeId,
              outputs,
              callbacks,
              visited,
              walkScope,
            );
            if (!tail.ok) return tail;
            if (tail.deferWorkflowCompletion) return tail;
            return { ok: true };
          }
        }
        if (
          existingAgent.status === "failed"
          && /job not found|already cleaned up/i.test(String(existingAgent.errorMessage ?? ""))
        ) {
          return { ok: true, deferWorkflowCompletion: true };
        }
      }
      if (
        existingAgent
        && (existingAgent.status === "failed" || existingAgent.status === "cancelled")
        && config.executionKind !== "local_dominator_export"
      ) {
        const message =
          existingAgent.errorMessage?.trim()
          || (existingAgent.status === "cancelled" ? "Agent run cancelled" : "Agent run failed");
        return { ok: false, error: message };
      }
      if (
        existingAgent
        && existingAgent.status !== "cancelled"
        && existingAgent.status !== "failed"
      ) {
        if (
          existingAgent.status === "queued"
          || existingAgent.status === "running"
          || existingAgent.status === "done"
        ) {
          if (config.executionKind === "local_dominator_export") {
            if (existingAgent.status === "done") {
              const binding = readWorkflowAgentBinding(existingAgent);
              if (binding) {
                const csv = await isLdGridCsvReceived(
                  workflow.teamId,
                  binding,
                  existingAgent.id,
                );
                if (csv.ready) {
                  const tail = await walkRemainingLinearSteps(
                    workflow,
                    run,
                    nodeId,
                    outputs,
                    callbacks,
                    visited,
                    walkScope,
                  );
                  if (!tail.ok) return tail;
                  if (tail.deferWorkflowCompletion) return tail;
                  return { ok: true };
                }
              }
            }
            return { ok: true, deferWorkflowCompletion: true };
          }
          if (existingAgent.status === "queued" || existingAgent.status === "running") {
            const terminal = await awaitAgentRunTerminal(workflow.teamId, existingOutput.agentRunId);
            if (!terminal) {
              return { ok: false, error: "Agent run missing after wait" };
            }
            if (terminal.status === "cancelled" || terminal.status === "failed") {
              const message =
                terminal.errorMessage?.trim()
                || (typeof terminal.result?.message === "string" ? terminal.result.message.trim() : "")
                || "Agent run failed";
              return { ok: false, error: message };
            }
            if (
              config.executionKind === "content_gap_check"
              && contentGapGoalMetFromAgentResult(terminal.result)
            ) {
              return { ok: true };
            }
          }
          if (
            config.executionKind === "content_gap_check"
            && (
              contentGapGoalMetFromAgentResult(existingAgent.result)
              || isContentGapGoalMetFromPreview(existingOutput.textPreview)
            )
          ) {
            return { ok: true };
          }
          if (existingAgent.status === "done" || existingAgent.status === "queued" || existingAgent.status === "running") {
            const tail = await walkRemainingLinearSteps(
              workflow,
              run,
              nodeId,
              outputs,
              callbacks,
              visited,
              walkScope,
            );
            if (!tail.ok) return tail;
            if (tail.deferWorkflowCompletion) return tail;
            return { ok: true };
          }
        }
      }
    }
    const ragInputKeys = resolveRagInputKeys(config);
    const clientAgnosticAgent = isClientAgnosticExecutionKind(
      config.executionKind,
      config.executionPayload,
    );
    const sitesToRun = clientAgnosticAgent
      ? [""]
      : walkScope.activeSiteIds.length > 0
        ? walkScope.activeSiteIds
        : ([resolveWorkflowSiteId(workflow)].filter(Boolean) as string[]);
    if (sitesToRun.length === 0) {
      return { ok: false, error: "No clients selected for this workflow." };
    }

    const usesThenDelivery = workflowAgentUsesThenDelivery(workflow, node.id);
    const showAgentInSidebar = callbacks.openAgentSidebar === true;

    if (usesThenDelivery) {
      registerParallelWorkflowChains(workflow.teamId, workflow.id, run.id, sitesToRun.length);
    }

    const sequential = peekWorkflowCsvSequential(run.id);
    const sequentialForThis = sequential?.nextNodeId === node.id ? sequential : undefined;
    const rowCount = sequentialForThis?.payloads.length ?? 1;
    const startIndex = sequentialForThis?.currentIndex ?? 0;

    for (let rowIndex = startIndex; rowIndex < rowCount; rowIndex += 1) {
      if (sequentialForThis) {
        stashWorkflowCsvSequential(run.id, {
          ...sequentialForThis,
          currentIndex: rowIndex,
        });
      }

      const siteResults = await Promise.all(
        sitesToRun.map((siteId) =>
          startWorkflowAgentForSite({
            workflow,
            run,
            node,
            config,
            siteId,
            sitesToRun: allSiteIds.length > 1 ? allSiteIds : sitesToRun,
            outputs,
            contextBlock: collectContextBlock(outputs, ragInputKeys, siteId, allSiteIds),
            usesThenDelivery,
            showAgentInSidebar,
            callbacks,
            ignoreExistingAgent: Boolean(sequentialForThis && rowIndex > startIndex),
          }),
        ),
      );

      const failure = siteResults.find((result) => !result.ok);
      if (failure) {
        if (usesThenDelivery) {
          clearParallelWorkflowChains(workflow.teamId, workflow.id, run.id);
        }
        return { ok: false, error: failure.error ?? "Agent run failed" };
      }

      for (const result of siteResults) {
        if (result.stepOutput) outputs.push(result.stepOutput);
      }

      await Promise.all(
        sitesToRun.map(async (siteId) => {
          const archiveOutput = await syncWorkflowRunArchiveDeliverables({
            teamId: workflow.teamId,
            workflowId: workflow.id,
            workflowRunId: run.id,
            nodes: workflow.nodes,
            outputs,
            siteId,
            clientSiteIds: allSiteIds.length > 1 ? allSiteIds : sitesToRun,
            siteName: resolveSiteContext(siteId).name,
          });
          if (archiveOutput) outputs.push(archiveOutput);
        }),
      );

      const deferCount = siteResults.filter((result) => result.defer).length;
      if (deferCount > 0) {
        registerParallelWorkflowChains(workflow.teamId, workflow.id, run.id, deferCount);
        return { ok: true, deferWorkflowCompletion: true };
      }

      if (config.executionKind === "content_gap_check" && siteResults.length > 0) {
        const sitesNeedingPosts = sitesToRun.filter((siteId, index) => {
          const result = siteResults[index];
          return Boolean(result?.ok && result.goalMet !== true);
        });
        if (sitesNeedingPosts.length === 0) {
          return { ok: true };
        }
        walkScope = { allSiteIds, activeSiteIds: sitesNeedingPosts };
      }
    }
  }

  if (isWorkflowThenKind(node.kind)) {
    if (outputs.some((output) => output.nodeId === node.id && output.scope === "run")) {
      // Bound automation runner already executed and saved this Then step.
    } else {
    await patchWorkflowRun(workflow.teamId, workflow.id, run.id, {
      status: "running",
      currentNodeId: node.id,
    });
    const config = thenConfig(node);
    const waitCtx = { teamId: workflow.teamId, workflowId: workflow.id, runId: run.id };

    if (shouldDeferThenStepForParallelWait(node, waitCtx)) {
      return { ok: true, deferWorkflowCompletion: true };
    }

    const folderTestOnly =
      callbacks.stopAfterNodeId === node.id && node.kind === "then_google_drive";

    const upstreamReady = folderTestOnly
      ? true
      : await awaitThenUpstreamTerminal(node, outputs, workflow.teamId);
    if (!upstreamReady) {
      return { ok: false, error: "Upstream deliverables are not ready yet." };
    }

    const sitesForThen =
      walkScope.activeSiteIds.length > 0
        ? walkScope.activeSiteIds
        : ([resolveWorkflowSiteId(workflow)].filter(Boolean) as string[]);
    const upstreamAgent = findUpstreamActionAgent(workflow, node.id);
    const executionKind = upstreamAgent
      ? String((upstreamAgent.config as WorkflowActionConfig).executionKind ?? "")
      : undefined;

    const runWorkflowWideEmail =
      node.kind === "then_email" && config.emailBatchScope === "workflow_run";

    if (runWorkflowWideEmail) {
      if (workflowRunThenEmailAlreadySent(outputs, node.id)) {
        return { ok: true };
      }
      const primarySiteId = sitesForThen[0] ?? resolveWorkflowSiteId(workflow) ?? "";
      const siteContext = resolveSiteContext(primarySiteId || undefined);
      const thenResult = await executeWorkflowThenStep(node, outputs, {
        workflow,
        siteId: primarySiteId || undefined,
        siteName: siteContext.name,
        siteUrl: siteContext.url,
        executionKind,
        allSiteIds,
        allOutputs: outputs,
        folderTestOnly,
      });
      if (!thenResult.ok) {
        return { ok: false, error: thenResult.error ?? "Then step failed" };
      }
      if (thenResult.output) {
        const saved = await saveWorkflowStepOutput(workflow.teamId, workflow.id, run.id, {
          nodeId: node.id,
          variableKey: thenResult.output.variableKey,
          scope: "run",
          label: thenResult.output.label,
          textPreview: thenResult.output.textPreview,
          agentRunId: thenResult.output.agentRunId,
          fileRefs: thenResult.output.fileRefs,
          deliveryMeta: thenResult.output.deliveryMeta,
        });
        if (saved.ok && saved.output) outputs.push(saved.output);
      }
    } else {
      const thenResults = await Promise.all(
        sitesForThen.map(async (siteId) => {
          const siteContext = resolveSiteContext(siteId);
          const siteOutputs = filterWorkflowOutputsForSite(outputs, siteId, allSiteIds);
          return executeWorkflowThenStep(node, siteOutputs, {
            workflow,
            siteId,
            siteName: siteContext.name,
            siteUrl: siteContext.url,
            executionKind,
            allSiteIds,
            allOutputs: outputs,
            folderTestOnly,
          });
        }),
      );

      const thenFailure = thenResults.find((result) => !result.ok);
      if (thenFailure) {
        return { ok: false, error: thenFailure.error ?? "Then step failed" };
      }

      for (let index = 0; index < thenResults.length; index += 1) {
        const thenResult = thenResults[index]!;
        if (!thenResult.output) continue;
        const siteId = sitesForThen[index]!;
        const thenVariableKey =
          allSiteIds.length > 1
            ? `${thenResult.output.variableKey}${workflowClientVariableSuffix(allSiteIds, siteId)}`
            : thenResult.output.variableKey;
        const saved = await saveWorkflowStepOutput(workflow.teamId, workflow.id, run.id, {
          nodeId: node.id,
          variableKey: thenVariableKey,
          scope: "run",
          label: thenResult.output.label,
          textPreview: thenResult.output.textPreview,
          agentRunId: thenResult.output.agentRunId,
          fileRefs: thenResult.output.fileRefs,
          deliveryMeta: thenResult.output.deliveryMeta,
          siteId,
        });
        if (saved.ok && saved.output) outputs.push(saved.output);
      }
    }
    }
  }

  if (node.kind === "rag_archive") {
    const config = node.config as WorkflowRagArchiveConfig;
    if (!config.variableKey) {
      return { ok: true };
    }
    const deliverableScope = config.deliverableScope ?? "final";
    const sitesForArchive =
      walkScope.activeSiteIds.length > 0
        ? walkScope.activeSiteIds
        : ([resolveWorkflowSiteId(workflow)].filter(Boolean) as string[]);

    for (const siteId of sitesForArchive) {
      const siteContext = resolveSiteContext(siteId);
      const deliverableOutputs = clientDeliverableOutputs(
        outputs,
        workflow.nodes,
        siteId,
        allSiteIds,
      );
      const merged = mergeWorkflowDeliverableFileRefs(deliverableOutputs, workflow.nodes);
      const fileRefs = filterWorkflowArchiveFileRefs(merged, deliverableScope, siteContext.name);
      if (fileRefs.length === 0) continue;
      const baseKey = config.variableKey;
      const variableKey =
        allSiteIds.length > 1
          ? `${baseKey}${workflowClientVariableSuffix(allSiteIds, siteId)}`
          : baseKey;
      const previewSource =
        resolveArchiveOutputForClient(deliverableOutputs, baseKey, siteId, allSiteIds) ??
        deliverableOutputs[deliverableOutputs.length - 1];
      const saved = await saveWorkflowStepOutput(workflow.teamId, workflow.id, run.id, {
        nodeId: node.id,
        variableKey,
        scope: "run",
        label: config.label ?? config.variableKey,
        textPreview:
          previewSource?.textPreview ?? `${fileRefs.length} deliverable${fileRefs.length === 1 ? "" : "s"}`,
        agentRunId: previewSource?.agentRunId,
        fileRefs,
        siteId: allSiteIds.length > 1 ? siteId : undefined,
      });
      if (saved.ok && saved.output) outputs.push(saved.output);
    }
  }

  if (callbacks.stopAfterNodeId === nodeId) {
    return { ok: true };
  }

  for (const edge of outgoingEdges(workflow.edges, nodeId)) {
    const next = await walkFromNode(workflow, run, edge.target, outputs, callbacks, visited, walkScope);
    if (!next.ok) return next;
    if (next.deferWorkflowCompletion) {
      return { ok: true, deferWorkflowCompletion: true };
    }
  }

  const linearTail = await walkRemainingLinearSteps(
    workflow,
    run,
    nodeId,
    outputs,
    callbacks,
    visited,
    walkScope,
  );
  if (!linearTail.ok) return linearTail;
  if (linearTail.deferWorkflowCompletion) return linearTail;

  return { ok: true };
}

export async function runNextWorkflowAgentStep(
  teamId: number,
  agentRun: AgentRun,
  callbacks: WorkflowRunCallbacks,
  gridFileRefs?: { name: string; url: string; mime?: string }[],
): Promise<void> {
  const binding = readWorkflowAgentBinding(agentRun);
  if (!binding) {
    throw new Error("Workflow agent run is missing workflow binding.");
  }

  const chainKey = workflowStepChainKey(
    binding.workflowRunId,
    binding.workflowNodeId,
    agentRun.id,
  );
  if (workflowStepChainStarted.has(chainKey)) {
    return;
  }
  workflowStepChainStarted.add(chainKey);

  try {
  const chainSiteId = agentRun.context?.siteId?.trim() ?? "";
  const workflow = await fetchWorkflow(teamId, binding.workflowId);
  if (!workflow) {
    throw new Error("Workflow not found for grid export chain.");
  }
  const run = await fetchWorkflowRun(teamId, binding.workflowId, binding.workflowRunId);
  if (!run) {
    throw new Error("Workflow run not found for grid export chain.");
  }

  const outputs = [...(await fetchWorkflowStepOutputs(teamId, binding.workflowId, binding.workflowRunId))];

  const completedNode = nodeById(workflow.nodes, binding.workflowNodeId);
  if (!completedNode) {
    throw new Error("Completed workflow node not found for grid export chain.");
  }

  if (
    completedNode.kind === "action_agent"
    && actionConfig(completedNode).executionKind === "content_gap_check"
    && contentGapGoalMetFromAgentResult(agentRun.result)
  ) {
    if (!hasIncompleteWorkflowSteps(workflow, outputs)) {
      const allChainsDone = completeParallelWorkflowChain(
        teamId,
        binding.workflowId,
        binding.workflowRunId,
      );
      if (allChainsDone) {
        clearParallelWorkflowChains(teamId, binding.workflowId, binding.workflowRunId);
        await finishDeferredWorkflowRun(teamId, binding.workflowId, binding.workflowRunId, {
          status: "done",
          errorMessage: null,
        });
      }
    }
    workflowStepChainStarted.delete(chainKey);
    return;
  }

  const clientNode = findClientNode(workflow);
  const clientConfig = (clientNode?.config ?? {}) as WorkflowClientConfig;
  const availableSiteIds = callbacks.listAvailableSiteIds
    ? await Promise.resolve(callbacks.listAvailableSiteIds())
    : [];
  const allClientSiteIds = resolveWorkflowClientSiteIds(clientConfig, availableSiteIds);
  const clientScope = buildWorkflowWalkClientScope(
    outputs,
    chainSiteId ? [chainSiteId] : allClientSiteIds,
    allClientSiteIds,
  );

  const completedConfig = actionConfig(completedNode);
  const hasStepOutput = outputs.some(
    (output) => output.nodeId === binding.workflowNodeId && output.agentRunId === agentRun.id,
  );
  const hasLdCsvOnOutputs =
    completedConfig.executionKind === "local_dominator_export"
    && outputs.some(
      (output) =>
        output.nodeId === binding.workflowNodeId
        && (output.fileRefs ?? []).some((file) => Boolean(file.url) && isGridCsvFileRef(file)),
    );
  // Persist CSV even when an empty LD placeholder already exists (resume must see the grid).
  if (!hasStepOutput || (completedConfig.executionKind === "local_dominator_export" && !hasLdCsvOnOutputs)) {
    const sitesToRun = allClientSiteIds.length > 0 ? allClientSiteIds : clientScope.activeSiteIds;
    const variableKey = `${completedConfig.ragVariableKey ?? `step_${binding.workflowNodeId}`}${workflowClientVariableSuffix(sitesToRun, chainSiteId)}`;
    let fileRefs =
      gridFileRefs && gridFileRefs.length > 0
        ? gridFileRefs
        : await resolveStepOutputFileRefsWithRetry(teamId, agentRun.id);
    if (completedConfig.executionKind === "local_dominator_export") {
      if (!fileRefs.some((file) => Boolean(file.url) && isGridCsvFileRef(file))) {
        workflowStepChainStarted.delete(chainKey);
        return;
      }
    } else if (fileRefs.length === 0) {
      const deliverableFiles = await fetchAgentRunDeliverableFiles(teamId, agentRun.id);
      if (deliverableFiles.length > 0) {
        fileRefs = await resolveStepOutputFileRefsWithRetry(teamId, agentRun.id, 8, 1_000);
      }
      if (fileRefs.length === 0) {
        workflowStepChainStarted.delete(chainKey);
        throw new Error(
          `Agent run ${agentRun.id} has no deliverable file refs for workflow chain (${deliverableFiles.length} files in archive).`,
        );
      }
    }
    if (fileRefs.length > 0) {
      const preview =
        completedConfig.executionKind === "local_dominator_export"
          ? "Grid export CSV"
          : typeof agentRun.result?.message === "string" && agentRun.result.message.trim()
            ? agentRun.result.message.trim()
            : completedConfig.title ?? completedNode.label;
      const saved = await saveWorkflowStepOutput(teamId, binding.workflowId, binding.workflowRunId, {
        nodeId: binding.workflowNodeId,
        variableKey,
        scope: "run",
        label: completedConfig.title ?? completedNode.label,
        textPreview: preview,
        agentRunId: agentRun.id,
        fileRefs,
        siteId: chainSiteId || undefined,
      });
      if (saved.ok && saved.output) {
        const withoutPrior = outputs.filter(
          (output) =>
            !(output.nodeId === binding.workflowNodeId && output.agentRunId === agentRun.id),
        );
        outputs.length = 0;
        outputs.push(...withoutPrior, saved.output);
      }
      if (completedConfig.executionKind === "local_dominator_export") {
        const archiveOutput = await syncWorkflowRunArchiveDeliverables({
          teamId,
          workflowId: binding.workflowId,
          workflowRunId: binding.workflowRunId,
          nodes: workflow.nodes,
          outputs,
          agentRunId: agentRun.id,
          textPreview: "Grid export CSV",
          extraFileRefs: fileRefs,
          siteId: chainSiteId || undefined,
          clientSiteIds: sitesToRun,
          siteName: resolveSiteContext(chainSiteId || undefined).name,
        });
        if (archiveOutput) outputs.push(archiveOutput);
      }
    }
  }

  await patchWorkflowRun(teamId, binding.workflowId, binding.workflowRunId, {
    status: "running",
    currentNodeId: binding.workflowNodeId,
    errorMessage: null,
  });

  const sequentialCsv = peekWorkflowCsvSequential(binding.workflowRunId);
  if (
    sequentialCsv
    && sequentialCsv.nextNodeId === binding.workflowNodeId
    && sequentialCsv.currentIndex + 1 < sequentialCsv.payloads.length
  ) {
    workflowStepChainStarted.delete(chainKey);
    return;
  }

  const visited = new Set<string>();
  let deferredCompletion = false;
  const tail = await walkRemainingLinearSteps(
    workflow,
    run,
    binding.workflowNodeId,
    outputs,
    callbacks,
    visited,
    clientScope,
  );
  if (!tail.ok) {
    const message = tail.error ?? "Workflow chain step failed";
    await finishDeferredWorkflowRun(teamId, binding.workflowId, binding.workflowRunId, {
      status: "failed",
      errorMessage: message,
    });
    workflowStepChainStarted.delete(chainKey);
    throw new Error(message);
  }
  if (tail.deferWorkflowCompletion) {
    deferredCompletion = true;
  }

  if (deferredCompletion || hasIncompleteWorkflowSteps(workflow, outputs)) {
    workflowStepChainStarted.delete(chainKey);
    return;
  }

  const allChainsDone = completeParallelWorkflowChain(
    teamId,
    binding.workflowId,
    binding.workflowRunId,
  );
  if (allChainsDone) {
    clearParallelWorkflowChains(teamId, binding.workflowId, binding.workflowRunId);
    await finishDeferredWorkflowRun(teamId, binding.workflowId, binding.workflowRunId, {
      status: "done",
      errorMessage: null,
    });
  }
  workflowStepChainStarted.delete(chainKey);
  } catch (err) {
    workflowStepChainStarted.delete(chainKey);
    const binding = readWorkflowAgentBinding(agentRun);
    if (binding) {
      await finishDeferredWorkflowRun(teamId, binding.workflowId, binding.workflowRunId, {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Workflow chain failed",
      }).catch(() => {});
    }
    throw err;
  }
}

export async function executeWorkflowRun(
  teamId: number,
  workflowId: number,
  runId: number,
  callbacks: WorkflowRunCallbacks,
): Promise<{ ok: boolean; error?: string; deferWorkflowCompletion?: boolean }> {
  const workflow = await fetchWorkflow(teamId, workflowId);
  if (!workflow) return { ok: false, error: "Workflow not found" };
  const run = await fetchWorkflowRun(teamId, workflowId, runId);
  if (!run) return { ok: false, error: "Run not found" };

  const existingOutputs = await fetchWorkflowStepOutputs(teamId, workflowId, runId);

  if (run.status === "done") {
    if (!hasIncompleteWorkflowSteps(workflow, existingOutputs)) {
      return { ok: true };
    }
    await patchWorkflowRun(teamId, workflowId, runId, {
      status: "running",
      errorMessage: null,
    });
  } else if (run.status === "cancelled") {
    return { ok: true };
  }
  if (run.status === "failed") {
    return { ok: false, error: run.errorMessage ?? "Run failed" };
  }

  const runKey = workflowRunInProgressKey(teamId, workflowId, runId);
  if (workflowRunsInProgress.has(runKey)) {
    return { ok: true, deferWorkflowCompletion: true };
  }

  const runValidation = validateWorkflowForRun(workflow);
  if (!runValidation.ok) return { ok: false, error: runValidation.error };

  const runStart = callbacks.skipSetupSteps
    ? resolveWorkflowTestWalkStart(workflow)
    : resolveWorkflowRunStart(workflow);
  if (!runStart) return { ok: false, error: "Workflow has no runnable steps" };

  const clientNode = findClientNode(workflow);
  const clientConfig = (clientNode?.config ?? {}) as WorkflowClientConfig;
  const availableSiteIds = callbacks.listAvailableSiteIds
    ? await Promise.resolve(callbacks.listAvailableSiteIds())
    : [];
  const clientSiteIds = resolveWorkflowClientSiteIds(clientConfig, availableSiteIds);
  if (workflowRequiresClient(workflow)) {
    if (workflowClientScope(clientConfig) === "selected" && clientSiteIds.length === 0) {
      return { ok: false, error: "Select at least one client on the Client step." };
    }
    if (workflowClientScope(clientConfig) === "all" && clientSiteIds.length === 0) {
      return { ok: false, error: "No WordPress sites available. Add clients in Integrations." };
    }
  }

  const outputs = [...existingOutputs];
  const walkNodeId = resolveWorkflowWalkEntryNodeId(
    workflow,
    outputs,
    runStart.firstWalkNodeId,
    callbacks.stopAfterNodeId,
  );

  await patchWorkflowRun(teamId, workflowId, runId, {
    status: "running",
    currentNodeId: walkNodeId,
  });
  workflowRunsInProgress.add(runKey);
  try {
    const result = await walkFromNode(
      workflow,
      run,
      walkNodeId,
      outputs,
      callbacks,
      new Set(),
      buildWorkflowWalkClientScope(outputs, clientSiteIds),
    );
    if (!result.ok) {
      await finalizeWorkflowBoundAgentRunsOnFailure({
        teamId,
        workflow,
        outputs,
        errorMessage: result.error ?? "Workflow step failed",
      });
      await patchWorkflowRun(teamId, workflowId, runId, {
        status: "failed",
        errorMessage: result.error ?? "Workflow step failed",
        currentNodeId: null,
      });
      return result;
    }
    if (result.deferWorkflowCompletion) {
      await patchWorkflowRun(teamId, workflowId, runId, {
        status: "running",
        errorMessage: null,
      });
      return { ok: true, deferWorkflowCompletion: true };
    }
    if (hasIncompleteWorkflowSteps(workflow, outputs)) {
      const resumeNodeId = resolveWorkflowResumeNodeId(workflow, outputs, walkNodeId);
      if (resumeNodeId !== walkNodeId) {
        const tailResult = await walkFromNode(
          workflow,
          run,
          resumeNodeId,
          outputs,
          callbacks,
          new Set(),
          buildWorkflowWalkClientScope(outputs, clientSiteIds),
        );
        if (!tailResult.ok) {
          await finalizeWorkflowBoundAgentRunsOnFailure({
            teamId,
            workflow,
            outputs,
            errorMessage: tailResult.error ?? "Workflow step failed",
          });
          await patchWorkflowRun(teamId, workflowId, runId, {
            status: "failed",
            errorMessage: tailResult.error ?? "Workflow step failed",
            currentNodeId: null,
          });
          return tailResult;
        }
        if (tailResult.deferWorkflowCompletion) {
          await patchWorkflowRun(teamId, workflowId, runId, {
            status: "running",
            errorMessage: null,
          });
          return { ok: true, deferWorkflowCompletion: true };
        }
      }
    }
    if (hasIncompleteWorkflowSteps(workflow, outputs)) {
      await patchWorkflowRun(teamId, workflowId, runId, {
        status: "running",
        errorMessage: null,
      });
      return { ok: true, deferWorkflowCompletion: true };
    }
    clearParallelWorkflowChains(teamId, workflowId, runId);
    await patchWorkflowRun(teamId, workflowId, runId, {
      status: result.ok ? "done" : "failed",
      errorMessage: result.error ?? null,
      currentNodeId: null,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Workflow run failed";
    await finalizeWorkflowBoundAgentRunsOnFailure({
      teamId,
      workflow,
      outputs,
      errorMessage: message,
    }).catch(() => {});
    await patchWorkflowRun(teamId, workflowId, runId, {
      status: "failed",
      errorMessage: message,
      currentNodeId: null,
    }).catch(() => {});
    return { ok: false, error: message };
  } finally {
    markWorkflowRunFinished(teamId, workflowId, runId);
  }
}

export async function cancelWorkflowRunForAgentRun(
  teamId: number,
  agentRun: AgentRun,
): Promise<void> {
  const binding = readWorkflowAgentBinding(agentRun);
  if (!binding) return;
  clearParallelWorkflowChains(teamId, binding.workflowId, binding.workflowRunId);
  markWorkflowRunFinished(teamId, binding.workflowId, binding.workflowRunId);
  await ackPendingWorkflowTrigger(teamId, binding.workflowId);
  await patchWorkflowRun(teamId, binding.workflowId, binding.workflowRunId, {
    status: "cancelled",
    errorMessage: "Cancelled",
    currentNodeId: null,
  });
}

export async function failWorkflowRunForAgentRun(
  teamId: number,
  agentRun: AgentRun,
  errorMessage: string,
): Promise<void> {
  const binding = readWorkflowAgentBinding(agentRun);
  if (!binding) return;
  clearParallelWorkflowChains(teamId, binding.workflowId, binding.workflowRunId);
  markWorkflowRunFinished(teamId, binding.workflowId, binding.workflowRunId);
  await ackPendingWorkflowTrigger(teamId, binding.workflowId);
  await patchWorkflowRun(teamId, binding.workflowId, binding.workflowRunId, {
    status: "failed",
    errorMessage: errorMessage.trim() || "Agent run failed",
    currentNodeId: null,
  });
}

export async function dispatchWorkflowRunExecution(
  teamId: number,
  workflowId: number,
  runId: number,
  callbacks: WorkflowRunCallbacks,
): Promise<{ ok: boolean; error?: string; deferWorkflowCompletion?: boolean }> {
  const dispatchKey = workflowDispatchKey(teamId, workflowId, runId);
  const inFlight = workflowDispatchPromises.get(dispatchKey);
  if (inFlight) return inFlight;

  const promise = executeWorkflowRun(teamId, workflowId, runId, callbacks).finally(() => {
    workflowDispatchPromises.delete(dispatchKey);
  });
  workflowDispatchPromises.set(dispatchKey, promise);
  return promise;
}

export async function handlePendingWorkflowDispatch(
  teamId: number,
  workflowId: number,
  runId: number | undefined,
  callbacks: WorkflowRunCallbacks,
): Promise<{ ok: boolean; error?: string }> {
  if (!runId) {
    await ackPendingWorkflowTrigger(teamId, workflowId);
    return { ok: true };
  }

  const dispatchKey = workflowDispatchKey(teamId, workflowId, runId);
  const inFlight = workflowDispatchPromises.get(dispatchKey);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const claim = await claimPendingWorkflowDispatch(teamId, workflowId, runId);
      if (!claim.ok) {
        return { ok: false, error: claim.error ?? "Could not claim workflow dispatch" };
      }
      if (!claim.claimed) {
        return { ok: true };
      }
      const result = await executeWorkflowRun(teamId, workflowId, runId, callbacks);
      if (!result.deferWorkflowCompletion) {
        await ackPendingWorkflowTrigger(teamId, workflowId);
      }
      return result;
    } finally {
      workflowDispatchPromises.delete(dispatchKey);
    }
  })();
  workflowDispatchPromises.set(dispatchKey, promise);
  return promise;
}
