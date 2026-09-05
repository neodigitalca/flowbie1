import { linearOrderedNodes } from "@/lib/workflow/workflow-graph-mutations";
import {
  createWorkflowNode,
  defaultNodeConfig,
  insertNodeAfter,
  rewireLinearChain,
  syncLinearPositions,
} from "@/lib/workflow/workflow-graph-mutations";
import { defaultThenVariableKey } from "@/lib/workflow/workflow-then-utils";
import type {
  WorkflowActionConfig,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowThenStepConfig,
} from "@/lib/workflow/workflow-types";
import { isWorkflowThenKind } from "@/lib/workflow/workflow-types";
import { stripInlineDeliveryFlags } from "@/lib/workflow/workflow-then-utils";

function stripDeliveryFromPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    ...payload,
    sendAutomationEmail: false,
    saveToGoogleDrive: false,
  };
}

function stripThenNodesAfterAgent(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  agentNodeId: string,
): { nodes: WorkflowNode[]; edges: WorkflowEdge[]; removed: boolean } {
  const ordered = linearOrderedNodes({ nodes, edges });
  const agentIndex = ordered.findIndex((node) => node.id === agentNodeId);
  if (agentIndex < 0) return { nodes, edges, removed: false };

  const removeIds = new Set<string>();
  for (let i = agentIndex + 1; i < ordered.length; i += 1) {
    const step = ordered[i];
    if (!step || !isWorkflowThenKind(step.kind)) break;
    removeIds.add(step.id);
  }
  if (removeIds.size === 0) return { nodes, edges, removed: false };

  const nextNodes = nodes.filter((node) => !removeIds.has(node.id));
  const nextEdges = edges.filter((edge) => !removeIds.has(edge.source) && !removeIds.has(edge.target));
  const positioned = syncLinearPositions(
    linearOrderedNodes({ nodes: nextNodes, edges: nextEdges }),
  );
  return {
    nodes: positioned,
    edges: rewireLinearChain(positioned, nextEdges),
    removed: true,
  };
}

/** True when an agent still carries inline delivery flags and needs Then-node migration. */
export function workflowNeedsThenMigration(
  workflow: Pick<WorkflowDefinition, "nodes">,
): boolean {
  return workflow.nodes.some((node) => {
    if (node.kind !== "action_agent") return false;
    const payload = (node.config as WorkflowActionConfig).executionPayload ?? {};
    return payload.sendAutomationEmail === true || payload.saveToGoogleDrive === true;
  });
}

/** Merge Then step delivery settings back into the agent payload for the Forge Then tab. */
export function readWorkflowAgentThenPayload(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">,
  agentNodeId: string,
): Record<string, unknown> | undefined {
  const agent = workflow.nodes.find((node) => node.id === agentNodeId && node.kind === "action_agent");
  if (!agent) return undefined;

  const actionConfig = agent.config as WorkflowActionConfig;
  const merged = { ...(actionConfig.executionPayload ?? {}) } as Record<string, unknown>;
  const ordered = linearOrderedNodes(workflow);
  const agentIndex = ordered.findIndex((node) => node.id === agentNodeId);
  if (agentIndex < 0) return merged;

  for (let i = agentIndex + 1; i < ordered.length; i += 1) {
    const step = ordered[i];
    if (!step || !isWorkflowThenKind(step.kind)) break;
    const thenPayload = ((step.config as WorkflowThenStepConfig).executionPayload ?? {}) as Record<
      string,
      unknown
    >;

    if (step.kind === "then_email" || thenPayload.sendAutomationEmail === true) {
      merged.sendAutomationEmail = true;
      if (thenPayload.automationEmailTo != null) merged.automationEmailTo = thenPayload.automationEmailTo;
      if (thenPayload.automationEmailCc != null) merged.automationEmailCc = thenPayload.automationEmailCc;
      if (thenPayload.automationEmailMessage != null) {
        merged.automationEmailMessage = thenPayload.automationEmailMessage;
      }
    }
    if (step.kind === "then_google_drive" || thenPayload.saveToGoogleDrive === true) {
      merged.saveToGoogleDrive = true;
      if (thenPayload.googleDriveFolderId != null) {
        merged.googleDriveFolderId = thenPayload.googleDriveFolderId;
      }
      if (thenPayload.googleDriveFolderLabel != null) {
        merged.googleDriveFolderLabel = thenPayload.googleDriveFolderLabel;
      }
      if (thenPayload.googleDrivePresetKey != null) {
        merged.googleDrivePresetKey = thenPayload.googleDrivePresetKey;
      }
    }
    if (step.kind === "then_local" || thenPayload.saveLocalArchive === true) {
      merged.saveLocalArchive = true;
    }
  }

  return merged;
}

/** Clear stale inline delivery flags on agents without touching existing Then nodes. */
export function stripAllAgentInlineDelivery(workflow: WorkflowDefinition): WorkflowDefinition {
  let changed = false;
  const nodes = workflow.nodes.map((node) => {
    if (node.kind !== "action_agent") return node;
    const config = node.config as WorkflowActionConfig;
    const payload = { ...(config.executionPayload ?? {}) } as Record<string, unknown>;
    const stripped = stripInlineDeliveryFlags({
      ...payload,
      saveLocalArchive: false,
    });
    const hadInlineDelivery =
      payload.sendAutomationEmail === true
      || payload.saveToGoogleDrive === true
      || payload.saveLocalArchive === true
      || String(payload.automationEmailTo ?? "").trim() !== ""
      || String(payload.googleDriveFolderId ?? "").trim() !== "";
    if (!hadInlineDelivery) return node;
    changed = true;
    return {
      ...node,
      config: {
        ...config,
        executionPayload: stripped,
      },
    };
  });
  if (!changed) return workflow;
  return { ...workflow, nodes };
}

export function migrateWorkflowThenStepsFromAgents(
  workflow: WorkflowDefinition,
): Pick<WorkflowDefinition, "nodes" | "edges" | "ragVariables"> {
  let nodes = [...workflow.nodes];
  let edges = [...workflow.edges];
  let changed = false;

  for (const node of [...nodes]) {
    if (node.kind !== "action_agent") continue;
    const actionConfig = node.config as WorkflowActionConfig;
    const payload = { ...(actionConfig.executionPayload ?? {}) } as Record<string, unknown>;
    const wantsDrive = payload.saveToGoogleDrive === true;
    const wantsEmail = payload.sendAutomationEmail === true;

    const strippedGraph = stripThenNodesAfterAgent(nodes, edges, node.id);
    if (strippedGraph.removed) {
      nodes = strippedGraph.nodes;
      edges = strippedGraph.edges;
      changed = true;
    }

    if (!wantsDrive && !wantsEmail) continue;

    let anchorId = node.id;
    const nextPayload = stripDeliveryFromPayload(payload);

    if (wantsDrive) {
      const driveNode = createWorkflowNode("then_google_drive", "Google Drive");
      const driveVariableKey = defaultThenVariableKey(driveNode);
      driveNode.config = {
        ...defaultNodeConfig("then_google_drive"),
        inputVariableKey: String(actionConfig.ragVariableKey ?? `step_${node.id}`),
        inputNodeId: node.id,
        executionPayload: {
          saveToGoogleDrive: true,
          saveLocalArchive: true,
          googleDriveFolderId: payload.googleDriveFolderId,
          googleDriveFolderLabel: payload.googleDriveFolderLabel,
          googleDrivePresetKey: payload.googleDrivePresetKey,
        },
      };
      const inserted = insertNodeAfter({ nodes, edges }, anchorId, driveNode);
      nodes = inserted.nodes;
      edges = inserted.edges;
      anchorId = driveNode.id;
      changed = true;

      if (wantsEmail) {
        const emailNode = createWorkflowNode("then_email", "Email");
        emailNode.config = {
          ...defaultNodeConfig("then_email"),
          inputVariableKey: driveVariableKey,
          inputNodeId: anchorId,
          executionPayload: {
            sendAutomationEmail: true,
            saveLocalArchive: true,
            automationEmailTo: payload.automationEmailTo,
            automationEmailCc: payload.automationEmailCc,
            automationEmailMessage: payload.automationEmailMessage,
          },
        };
        const emailInserted = insertNodeAfter({ nodes, edges }, anchorId, emailNode);
        nodes = emailInserted.nodes;
        edges = emailInserted.edges;
        changed = true;
      }
    } else if (wantsEmail) {
      const emailNode = createWorkflowNode("then_email", "Email");
      emailNode.config = {
        ...defaultNodeConfig("then_email"),
        inputVariableKey: String(actionConfig.ragVariableKey ?? `step_${node.id}`),
        inputNodeId: anchorId,
        executionPayload: {
          sendAutomationEmail: true,
          saveLocalArchive: true,
          automationEmailTo: payload.automationEmailTo,
          automationEmailCc: payload.automationEmailCc,
          automationEmailMessage: payload.automationEmailMessage,
        },
      };
      const inserted = insertNodeAfter({ nodes, edges }, anchorId, emailNode);
      nodes = inserted.nodes;
      edges = inserted.edges;
      changed = true;
    }

    nodes = nodes.map((item) =>
      item.id === node.id
        ? {
            ...item,
            config: {
              ...actionConfig,
              executionPayload: nextPayload,
            },
          }
        : item,
    );
    changed = true;
  }

  if (!changed) {
    return { nodes: workflow.nodes, edges: workflow.edges, ragVariables: workflow.ragVariables };
  }

  const positioned = syncLinearPositions(linearOrderedNodes({ nodes, edges }));
  return {
    nodes: positioned,
    edges: rewireLinearChain(positioned, edges),
    ragVariables: workflow.ragVariables,
  };
}
