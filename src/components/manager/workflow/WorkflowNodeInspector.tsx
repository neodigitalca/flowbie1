import React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TaskFormDatePicker,
  TaskFormFlatSelectPlaceholder,
  TaskFormTimePicker,
} from "@/components/manager/tasks/TaskFormLayout";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";
import {
  WorkflowInspectorField,
  WorkflowInspectorFieldGrid,
  WorkflowInspectorGroup,
  WorkflowInspectorKindHeader,
  WorkflowInspectorTile,
} from "@/components/manager/workflow/WorkflowInspectorLayout";
import {
  WORKFLOW_INSPECTOR_FIELD_CELL_CLASS,
  WORKFLOW_FORM_FLAT_CONTROL_CLASS,
  WORKFLOW_FORM_SELECT_CONTENT_CLASS,
  WORKFLOW_FORM_SELECT_ITEM_CLASS,
  WORKFLOW_FORM_SELECT_TRIGGER_CLASS,
} from "@/components/manager/workflow/forge-workflow-styles";
import { defaultGscTriggerConfig } from "@/lib/workflow/workflow-migrate-from-planner";
import {
  resolveRagInputKeys,
  upstreamRagVariablesForNode,
} from "@/lib/workflow/workflow-rag-utils";
import type {
  WorkflowClientConfig,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowPathBranchConfig,
  WorkflowRagVariable,
} from "@/lib/workflow/workflow-types";
import type { TaskExecutionKind } from "@/lib/tasks-types";

const EXECUTION_KINDS: TaskExecutionKind[] = [
  "content_optimizer_meta",
  "content_optimizer",
  "gsc_reporting",
  "post_creator",
  "local_dominator_export",
];

const FREQUENCY_OPTIONS = ["once", "daily", "weekly", "monthly", "yearly"].map((freq) => ({
  value: freq,
  label: freq.charAt(0).toUpperCase() + freq.slice(1),
}));

export type WorkflowNodeInspectorProps = {
  node: WorkflowNode | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  ragVariables: WorkflowRagVariable[];
  sites: WordPressSiteOption[];
  onChange: (node: WorkflowNode) => void;
};

export function WorkflowNodeInspector({
  node,
  nodes,
  edges,
  ragVariables,
  sites,
  onChange,
}: WorkflowNodeInspectorProps): React.ReactElement {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center bg-black p-4">
        <p className="text-lg text-muted-foreground">Select a step to edit.</p>
      </div>
    );
  }

  const patchConfig = (patch: Record<string, unknown>) => {
    onChange({ ...node, config: { ...(node.config as Record<string, unknown>), ...patch } });
  };

  const clientConfig = node.config as WorkflowClientConfig;
  const primaryClientSiteId = clientConfig.siteIds?.[0];

  return (
    <WorkflowInspectorTile>
      {node.kind === "workflow_client" ? (
        <WorkflowInspectorGroup>
          <TaskFormFlatSelectPlaceholder
            placeholder="Client"
            value={primaryClientSiteId ?? ""}
            onChange={(value) => patchConfig({ siteIds: value ? [value] : [] })}
            options={sites.map((site) => ({ value: site.id, label: site.name }))}
            className={WORKFLOW_INSPECTOR_FIELD_CELL_CLASS}
          />
        </WorkflowInspectorGroup>
      ) : (
        <WorkflowInspectorKindHeader
          kind={node.kind as WorkflowNodeKind}
          title={node.label}
          onTitleChange={(label) => onChange({ ...node, label })}
        />
      )}

      {node.kind === "trigger_manual" ? (
        <WorkflowInspectorGroup title="When">
          <p className="text-lg text-muted-foreground">
            Runs when you test or publish this workflow manually.
          </p>
        </WorkflowInspectorGroup>
      ) : null}

      {node.kind === "trigger_calendar" ? (
        <WorkflowInspectorGroup title="When">
          <WorkflowInspectorFieldGrid>
            <TaskFormFlatSelectPlaceholder
              placeholder="Frequency"
              value={String((node.config as { frequency?: string }).frequency ?? "daily")}
              onChange={(value) => patchConfig({ frequency: value })}
              options={FREQUENCY_OPTIONS}
              className={WORKFLOW_INSPECTOR_FIELD_CELL_CLASS}
            />
            <TaskFormDatePicker
              placeholder="Start date"
              value={String((node.config as { startDate?: string }).startDate ?? "")}
              onChange={(startDate) => patchConfig({ startDate })}
            />
            <TaskFormTimePicker
              placeholder="Time"
              value={String((node.config as { time?: string }).time ?? "09:00")}
              onChange={(time) => patchConfig({ time })}
            />
          </WorkflowInspectorFieldGrid>
        </WorkflowInspectorGroup>
      ) : null}

      {node.kind === "trigger_gsc" ? (
        <WorkflowInspectorGroup title="When">
          <p className="text-lg text-muted-foreground">
            Uses team GSC connection and inventory bucket from action payload.
          </p>
          <button
            type="button"
            className="w-fit bg-black px-4 py-3 text-lg text-white shadow-tile hover:shadow-tile-pop"
            onClick={() => patchConfig({ triggerConfig: defaultGscTriggerConfig(), targetBucket: "pages" })}
          >
            Reset GSC defaults
          </button>
        </WorkflowInspectorGroup>
      ) : null}

      {node.kind === "trigger_document" ? (
        <WorkflowInspectorGroup title="When">
          <WorkflowInspectorFieldGrid>
            <TaskFormFlatSelectPlaceholder
              placeholder="Document source"
              value={String((node.config as { source?: string }).source ?? "task_file")}
              onChange={(value) => patchConfig({ source: value })}
              options={[
                { value: "task_file", label: "Task file" },
                { value: "kb", label: "Knowledge base" },
                { value: "email", label: "Email attachment" },
              ]}
              className={WORKFLOW_INSPECTOR_FIELD_CELL_CLASS}
            />
            <WorkflowInspectorField>
              <Input
                id="wf-doc-name"
                value={String((node.config as { nameContains?: string }).nameContains ?? "")}
                onChange={(event) => patchConfig({ nameContains: event.target.value })}
                className={WORKFLOW_FORM_FLAT_CONTROL_CLASS}
                placeholder="Name contains"
              />
            </WorkflowInspectorField>
          </WorkflowInspectorFieldGrid>
        </WorkflowInspectorGroup>
      ) : null}

      {node.kind === "trigger_agent_done" ? (
        <WorkflowInspectorGroup title="When">
          <WorkflowInspectorFieldGrid>
            <WorkflowInspectorField>
              <Input
                value={String((node.config as { recipeKey?: string }).recipeKey ?? "")}
                onChange={(event) => patchConfig({ recipeKey: event.target.value })}
                className={WORKFLOW_FORM_FLAT_CONTROL_CLASS}
                placeholder="Recipe key"
              />
            </WorkflowInspectorField>
            <TaskFormFlatSelectPlaceholder
              placeholder="Execution kind"
              value={String((node.config as { executionKind?: string }).executionKind ?? "")}
              onChange={(value) => patchConfig({ executionKind: value })}
              options={EXECUTION_KINDS.map((kind) => ({ value: kind, label: kind }))}
              className={WORKFLOW_INSPECTOR_FIELD_CELL_CLASS}
            />
          </WorkflowInspectorFieldGrid>
        </WorkflowInspectorGroup>
      ) : null}

      {node.kind === "action_agent" ? (
        <>
          <WorkflowInspectorGroup title="Agent">
            <WorkflowInspectorFieldGrid>
              <TaskFormFlatSelectPlaceholder
                placeholder="Agent kind"
                value={String((node.config as { executionKind?: string }).executionKind ?? "content_optimizer_meta")}
                onChange={(value) => patchConfig({ executionKind: value })}
                options={EXECUTION_KINDS.map((kind) => ({ value: kind, label: kind }))}
                className={WORKFLOW_INSPECTOR_FIELD_CELL_CLASS}
              />
              <WorkflowInspectorField>
                <Input
                  id="wf-rag-key"
                  value={String((node.config as { ragVariableKey?: string }).ragVariableKey ?? "")}
                  onChange={(event) => patchConfig({ ragVariableKey: event.target.value, ragScope: "run" })}
                  className={WORKFLOW_FORM_FLAT_CONTROL_CLASS}
                  placeholder="Output variable key"
                />
              </WorkflowInspectorField>
            </WorkflowInspectorFieldGrid>
          </WorkflowInspectorGroup>
          <ActionAgentRagInputs
            node={node}
            nodes={nodes}
            edges={edges}
            ragVariables={ragVariables}
            onChange={onChange}
          />
        </>
      ) : null}

      {node.kind === "path_rules" ? (
        <WorkflowInspectorGroup title="Paths">
          <PathRulesInspector node={node} onChange={onChange} />
        </WorkflowInspectorGroup>
      ) : null}

      {node.kind === "rag_archive" ? (
        <WorkflowInspectorGroup title="Archive">
          <WorkflowInspectorField>
            <Select
              value={String((node.config as { variableKey?: string }).variableKey ?? "")}
              onValueChange={(value) => patchConfig({ variableKey: value, scope: "run" })}
            >
              <SelectTrigger className={WORKFLOW_FORM_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Variable to archive" />
              </SelectTrigger>
              <SelectContent className={WORKFLOW_FORM_SELECT_CONTENT_CLASS}>
                {ragVariables.map((variable) => (
                  <SelectItem key={variable.key} value={variable.key} className={WORKFLOW_FORM_SELECT_ITEM_CLASS}>
                    {variable.label || variable.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WorkflowInspectorField>
        </WorkflowInspectorGroup>
      ) : null}
    </WorkflowInspectorTile>
  );
}

function ActionAgentRagInputs({
  node,
  nodes,
  edges,
  ragVariables,
  onChange,
}: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  ragVariables: WorkflowRagVariable[];
  onChange: (node: WorkflowNode) => void;
}): React.ReactElement {
  const config = node.config as Record<string, unknown>;
  const selectedKeys = resolveRagInputKeys(config as Parameters<typeof resolveRagInputKeys>[0]);
  const upstream = upstreamRagVariablesForNode({ nodes, edges, ragVariables }, node.id);
  const available = upstream.filter((variable) => !selectedKeys.includes(variable.key));

  const patchRagInputs = (ragInputKeys: string[]) => {
    onChange({
      ...node,
      config: {
        ...config,
        ragInputKeys,
        ragScope: "run",
        upstreamVariable: undefined,
      },
    });
  };

  const addKey = (key: string) => {
    if (!key || selectedKeys.includes(key)) return;
    patchRagInputs([...selectedKeys, key]);
  };

  const removeKey = (key: string) => {
    patchRagInputs(selectedKeys.filter((item) => item !== key));
  };

  const labelForKey = (key: string) =>
    ragVariables.find((variable) => variable.key === key)?.label ?? key;

  return (
    <WorkflowInspectorGroup title="RAG context">
      {selectedKeys.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {selectedKeys.map((key) => (
            <li
              key={key}
              className="flex items-center justify-between gap-3 bg-zinc-900/50 px-3 py-2"
            >
              <span className="truncate text-base text-emerald-400">{`{{${key}}}`}</span>
              <span className="truncate text-base text-muted-foreground">{labelForKey(key)}</span>
              <button
                type="button"
                className="shrink-0 p-1 text-muted-foreground hover:text-white"
                aria-label={`Remove ${key}`}
                onClick={() => removeKey(key)}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-base text-muted-foreground">No run context attached.</p>
      )}
      {available.length > 0 ? (
        <TaskFormFlatSelectPlaceholder
          placeholder="Add run context"
          value=""
          onChange={addKey}
          options={available.map((variable) => ({
            value: variable.key,
            label: variable.label || variable.key,
          }))}
          className={WORKFLOW_INSPECTOR_FIELD_CELL_CLASS}
        />
      ) : null}
    </WorkflowInspectorGroup>
  );
}

function PathRulesInspector({
  node,
  onChange,
}: {
  node: WorkflowNode;
  onChange: (node: WorkflowNode) => void;
}): React.ReactElement {
  const config = node.config as { branches?: WorkflowPathBranchConfig[] };
  const branches = config.branches ?? [];

  const updateBranch = (index: number, patch: Partial<WorkflowPathBranchConfig>) => {
    const next = branches.map((branch, i) => (i === index ? { ...branch, ...patch } : branch));
    onChange({ ...node, config: { ...config, branches: next } });
  };

  return (
    <div className="flex flex-col gap-4">
      {branches.map((branch, index) => (
        <WorkflowInspectorField key={branch.branchId}>
          <Input
            value={branch.label}
            onChange={(event) => updateBranch(index, { label: event.target.value })}
            className={WORKFLOW_FORM_FLAT_CONTROL_CLASS}
            placeholder="Path label"
          />
        </WorkflowInspectorField>
      ))}
    </div>
  );
}
