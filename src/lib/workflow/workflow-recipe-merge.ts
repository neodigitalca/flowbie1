import { recipeToPlan } from "@/lib/automation-planner-compile";
import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";
import { defaultNodeLabel, newWorkflowNodeId } from "@/lib/workflow/workflow-graph-utils";
import {
  ensureRagArchiveNode,
  insertNodesAfter,
  linearOrderedNodes,
} from "@/lib/workflow/workflow-graph-mutations";
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowRagVariable,
} from "@/lib/workflow/workflow-types";

export type RecipeMergeResult = {
  nodes: WorkflowNode[];
  edges: WorkflowDefinition["edges"];
  ragVariables: WorkflowRagVariable[];
  insertedNodeIds: string[];
  triggerConflict?: string;
};

export type RecipeActionSubgraph = {
  nodes: WorkflowNode[];
  ragVariables: WorkflowRagVariable[];
};

function uniqueRagKey(base: string, used: Set<string>): string {
  let key = base.replace(/[^a-z0-9_]/gi, "_");
  if (!used.has(key)) {
    used.add(key);
    return key;
  }
  let index = 2;
  while (used.has(`${key}_${index}`)) index += 1;
  const next = `${key}_${index}`;
  used.add(next);
  return next;
}

export function recipeToActionSubgraph(
  recipe: AutomationRecipeCatalogItem,
  usedKeys: Set<string>,
): RecipeActionSubgraph {
  const plan = recipeToPlan(recipe);
  const actions = plan.actions?.length ? plan.actions : [plan.action];
  const nodes: WorkflowNode[] = [];
  const ragVariables: WorkflowRagVariable[] = [];

  actions.forEach((action, index) => {
    const actionId = newWorkflowNodeId("action_agent");
    const baseKey = `${action.executionKind}_${index + 1}`;
    const variableKey = uniqueRagKey(baseKey, usedKeys);
    const actionTitle = action.title ?? defaultNodeLabel("action_agent");
    nodes.push({
      id: actionId,
      kind: "action_agent",
      label: `${recipe.name} · ${actionTitle}`,
      config: {
        executionKind: action.executionKind,
        executionPayload: action.executionPayload,
        ragVariableKey: variableKey,
        ragScope: "run",
        title: action.title,
        recipeKeyword: recipe.keyword,
        recipeCategory: recipe.category,
      },
      position: { x: 120, y: 80 + (index + 1) * 140 },
    });
    ragVariables.push({
      key: variableKey,
      nodeId: actionId,
      scope: "run",
      label: action.title ?? `${recipe.name} output`,
    });
  });

  return { nodes, ragVariables };
}

export function mergeRecipeIntoWorkflow(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges" | "ragVariables">,
  recipe: AutomationRecipeCatalogItem,
  afterNodeId: string | null,
): RecipeMergeResult {
  const usedKeys = new Set(workflow.ragVariables.map((item) => item.key));
  const subgraph = recipeToActionSubgraph(recipe, usedKeys);
  const plan = recipeToPlan(recipe);

  let anchorId = afterNodeId;
  if (!anchorId) {
    const ordered = linearOrderedNodes(workflow);
    const archive = ordered.find((node) => node.kind === "rag_archive");
    anchorId = archive
      ? ordered[ordered.indexOf(archive) - 1]?.id ?? ordered[0]?.id ?? null
      : ordered[ordered.length - 1]?.id ?? null;
  }

  let graph = insertNodesAfter(workflow, anchorId, subgraph.nodes);
  graph = ensureRagArchiveNode({ ...workflow, ...graph });

  const triggerConflict =
    plan.trigger.kind === "gsc" &&
    workflow.nodes.some((node) => node.kind === "trigger_manual")
      ? "Recipe uses a GSC trigger; only actions were added to this workflow."
      : undefined;

  return {
    nodes: graph.nodes,
    edges: graph.edges,
    ragVariables: [...workflow.ragVariables, ...subgraph.ragVariables],
    insertedNodeIds: subgraph.nodes.map((node) => node.id),
    triggerConflict,
  };
}
