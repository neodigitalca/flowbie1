import { linearOrderedNodes } from "@/lib/workflow/workflow-graph-mutations";
import { nodeById, resolveWorkflowRunStart } from "@/lib/workflow/workflow-graph-utils";
import type { WorkflowDefinition } from "@/lib/workflow/workflow-types";
import { isWorkflowThenKind } from "@/lib/workflow/workflow-types";

export function workflowHasActionAgent(workflow: Pick<WorkflowDefinition, "nodes">): boolean {
  return workflow.nodes.some((node) => node.kind === "action_agent");
}

/** Block Test and manual runs when the graph skips agents and jumps straight to Then/archive steps. */
export function validateWorkflowForRun(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">,
): { ok: true } | { ok: false; error: string } {
  if (!workflowHasActionAgent(workflow)) {
    return {
      ok: false,
      error:
        "This workflow has no agent step. Add GSC, Local Dominator, or another agent between Schedule and Then steps, then save and Test again.",
    };
  }

  const start = resolveWorkflowRunStart(workflow);
  if (!start) {
    return { ok: false, error: "Workflow has no runnable steps." };
  }

  const firstNode = nodeById(workflow.nodes, start.firstWalkNodeId);
  if (!firstNode) {
    return { ok: false, error: "Workflow entry step is missing." };
  }

  if (firstNode.kind === "rag_archive" || isWorkflowThenKind(firstNode.kind)) {
    const ordered = linearOrderedNodes(workflow);
    const firstIndex = ordered.findIndex((node) => node.id === firstNode.id);
    const priorAgent = ordered.slice(0, firstIndex).some((node) => node.kind === "action_agent");
    if (!priorAgent) {
      return {
        ok: false,
        error:
          "Then and archive steps run after an agent. Add an agent step before Google Drive or email.",
      };
    }
  }

  return { ok: true };
}
