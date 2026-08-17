import {
  defaultNodeLabel,
  findClientNode,
  findTriggerNode,
  newWorkflowNodeId,
  nodeById,
  outgoingEdges,
} from "@/lib/workflow/workflow-graph-utils";
import type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeKind,
} from "@/lib/workflow/workflow-types";
import { isWorkflowClientKind, isWorkflowTriggerKind } from "@/lib/workflow/workflow-types";

const STEP_Y_GAP = 140;
const STEP_X = 120;
const STEP_Y_START = 80;

export function linearOrderedNodes(workflow: Pick<WorkflowDefinition, "nodes" | "edges">): WorkflowNode[] {
  const client = findClientNode(workflow);
  const trigger = findTriggerNode(workflow);
  const ordered: WorkflowNode[] = [];
  const visited = new Set<string>();

  if (client) {
    ordered.push(client);
    visited.add(client.id);
  }

  if (trigger) {
    ordered.push(trigger);
    visited.add(trigger.id);
    let currentId = trigger.id;

    while (true) {
      const nextEdges = outgoingEdges(workflow.edges, currentId);
      if (nextEdges.length === 0) break;
      const nextId = nextEdges[0]?.target;
      if (!nextId || visited.has(nextId)) break;
      const nextNode = nodeById(workflow.nodes, nextId);
      if (!nextNode || isWorkflowClientKind(nextNode.kind)) break;
      ordered.push(nextNode);
      visited.add(nextId);
      currentId = nextId;
    }
  }

  for (const node of workflow.nodes) {
    if (!visited.has(node.id)) ordered.push(node);
  }

  if (ordered.length === 0) return [...workflow.nodes];
  return ordered;
}

export function findRagArchiveNode(workflow: Pick<WorkflowDefinition, "nodes">): WorkflowNode | null {
  return workflow.nodes.find((node) => node.kind === "rag_archive") ?? null;
}

export function syncLinearPositions(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node, index) => ({
    ...node,
    position: { x: STEP_X, y: STEP_Y_START + index * STEP_Y_GAP },
  }));
}

export function rewireLinearChain(nodes: WorkflowNode[], _edges: WorkflowEdge[] = []): WorkflowEdge[] {
  const ordered = [...nodes].sort((a, b) => a.position.y - b.position.y);
  const nextEdges: WorkflowEdge[] = [];
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const source = ordered[index]!;
    const target = ordered[index + 1]!;
    nextEdges.push({
      id: `e_${source.id}_${target.id}`,
      source: source.id,
      target: target.id,
    });
  }
  return nextEdges;
}

export function insertNodesAfter(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges" | "ragVariables">,
  afterNodeId: string | null,
  newNodes: WorkflowNode[],
): Pick<WorkflowDefinition, "nodes" | "edges"> {
  if (newNodes.length === 0) {
    return { nodes: workflow.nodes, edges: workflow.edges };
  }

  const ordered = linearOrderedNodes(workflow);
  const anchorId =
    afterNodeId ??
    findClientNode(workflow)?.id ??
    ordered.find((node) => node.kind === "rag_archive")?.id ??
    ordered[ordered.length - 1]?.id ??
    findTriggerNode(workflow)?.id ??
    null;

  if (!anchorId) {
    const nodes = syncLinearPositions([...newNodes]);
    return { nodes, edges: rewireLinearChain(nodes, workflow.edges) };
  }

  const anchorIndex = ordered.findIndex((node) => node.id === anchorId);
  const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : ordered.length;
  const before = ordered.slice(0, insertIndex);
  const after = ordered.slice(insertIndex);
  const merged = [...before, ...newNodes, ...after];
  const existingIds = new Set(workflow.nodes.map((node) => node.id));
  const appended = workflow.nodes.filter((node) => !merged.some((item) => item.id === node.id));
  const nodes = syncLinearPositions([...merged, ...appended]);
  return { nodes, edges: rewireLinearChain(nodes, workflow.edges) };
}

export function insertNodeAfter(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges" | "ragVariables">,
  afterNodeId: string | null,
  node: WorkflowNode,
): Pick<WorkflowDefinition, "nodes" | "edges"> {
  return insertNodesAfter(workflow, afterNodeId, [node]);
}

export function deleteNode(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">,
  nodeId: string,
): Pick<WorkflowDefinition, "nodes" | "edges"> | null {
  const target = nodeById(workflow.nodes, nodeId);
  if (!target || isWorkflowClientKind(target.kind)) return null;

  const remaining = workflow.nodes.filter((node) => node.id !== nodeId);
  const positioned = syncLinearPositions(
    linearOrderedNodes({ nodes: remaining, edges: workflow.edges }).filter((node) => node.id !== nodeId),
  );
  return { nodes: positioned, edges: rewireLinearChain(positioned, workflow.edges) };
}

export function duplicateNode(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">,
  nodeId: string,
): { nodes: WorkflowNode[]; edges: WorkflowEdge[]; newNodeId: string } | null {
  const source = nodeById(workflow.nodes, nodeId);
  if (!source || isWorkflowTriggerKind(source.kind) || isWorkflowClientKind(source.kind)) return null;

  const cloneId = newWorkflowNodeId(source.kind);
  const clone: WorkflowNode = {
    ...source,
    id: cloneId,
    label: `${source.label} copy`,
    config: structuredClone(source.config),
  };
  const inserted = insertNodeAfter(workflow, nodeId, clone);
  return { ...inserted, newNodeId: cloneId };
}

export function defaultNodeConfig(kind: WorkflowNodeKind): Record<string, unknown> {
  switch (kind) {
    case "workflow_client":
      return { siteIds: [] };
    case "action_agent":
      return {
        executionKind: "content_optimizer_meta",
        executionPayload: { targetBucket: "pages" },
        ragVariableKey: `step_${Date.now()}`,
        ragScope: "run",
        ragInputKeys: [],
      };
    case "path_rules":
      return {
        branches: [
          { branchId: "branch_a", label: "Path A", match: "any", conditions: [] },
          { branchId: "default", label: "Default", match: "all", conditions: [] },
        ],
      };
    case "trigger_gsc":
      return { targetBucket: "pages", triggerConfig: { conditions: [], match: "any", sources: ["gsc"] } };
    case "rag_archive":
      return { variableKey: "workflow_output", scope: "run" };
    default:
      return {};
  }
}

export function createWorkflowNode(kind: WorkflowNodeKind, label?: string): WorkflowNode {
  return {
    id: newWorkflowNodeId(kind),
    kind,
    label: label ?? defaultNodeLabel(kind),
    config: defaultNodeConfig(kind),
    position: { x: STEP_X, y: STEP_Y_START },
  };
}

export function ensureRagArchiveNode(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges" | "ragVariables">,
): Pick<WorkflowDefinition, "nodes" | "edges"> {
  if (findRagArchiveNode(workflow)) {
    return { nodes: workflow.nodes, edges: workflow.edges };
  }

  const ordered = linearOrderedNodes(workflow);
  const lastAction = [...ordered].reverse().find((node) => node.kind === "action_agent");
  const variableKey =
    workflow.ragVariables[workflow.ragVariables.length - 1]?.key ??
    (lastAction?.config as { ragVariableKey?: string })?.ragVariableKey ??
    "workflow_output";

  const archive = createWorkflowNode("rag_archive", "Archive to RAG");
  archive.config = { variableKey, scope: "run" };
  const anchorId = ordered[ordered.length - 1]?.id ?? findTriggerNode(workflow)?.id ?? null;
  return insertNodeAfter(workflow, anchorId, archive);
}
