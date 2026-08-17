import React, { useCallback, useEffect, useMemo, useState } from "react";
import { compileWorkflowTasks } from "@/lib/workflow/workflow-compile";
import {
  createWorkflow,
  fetchWorkflow,
  publishWorkflow,
  startWorkflowRun,
  updateWorkflow,
} from "@/lib/workflow/workflow-api";
import { emptyWorkflowDraft, ensureWorkflowClientNode } from "@/lib/workflow/workflow-migrate-from-planner";
import { defaultNodeLabel } from "@/lib/workflow/workflow-graph-utils";
import {
  createWorkflowNode,
  deleteNode,
  duplicateNode,
  insertNodeAfter,
} from "@/lib/workflow/workflow-graph-mutations";
import { mergeRecipeIntoWorkflow } from "@/lib/workflow/workflow-recipe-merge";
import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";
import type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowRagVariable,
} from "@/lib/workflow/workflow-types";
import { WorkflowWorkspaceHeader } from "@/components/manager/workflow/WorkflowWorkspaceHeader";
import { useAgentRunsContext } from "@/contexts/agent-runs-context";
import { isWorkflowClientKind, isWorkflowTriggerKind } from "@/lib/workflow/workflow-types";
import type { WorkflowClientConfig } from "@/lib/workflow/workflow-types";
import { WorkflowRightRail, WorkflowRightRailDraft } from "@/components/manager/workflow/WorkflowRightRail";
import { WorkflowStepColumn } from "@/components/manager/workflow/WorkflowStepColumn";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";
import type { PulseForgeRoute } from "@/lib/pulse-forge/pulse-forge-hash";

export type WorkflowEditorViewProps = {
  teamId: number;
  workflowId: number | null;
  sites: WordPressSiteOption[];
  defaultSiteId?: string | null;
  route: PulseForgeRoute;
  statusMessage?: string | null;
  onCreated: (workflowId: number) => void;
  onCancel: () => void;
  onNameChange?: (name: string) => void;
  onSaveErrorChange?: (error: string | null) => void;
};

export function WorkflowEditorView({
  teamId,
  workflowId,
  sites,
  defaultSiteId,
  route,
  statusMessage,
  onCreated,
  onNameChange,
  onSaveErrorChange,
}: WorkflowEditorViewProps): React.ReactElement {
  const { openSidebar, refreshRuns } = useAgentRunsContext();
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [loading, setLoading] = useState(Boolean(workflowId));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [inspectorNote, setInspectorNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSaveError(null);
    if (!workflowId) {
      const next = buildLocalDraft(teamId, defaultSiteId ?? null);
      setWorkflow(next);
      onNameChange?.(next.name);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    void (async () => {
      const existing = await fetchWorkflow(teamId, workflowId);
      if (!cancelled) {
        const normalized = existing ? ensureWorkflowClientNode(existing, defaultSiteId ?? null) : existing;
        setWorkflow(normalized);
        if (normalized?.name) onNameChange?.(normalized.name);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultSiteId, onNameChange, teamId, workflowId]);

  useEffect(() => {
    onSaveErrorChange?.(saveError);
  }, [onSaveErrorChange, saveError]);

  const selectedNode = useMemo(
    () => workflow?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [selectedNodeId, workflow?.nodes],
  );

  const persist = useCallback(
    async (next: WorkflowDefinition) => {
      setSaving(true);
      setSaveError(null);

      if (!next.id) {
        const created = await createWorkflow(teamId, {
          name: next.name.trim() || "Untitled workflow",
          description: next.description,
          wordpressSiteId: next.wordpressSiteId,
          nodes: next.nodes,
          edges: next.edges,
          ragVariables: next.ragVariables,
        });
        if (!created.workflow) {
          setSaveError(created.error ?? "Could not save workflow");
          setSaving(false);
          return;
        }
        setWorkflow(created.workflow);
        onNameChange?.(created.workflow.name);
        onCreated(created.workflow.id);
        setSaving(false);
        return;
      }

      const result = await updateWorkflow(teamId, next.id, {
        name: next.name.trim() || "Untitled workflow",
        description: next.description,
        wordpressSiteId: next.wordpressSiteId,
        nodes: next.nodes,
        edges: next.edges,
        ragVariables: next.ragVariables,
      });
      if (!result.workflow) {
        setSaveError(result.error ?? "Could not save workflow");
      } else {
        setWorkflow(result.workflow);
        onNameChange?.(result.workflow.name);
      }
      setSaving(false);
    },
    [onCreated, onNameChange, teamId],
  );

  const handleNameChange = useCallback(
    (name: string) => {
      setWorkflow((current) => {
        if (!current) return current;
        const next = { ...current, name };
        onNameChange?.(name);
        return next;
      });
    },
    [onNameChange],
  );

  const applyGraphUpdate = useCallback(
    (
      nodes: WorkflowNode[],
      edges: WorkflowEdge[],
      ragVariables?: WorkflowRagVariable[],
      options?: { selectNodeId?: string | null; note?: string | null },
    ) => {
      setWorkflow((current) => {
        if (!current) return current;
        const nextRag = ragVariables ?? syncRagVariables(nodes, current.ragVariables);
        const next = { ...current, nodes, edges, ragVariables: nextRag };
        if (current.id > 0) void persist(next);
        return next;
      });
      if (options?.selectNodeId) setSelectedNodeId(options.selectNodeId);
      if (options?.note !== undefined) setInspectorNote(options.note);
    },
    [persist],
  );

  const handleNodeChange = useCallback(
    (node: WorkflowNode) => {
      setWorkflow((current) => {
        if (!current) return current;
        const nodes = current.nodes.map((item) => (item.id === node.id ? node : item));
        const ragVariables = syncRagVariables(nodes, current.ragVariables);
        const siteIds = isWorkflowClientKind(node.kind)
          ? ((node.config as WorkflowClientConfig).siteIds ?? [])
          : null;
        const next = {
          ...current,
          nodes,
          ragVariables,
          ...(siteIds != null ? { wordpressSiteId: siteIds[0] ?? null } : {}),
        };
        if (current.id > 0) void persist(next);
        return next;
      });
    },
    [persist],
  );

  const handleAddStep = useCallback(
    (kind: WorkflowNodeKind, afterNodeId: string | null) => {
      if (!workflow) return;
      if (isWorkflowTriggerKind(kind) && workflow.nodes.some((node) => isWorkflowTriggerKind(node.kind))) {
        setInspectorNote("This workflow already has a trigger step.");
        return;
      }
      const node = createWorkflowNode(kind, defaultNodeLabel(kind));
      const graph = insertNodeAfter(workflow, afterNodeId, node);
      applyGraphUpdate(graph.nodes, graph.edges, syncRagVariables(graph.nodes, workflow.ragVariables), {
        selectNodeId: node.id,
        note: null,
      });
    },
    [applyGraphUpdate, workflow],
  );

  const handleAddRecipe = useCallback(
    (recipe: AutomationRecipeCatalogItem, afterNodeId: string | null) => {
      if (!workflow) return;
      const merged = mergeRecipeIntoWorkflow(workflow, recipe, afterNodeId);
      applyGraphUpdate(merged.nodes, merged.edges, merged.ragVariables, {
        selectNodeId: merged.insertedNodeIds[0] ?? null,
        note: merged.triggerConflict ?? null,
      });
    },
    [applyGraphUpdate, workflow],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (!workflow) return;
      const graph = deleteNode(workflow, nodeId);
      if (!graph) return;
      applyGraphUpdate(graph.nodes, graph.edges, undefined, {
        selectNodeId: null,
        note: null,
      });
    },
    [applyGraphUpdate, workflow],
  );

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      if (!workflow) return;
      const graph = duplicateNode(workflow, nodeId);
      if (!graph) return;
      applyGraphUpdate(graph.nodes, graph.edges, undefined, {
        selectNodeId: graph.newNodeId,
        note: null,
      });
    },
    [applyGraphUpdate, workflow],
  );

  const handleSave = useCallback(() => {
    if (workflow) void persist(workflow);
  }, [persist, workflow]);

  const handlePublish = useCallback(async () => {
    if (!workflow?.id) return;
    setSaving(true);
    const compiled = await compileWorkflowTasks(teamId, workflow);
    await updateWorkflow(teamId, compiled.id, {
      nodes: compiled.nodes,
      edges: compiled.edges,
      ragVariables: compiled.ragVariables,
    });
    const result = await publishWorkflow(teamId, compiled.id);
    if (result.workflow) setWorkflow(result.workflow);
    setSaving(false);
  }, [teamId, workflow]);

  const handleTestRun = useCallback(async () => {
    if (!workflow?.id) return;
    setRunning(true);
    openSidebar();
    const result = await startWorkflowRun(teamId, workflow.id, { simulated: true });
    if (result.run?.id) setActiveRunId(result.run.id);
    void refreshRuns();
    setRunning(false);
  }, [openSidebar, refreshRuns, teamId, workflow?.id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <p className="text-base text-muted-foreground">Loading workflow…</p>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex h-full items-center justify-center bg-black px-6">
        <p className="text-base text-red-400">Workflow not found.</p>
      </div>
    );
  }

  const isUnsaved = workflow.id <= 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-black">
      <WorkflowWorkspaceHeader
        route={route}
        workflowName={workflow.name}
        statusMessage={statusMessage ?? saveError}
        name={workflow.name}
        saving={saving}
        running={running}
        onNameChange={handleNameChange}
        onSave={handleSave}
        onPublish={() => void handlePublish()}
        onTestRun={() => void handleTestRun()}
        publishDisabled={isUnsaved}
        testDisabled={isUnsaved}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <WorkflowStepColumn
          teamId={teamId}
          workflow={workflow}
          sites={sites}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onAddStep={handleAddStep}
          onAddRecipe={handleAddRecipe}
          onDeleteNode={handleDeleteNode}
          onDuplicateNode={handleDuplicateNode}
        />
        {workflow.id > 0 ? (
          <WorkflowRightRail
            teamId={teamId}
            workflowId={workflow.id}
            sites={sites}
            nodes={workflow.nodes}
            edges={workflow.edges}
            selectedNode={selectedNode}
            ragVariables={workflow.ragVariables}
            activeRunId={activeRunId}
            inspectorNote={inspectorNote}
            onNodeChange={handleNodeChange}
          />
        ) : (
          <WorkflowRightRailDraft
            sites={sites}
            nodes={workflow.nodes}
            edges={workflow.edges}
            selectedNode={selectedNode}
            ragVariables={workflow.ragVariables}
            inspectorNote={inspectorNote}
            onNodeChange={handleNodeChange}
          />
        )}
      </div>
    </div>
  );
}

function buildLocalDraft(teamId: number, siteId?: string | null): WorkflowDefinition {
  return {
    id: 0,
    ...emptyWorkflowDraft(teamId, siteId),
  };
}

function syncRagVariables(nodes: WorkflowNode[], current: WorkflowRagVariable[]): WorkflowRagVariable[] {
  const actionNodes = nodes.filter((node) => node.kind === "action_agent");
  return actionNodes.map((node) => {
    const config = node.config as { ragVariableKey?: string; ragScope?: WorkflowRagVariable["scope"]; title?: string };
    const key = config.ragVariableKey ?? node.id;
    const existing = current.find((item) => item.nodeId === node.id);
    return {
      key,
      nodeId: node.id,
      scope: "run",
      label: config.title ?? node.label ?? key,
    };
  });
}
