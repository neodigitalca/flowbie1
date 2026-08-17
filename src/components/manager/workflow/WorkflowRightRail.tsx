import React, { useEffect, useState } from "react";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";
import { WorkflowNodeInspector } from "@/components/manager/workflow/WorkflowNodeInspector";
import { WorkflowRagSidebar } from "@/components/manager/workflow/WorkflowRagSidebar";
import {
  WORKFLOW_RIGHT_RAIL_CLASS,
  WORKFLOW_RAIL_TAB_CLASS,
} from "@/components/manager/workflow/forge-workflow-styles";
import type { WorkflowEdge, WorkflowNode, WorkflowRagVariable } from "@/lib/workflow/workflow-types";
import { cn } from "@/lib/utils";

export type WorkflowRightRailProps = {
  teamId: number;
  workflowId: number;
  sites: WordPressSiteOption[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNode: WorkflowNode | null;
  ragVariables: WorkflowRagVariable[];
  activeRunId: number | null;
  inspectorNote?: string | null;
  onNodeChange: (node: WorkflowNode) => void;
};

export function WorkflowRightRail({
  teamId,
  workflowId,
  sites,
  nodes,
  edges,
  selectedNode,
  ragVariables,
  activeRunId,
  inspectorNote,
  onNodeChange,
}: WorkflowRightRailProps): React.ReactElement {
  const [tab, setTab] = useState<"setup" | "rag">("setup");

  useEffect(() => {
    if (activeRunId) setTab("rag");
  }, [activeRunId]);

  return (
    <aside className={WORKFLOW_RIGHT_RAIL_CLASS}>
      <div className="flex shrink-0 border-b border-white/10">
        <button
          type="button"
          data-active={tab === "setup"}
          className={cn(WORKFLOW_RAIL_TAB_CLASS)}
          onClick={() => setTab("setup")}
        >
          Setup
        </button>
        <button
          type="button"
          data-active={tab === "rag"}
          className={cn(WORKFLOW_RAIL_TAB_CLASS)}
          onClick={() => setTab("rag")}
        >
          RAG
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "setup" ? (
          <div className="flex h-full flex-col overflow-hidden">
            {inspectorNote ? (
              <div className="shrink-0 bg-zinc-900/50 px-6 py-3">
                <p className="text-lg text-[hsl(var(--semantic-warning-foreground))]">{inspectorNote}</p>
              </div>
            ) : null}
            <WorkflowNodeInspector
              node={selectedNode}
              nodes={nodes}
              edges={edges}
              ragVariables={ragVariables}
              sites={sites}
              onChange={onNodeChange}
            />
          </div>
        ) : (
          <WorkflowRagSidebar teamId={teamId} workflowId={workflowId} activeRunId={activeRunId} />
        )}
      </div>
    </aside>
  );
}

export type WorkflowRightRailDraftProps = {
  sites: WordPressSiteOption[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNode: WorkflowNode | null;
  ragVariables: WorkflowRagVariable[];
  inspectorNote?: string | null;
  onNodeChange: (node: WorkflowNode) => void;
};

export function WorkflowRightRailDraft({
  sites,
  nodes,
  edges,
  selectedNode,
  ragVariables,
  inspectorNote,
  onNodeChange,
}: WorkflowRightRailDraftProps): React.ReactElement {
  return (
    <aside className={WORKFLOW_RIGHT_RAIL_CLASS}>
      <div className="shrink-0 border-b border-white/10 px-6 py-4">
        <p className="text-base font-normal text-white">Setup</p>
      </div>
      {inspectorNote ? (
        <div className="shrink-0 bg-zinc-900/50 px-6 py-3">
          <p className="text-base text-[hsl(var(--semantic-warning-foreground))]">{inspectorNote}</p>
        </div>
      ) : null}
      <WorkflowNodeInspector
        node={selectedNode}
        nodes={nodes}
        edges={edges}
        ragVariables={ragVariables}
        sites={sites}
        onChange={onNodeChange}
      />
    </aside>
  );
}
