import { linearOrderedNodes } from "@/lib/workflow/workflow-graph-mutations";
import { workflowOutputsToContextBlocks } from "@/lib/workflow/workflow-context-inject";
import type {
  WorkflowActionConfig,
  WorkflowDefinition,
  WorkflowRagVariable,
  WorkflowStepOutput,
} from "@/lib/workflow/workflow-types";

export type WorkflowActionConfigWithRag = WorkflowActionConfig & {
  upstreamVariable?: string;
  ragInputKeys?: string[];
};

export function resolveRagInputKeys(config: WorkflowActionConfigWithRag): string[] {
  if (Array.isArray(config.ragInputKeys) && config.ragInputKeys.length > 0) {
    return config.ragInputKeys;
  }
  const legacy = config.upstreamVariable?.trim();
  return legacy ? [legacy] : [];
}

export function upstreamRagVariablesForNode(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges" | "ragVariables">,
  nodeId: string,
): WorkflowRagVariable[] {
  const ordered = linearOrderedNodes(workflow);
  const nodeIndex = ordered.findIndex((node) => node.id === nodeId);
  if (nodeIndex <= 0) return [];

  const priorActionIds = new Set(
    ordered
      .slice(0, nodeIndex)
      .filter((node) => node.kind === "action_agent")
      .map((node) => node.id),
  );

  return workflow.ragVariables.filter(
    (variable) => priorActionIds.has(variable.nodeId) && variable.scope === "run",
  );
}

export function buildRunContextBlock(
  outputs: WorkflowStepOutput[],
  ragInputKeys: string[],
): string {
  const keys = new Set(ragInputKeys);
  const runOutputs = outputs.filter(
    (output) => output.scope === "run" && keys.has(output.variableKey),
  );
  return workflowOutputsToContextBlocks(runOutputs);
}
