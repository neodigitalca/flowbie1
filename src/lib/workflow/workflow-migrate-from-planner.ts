import type { AutomationPlan } from "@/lib/automation-planner-types";
import { isClientAgnosticExecutionKind } from "@/lib/agent-runs-types";
import { defaultTaskTriggerConfig } from "@/lib/task-trigger-types";
import type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowRagVariable,
} from "@/lib/workflow/workflow-types";
import { defaultNodeLabel, newWorkflowNodeId, findClientNode } from "@/lib/workflow/workflow-graph-utils";
import { createWorkflowNode, syncLinearPositions, rewireLinearChain } from "@/lib/workflow/workflow-graph-mutations";
import {
  CSV_ROWS_ACTION_KEYWORD,
  csvRowsConfigFromPayload,
  isCsvRowsActionKeyword,
} from "@/lib/workflow/csv-rows-types";

function planRequiresClientNode(plan: AutomationPlan): boolean {
  const actions = plan.actions?.length ? plan.actions : [plan.action];
  return actions.some(
    (action) => !isClientAgnosticExecutionKind(action.executionKind, action.executionPayload),
  );
}

export function automationPlanToWorkflowGraph(
  plan: AutomationPlan,
  meta: { teamId: number; workflowId?: number; siteId?: string | null },
): Omit<WorkflowDefinition, "id" | "createdAt" | "updatedAt" | "publishedAt"> {
  const triggerNodeId = newWorkflowNodeId(
    plan.trigger.kind === "calendar"
      ? "trigger_calendar"
      : plan.trigger.kind === "gsc"
        ? "trigger_gsc"
        : "trigger_manual",
  );
  const triggerNode: WorkflowNode = {
    id: triggerNodeId,
    kind:
      plan.trigger.kind === "calendar"
        ? "trigger_calendar"
        : plan.trigger.kind === "gsc"
          ? "trigger_gsc"
          : "trigger_manual",
    label: defaultNodeLabel(
      plan.trigger.kind === "calendar"
        ? "trigger_calendar"
        : plan.trigger.kind === "gsc"
          ? "trigger_gsc"
          : "trigger_manual",
    ),
    config:
      plan.trigger.kind === "calendar"
        ? {
            frequency: plan.trigger.frequency,
            startDate: plan.trigger.startDate,
            time: plan.trigger.time,
          }
        : plan.trigger.kind === "gsc"
          ? {
              source: plan.trigger.source,
              targetBucket: plan.trigger.targetBucket,
              triggerConfig: plan.trigger.triggerConfig,
            }
          : {},
    position: { x: 120, y: 80 },
  };

  const actions = plan.actions?.length ? plan.actions : [plan.action];
  const nodes: WorkflowNode[] = [triggerNode];
  const edges: WorkflowEdge[] = [];
  const ragVariables: WorkflowRagVariable[] = [];
  let prevId = triggerNodeId;
  let y = 220;
  let prevVariableKey = "";
  let prevExecutionKind = "";

  actions.forEach((action, index) => {
    if (isCsvRowsActionKeyword(action.keyword)) {
      const csvId = newWorkflowNodeId("csv_rows");
      const csvConfig = csvRowsConfigFromPayload(action.executionPayload);
      const variableKey = `csv_rows_${index + 1}`;
      nodes.push({
        id: csvId,
        kind: "csv_rows",
        label: action.title ?? "CSV rows",
        config: {
          ...csvConfig,
          ragVariableKey: variableKey,
        },
        position: { x: 120, y },
      });
      edges.push({ id: `e_${prevId}_${csvId}`, source: prevId, target: csvId });
      ragVariables.push({
        key: variableKey,
        nodeId: csvId,
        scope: "run",
        label: action.title ?? "CSV rows",
      });
      prevVariableKey = variableKey;
      prevExecutionKind = CSV_ROWS_ACTION_KEYWORD;
      prevId = csvId;
      y += 140;
      return;
    }

    const actionId = newWorkflowNodeId("action_agent");
    const variableKey = `${action.executionKind}_${index + 1}`.replace(/[^a-z0-9_]/gi, "_");
    const executionKind = String(action.executionKind ?? "");
    let executionPayload = { ...(action.executionPayload ?? {}) };

    if (
      index > 0 &&
      prevExecutionKind === "local_dominator_export" &&
      (executionKind === "entity_page_creator" || executionKind === "entity_generator")
    ) {
      executionPayload = {
        ...executionPayload,
        locationSource: "grid",
        gridInputSource: "workflow",
        ragInputKeys: [prevVariableKey],
      };
    }

    if (index > 0 && prevExecutionKind === "entity_generator" && executionKind === "sap_generator") {
      executionPayload = {
        ...executionPayload,
        entityCsvInputSource: "workflow",
        ragInputKeys: [prevVariableKey],
      };
    }

    const autoRagInputKeys =
      index > 0 &&
      ((prevExecutionKind === "local_dominator_export" &&
        (executionKind === "entity_page_creator" || executionKind === "entity_generator")) ||
        (prevExecutionKind === "entity_generator" && executionKind === "sap_generator") ||
        (executionKind === "post_creator" && Boolean(executionPayload.useUpstreamContext) && prevVariableKey))
        ? [prevVariableKey]
        : undefined;

    nodes.push({
      id: actionId,
      kind: "action_agent",
      label: action.title ?? defaultNodeLabel("action_agent"),
      config: {
        executionKind: action.executionKind,
        executionPayload,
        ragVariableKey: variableKey,
        ragScope: "run",
        title: action.title,
        actionBlockKeyword: action.keyword,
        recipeKeyword: plan.keyword,
        recipeCategory: plan.category,
        ...(autoRagInputKeys ? { ragInputKeys: autoRagInputKeys } : {}),
      },
      position: { x: 120, y },
    });
    edges.push({ id: `e_${prevId}_${actionId}`, source: prevId, target: actionId });
    ragVariables.push({
      key: variableKey,
      nodeId: actionId,
      scope: "run",
      label: action.title ?? variableKey,
    });
    prevVariableKey = variableKey;
    prevExecutionKind = executionKind;
    prevId = actionId;
    y += 140;
  });

  const archiveId = newWorkflowNodeId("rag_archive");
  nodes.push({
    id: archiveId,
    kind: "rag_archive",
    label: defaultNodeLabel("rag_archive"),
    config: {
      variableKey: ragVariables[ragVariables.length - 1]?.key ?? "workflow_output",
      scope: "run",
    },
    position: { x: 120, y },
  });
  edges.push({ id: `e_${prevId}_${archiveId}`, source: prevId, target: archiveId });

  const positioned = syncLinearPositions(nodes);
  const wiredEdges = rewireLinearChain(positioned, edges);

  if (!planRequiresClientNode(plan)) {
    return {
      teamId: meta.teamId,
      name: plan.name,
      description: plan.description,
      status: "draft",
      wordpressSiteId: null,
      nodes: positioned,
      edges: wiredEdges,
      ragVariables,
    };
  }

  const clientNode = createWorkflowNode("workflow_client", "Client");
  clientNode.config = { siteIds: meta.siteId ? [meta.siteId] : [] };
  const withClient = syncLinearPositions([clientNode, ...nodes]);
  const clientEdges = rewireLinearChain(withClient, edges);

  return {
    teamId: meta.teamId,
    name: plan.name,
    description: plan.description,
    status: "draft",
    wordpressSiteId: meta.siteId ?? null,
    nodes: withClient,
    edges: clientEdges,
    ragVariables,
  };
}

export function emptyWorkflowDraft(
  teamId: number,
  siteId?: string | null,
): Omit<WorkflowDefinition, "id" | "createdAt" | "updatedAt" | "publishedAt"> {
  const siteIds = siteId ? [siteId] : [];
  const clientNode = createWorkflowNode("workflow_client", "Client");
  clientNode.config = { siteIds };
  const nodes = syncLinearPositions([clientNode]);

  return {
    teamId,
    name: "Untitled workflow",
    status: "draft",
    wordpressSiteId: siteId ?? null,
    nodes,
    edges: [],
    ragVariables: [],
  };
}

export function ensureWorkflowClientNode(
  workflow: WorkflowDefinition,
  defaultSiteId?: string | null,
): WorkflowDefinition {
  if (findClientNode(workflow)) return workflow;
  const siteIds = workflow.wordpressSiteId
    ? [workflow.wordpressSiteId]
    : defaultSiteId
      ? [defaultSiteId]
      : [];
  const clientNode = createWorkflowNode("workflow_client", "Client");
  clientNode.config = { siteIds };
  const nodes = syncLinearPositions([clientNode, ...workflow.nodes]);
  return {
    ...workflow,
    nodes,
    edges: rewireLinearChain(nodes, workflow.edges),
    wordpressSiteId: siteIds[0] ?? workflow.wordpressSiteId ?? null,
  };
}

export function defaultGscTriggerConfig() {
  return {
    ...defaultTaskTriggerConfig(),
    conditions: [{ signal: "ctr_drop" as const, value: 15, minImpressions: 100 }],
  };
}
