import React, { useState } from "react";
import { Plus } from "lucide-react";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";
import { WorkflowInsertMenu } from "@/components/manager/workflow/WorkflowInsertMenu";
import { WorkflowStepCard } from "@/components/manager/workflow/WorkflowStepCard";
import {
  WORKFLOW_BUILDER_CANVAS_CLASS,
  WORKFLOW_COLUMN_CLASS,
  WORKFLOW_CONNECTOR_CLASS,
  WORKFLOW_INSERT_BTN_CLASS,
} from "@/components/manager/workflow/forge-workflow-styles";
import { linearOrderedNodes } from "@/lib/workflow/workflow-graph-mutations";
import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";
import type { WorkflowDefinition, WorkflowNodeKind } from "@/lib/workflow/workflow-types";
import { isWorkflowClientKind, isWorkflowTriggerKind } from "@/lib/workflow/workflow-types";

export type WorkflowStepColumnProps = {
  teamId: number;
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">;
  sites: WordPressSiteOption[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onAddStep: (kind: WorkflowNodeKind, afterNodeId: string | null) => void;
  onAddRecipe: (recipe: AutomationRecipeCatalogItem, afterNodeId: string | null) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
};

export function WorkflowStepColumn({
  teamId,
  workflow,
  sites,
  selectedNodeId,
  onSelectNode,
  onAddStep,
  onAddRecipe,
  onDeleteNode,
  onDuplicateNode,
}: WorkflowStepColumnProps): React.ReactElement {
  const ordered = linearOrderedNodes(workflow);
  const [insertAfterId, setInsertAfterId] = useState<string | null | undefined>(undefined);

  return (
    <div className={WORKFLOW_BUILDER_CANVAS_CLASS}>
      <div className={WORKFLOW_COLUMN_CLASS}>
        {ordered.map((node, index) => (
          <React.Fragment key={node.id}>
            <WorkflowStepCard
              node={node}
              stepNumber={index + 1}
              selected={selectedNodeId === node.id}
              sites={sites}
              onSelect={() => onSelectNode(node.id)}
              onDelete={
                isWorkflowClientKind(node.kind) ? undefined : () => onDeleteNode(node.id)
              }
              onDuplicate={
                isWorkflowTriggerKind(node.kind) || isWorkflowClientKind(node.kind)
                  ? undefined
                  : () => onDuplicateNode(node.id)
              }
            />
            <div className="flex flex-col items-center">
              <div className={WORKFLOW_CONNECTOR_CLASS} aria-hidden />
              <button
                type="button"
                className={WORKFLOW_INSERT_BTN_CLASS}
                aria-label={`Add step after ${node.label}`}
                onClick={() => setInsertAfterId(node.id)}
              >
                <Plus className="h-4 w-4 text-primary" />
              </button>
              <div className={WORKFLOW_CONNECTOR_CLASS} aria-hidden />
            </div>
          </React.Fragment>
        ))}
        <button
          type="button"
          className="mt-2 flex w-full items-center justify-center gap-2 bg-zinc-950 px-4 py-3 text-base text-muted-foreground shadow-tile hover:shadow-tile-pop hover:text-white"
          onClick={() => setInsertAfterId(null)}
        >
          <Plus className="h-4 w-4 text-primary" />
          Add step
        </button>
      </div>

      <WorkflowInsertMenu
        teamId={teamId}
        open={insertAfterId !== undefined}
        onOpenChange={(open) => {
          if (!open) setInsertAfterId(undefined);
        }}
        onAddStep={(kind) => onAddStep(kind, insertAfterId ?? null)}
        onAddRecipe={(recipe) => onAddRecipe(recipe, insertAfterId ?? null)}
      />
    </div>
  );
}
