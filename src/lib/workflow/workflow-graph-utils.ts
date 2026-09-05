import type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeKind,
} from "@/lib/workflow/workflow-types";
import { isWorkflowTriggerKind, isWorkflowClientKind, isWorkflowThenKind, isWorkflowScheduleKind } from "@/lib/workflow/workflow-types";

export type WorkflowRunStart = {
  entryNodeId: string;
  firstWalkNodeId: string;
};

function nodesInVisualOrder(workflow: Pick<WorkflowDefinition, "nodes">): WorkflowNode[] {
  return [...workflow.nodes].sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
  );
}

function isRunnableWorkflowNode(node: WorkflowNode): boolean {
  return (
    node.kind === "action_agent" ||
    node.kind === "csv_rows" ||
    node.kind === "path_rules" ||
    node.kind === "rag_archive" ||
    isWorkflowThenKind(node.kind)
  );
}

function isSetupWorkflowNode(node: WorkflowNode): boolean {
  return (
    isWorkflowClientKind(node.kind) ||
    isWorkflowScheduleKind(node.kind) ||
    isWorkflowTriggerKind(node.kind)
  );
}

function firstRunnableFrom(workflow: Pick<WorkflowDefinition, "nodes" | "edges">, nodeId: string): string {
  let currentId = nodeId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodeById(workflow.nodes, currentId);
    if (!node) return currentId;
    if (isSetupWorkflowNode(node) || !isRunnableWorkflowNode(node)) {
      const nextId = outgoingEdges(workflow.edges, currentId)[0]?.target;
      if (!nextId) return currentId;
      currentId = nextId;
      continue;
    }
    return currentId;
  }
  return currentId;
}

/** Resolve where a manual/simulated run enters the graph. Triggers are optional for Test. */
export function resolveWorkflowRunStart(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">,
): WorkflowRunStart | null {
  const ordered = nodesInVisualOrder(workflow);

  const trigger = findTriggerNode(workflow);
  if (trigger) {
    const firstEdge = outgoingEdges(workflow.edges, trigger.id)[0];
    if (firstEdge?.target) {
      return {
        entryNodeId: trigger.id,
        firstWalkNodeId: firstRunnableFrom(workflow, firstEdge.target),
      };
    }
  }

  const client = findClientNode(workflow);
  if (client) {
    const firstEdge = outgoingEdges(workflow.edges, client.id)[0];
    if (firstEdge?.target) {
      return {
        entryNodeId: client.id,
        firstWalkNodeId: firstRunnableFrom(workflow, firstEdge.target),
      };
    }
  }

  const clientIndex = ordered.findIndex((node) => isWorkflowClientKind(node.kind));
  const searchFrom = clientIndex >= 0 ? clientIndex + 1 : 0;
  for (let index = searchFrom; index < ordered.length; index += 1) {
    const node = ordered[index]!;
    if (isSetupWorkflowNode(node)) continue;
    if (!isRunnableWorkflowNode(node)) continue;
    return {
      entryNodeId: clientIndex >= 0 ? ordered[clientIndex]!.id : node.id,
      firstWalkNodeId: node.id,
    };
  }

  return null;
}

/** Test runs skip Client and Schedule; start at the first actionable step in visual order. */
export function resolveWorkflowTestWalkStart(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">,
): WorkflowRunStart | null {
  const ordered = nodesInVisualOrder(workflow);
  const client = findClientNode(workflow);

  for (let index = 0; index < ordered.length; index += 1) {
    const node = ordered[index]!;
    if (isSetupWorkflowNode(node) || !isRunnableWorkflowNode(node)) continue;
    return {
      entryNodeId: client?.id ?? node.id,
      firstWalkNodeId: node.id,
    };
  }

  return null;
}

export function findClientNode(workflow: Pick<WorkflowDefinition, "nodes">): WorkflowNode | null {
  return workflow.nodes.find((node) => isWorkflowClientKind(node.kind)) ?? null;
}

export function findTriggerNode(workflow: Pick<WorkflowDefinition, "nodes">): WorkflowNode | null {
  return workflow.nodes.find((node) => isWorkflowTriggerKind(node.kind)) ?? null;
}

export function outgoingEdges(edges: WorkflowEdge[], nodeId: string, sourceHandle?: string): WorkflowEdge[] {
  return edges.filter((edge) => {
    if (edge.source !== nodeId) return false;
    if (sourceHandle != null && edge.sourceHandle !== sourceHandle) return false;
    return true;
  });
}

export function nodeById(nodes: WorkflowNode[], nodeId: string): WorkflowNode | undefined {
  return nodes.find((node) => node.id === nodeId);
}

/** Merge incoming node edits onto the current node (executionPayload layers last-write fields). */
export function mergeWorkflowNodeUpdate(existing: WorkflowNode, incoming: WorkflowNode): WorkflowNode {
  if (existing.id !== incoming.id) return incoming;
  const existingConfig = existing.config as { executionPayload?: Record<string, unknown> };
  const incomingConfig = incoming.config as { executionPayload?: Record<string, unknown> };
  if (!existingConfig.executionPayload || !incomingConfig.executionPayload) {
    return incoming;
  }
  return {
    ...incoming,
    config: {
      ...incoming.config,
      executionPayload: {
        ...existingConfig.executionPayload,
        ...incomingConfig.executionPayload,
      },
    },
  };
}

export function orderedExecutionNodes(workflow: WorkflowDefinition): WorkflowNode[] {
  const trigger = findTriggerNode(workflow);
  if (!trigger) return [];
  const visited = new Set<string>();
  const ordered: WorkflowNode[] = [];
  const walk = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodeById(workflow.nodes, nodeId);
    if (!node) return;
    if (node.kind !== "trigger_manual" && !isWorkflowTriggerKind(node.kind) && node.kind !== trigger.kind) {
      ordered.push(node);
    } else if (node.id === trigger.id) {
      ordered.unshift(node);
    }
    const edges = outgoingEdges(workflow.edges, nodeId);
    if (node.kind === "path_rules") {
      const branchEdge = edges[0];
      if (branchEdge) walk(branchEdge.target);
      return;
    }
    for (const edge of edges) {
      walk(edge.target);
    }
  };
  walk(trigger.id);
  return ordered.filter((node) => node.kind !== trigger.kind || node.id === trigger.id);
}

export function newWorkflowNodeId(kind: WorkflowNodeKind): string {
  return `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultNodeLabel(kind: WorkflowNodeKind): string {
  switch (kind) {
    case "workflow_client":
      return "Client";
    case "trigger_calendar":
      return "Schedule";
    case "trigger_gsc":
      return "GSC signal";
    case "trigger_document":
      return "Document received";
    case "trigger_agentmail":
      return "Agent Mail received";
    case "trigger_manual":
      return "Manual trigger";
    case "trigger_agent_done":
      return "Agent completed";
    case "action_agent":
      return "Run agent";
    case "path_rules":
      return "Paths";
    case "csv_rows":
      return "CSV rows";
    case "rag_archive":
      return "Archive to RAG";
    case "then_local":
      return "Save locally";
    case "then_google_drive":
      return "Google Drive";
    case "then_email":
      return "Email";
    case "then_scheduled":
      return "Scheduled publish";
    case "then_draft":
      return "Save as draft";
    default:
      return kind;
  }
}
