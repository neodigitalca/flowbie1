import React from "react";
import { Play, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PulseForgeBreadcrumbs } from "@/components/manager/pulse-forge/PulseForgeBreadcrumbs";
import {
  WORKFLOW_HEADER_BAND_CLASS,
  WORKFLOW_HEADER_NAME_CLASS,
  WORKFLOW_HEADER_RUN_BTN,
  WORKFLOW_HEADER_TOOL_BTN,
} from "@/components/manager/workflow/forge-workflow-styles";
import type { PulseForgeRoute } from "@/lib/pulse-forge/pulse-forge-hash";
import { cn } from "@/lib/utils";

export type WorkflowWorkspaceHeaderProps = {
  route: PulseForgeRoute;
  workflowName?: string | null;
  statusMessage?: string | null;
  name: string;
  saving: boolean;
  running: boolean;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onPublish: () => void;
  onTestRun: () => void;
  publishDisabled?: boolean;
  testDisabled?: boolean;
};

export function WorkflowWorkspaceHeader({
  route,
  workflowName,
  statusMessage,
  name,
  saving,
  running,
  onNameChange,
  onSave,
  onPublish,
  onTestRun,
  publishDisabled = false,
  testDisabled = false,
}: WorkflowWorkspaceHeaderProps): React.ReactElement {
  return (
    <div className={WORKFLOW_HEADER_BAND_CLASS}>
      <PulseForgeBreadcrumbs
        route={route}
        workflowName={workflowName}
        statusMessage={null}
        hideLeaf
        className="shrink-0"
      />
      <Input
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="Untitled workflow"
        aria-label="Workflow name"
        className={WORKFLOW_HEADER_NAME_CLASS}
      />
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(WORKFLOW_HEADER_TOOL_BTN, "gap-1.5")}
          disabled={saving}
          onClick={onSave}
        >
          <Save className="h-4 w-4 shrink-0" />
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(WORKFLOW_HEADER_TOOL_BTN, "gap-1.5")}
          disabled={saving || publishDisabled}
          onClick={onPublish}
        >
          <Upload className="h-4 w-4 shrink-0" />
          Publish
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(WORKFLOW_HEADER_RUN_BTN, "gap-1.5")}
          disabled={running || testDisabled}
          onClick={onTestRun}
        >
          <Play className="h-4 w-4 shrink-0" />
          Test
        </Button>
      </div>
      {statusMessage ? (
        <p className="max-w-[12rem] shrink-0 truncate text-base text-red-400" role="status">
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
