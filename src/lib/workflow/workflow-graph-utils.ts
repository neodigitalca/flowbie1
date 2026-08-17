import type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeKind,
} from "@/lib/workflow/workflow-types";
import { isWorkflowTriggerKind, isWorkflowClientKind } from "@/lib/workflow/workflow-types";

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
    case "trigger_manual":
      return "Manual trigger";
    case "trigger_agent_done":
      return "Agent completed";
    case "action_agent":
      return "Run agent";
    case "path_rules":
      return "Paths";
    case "rag_archive":
      return "Archive to RAG";
    default:
      return kind;
  }
}
