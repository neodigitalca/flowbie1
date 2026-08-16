import React from "react";
import { Input } from "@/components/ui/input";
import { GscReportingExecutionFields } from "@/components/manager/tasks/GscReportingExecutionFields";
import { PostCreatorExecutionFields } from "@/components/manager/tasks/PostCreatorExecutionFields";
import {
  TASK_FORM_FLAT_CONTROL_CLASS,
  TASK_FORM_SELECT_CONTENT_CLASS,
  TASK_FORM_SELECT_ITEM_CLASS,
  TASK_FORM_SELECT_TRIGGER_CLASS,
  TaskFormCompactCell,
  TaskFormFlatGrid,
} from "@/components/manager/tasks/TaskFormLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ensurePostCreatorPayload } from "@/lib/post-creator/post-creator-defaults";
import { TASK_EXECUTION_KIND_OPTIONS } from "@/lib/task-execution-kind-options";
import type { AutomationActionBlock } from "@/lib/automation-planner-types";
import type { TaskExecutionKind } from "@/lib/tasks-types";
import { cn } from "@/lib/utils";

export type AutomationThenPanelProps = {
  action: AutomationActionBlock;
  disabled?: boolean;
  onChange: (patch: Partial<AutomationActionBlock>) => void;
};

export function AutomationThenPanel({
  action,
  disabled = false,
  onChange,
}: AutomationThenPanelProps): React.ReactElement {
  const kind = action.executionKind;
  const isPostCreator = kind === "post_creator";
  const isGscReporting = kind === "gsc_reporting";

  return (
    <div className="flex flex-col gap-1">
      <TaskFormFlatGrid className="grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TaskFormCompactCell label="Action title">
          <Input
            value={action.title ?? ""}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="What runs on trigger"
            disabled={disabled}
            className={TASK_FORM_FLAT_CONTROL_CLASS}
          />
        </TaskFormCompactCell>
        <TaskFormCompactCell label="Execution">
          <Select
            value={kind}
            onValueChange={(v) => {
              const executionKind = v as TaskExecutionKind;
              const patch: Partial<AutomationActionBlock> = {
                executionKind,
                keyword:
                  executionKind === "content_optimizer_meta"
                    ? "content-optimizer-meta"
                    : executionKind === "post_creator"
                      ? "post-creator-monthly"
                      : executionKind === "gsc_reporting"
                        ? "gsc-report-mom"
                        : "content-optimizer-full",
              };
              if (executionKind === "post_creator") {
                patch.executionPayload = ensurePostCreatorPayload(action.executionPayload);
              }
              onChange(patch);
            }}
            disabled={disabled}
          >
            <SelectTrigger className={TASK_FORM_SELECT_TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={TASK_FORM_SELECT_CONTENT_CLASS}>
              {TASK_EXECUTION_KIND_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className={TASK_FORM_SELECT_ITEM_CLASS}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TaskFormCompactCell>
      </TaskFormFlatGrid>

      <div className="relative min-h-[8rem] w-full">
        <div
          className={cn(
            "absolute inset-0",
            !isPostCreator && "pointer-events-none invisible",
          )}
        >
          <PostCreatorExecutionFields
            layout="inline"
            executionPayload={ensurePostCreatorPayload(action.executionPayload)}
            disabled={disabled || !isPostCreator}
            onChange={(executionPayload) => onChange({ executionPayload })}
          />
        </div>
        <div
          className={cn(
            "absolute inset-0",
            !isGscReporting && "pointer-events-none invisible",
          )}
        >
          <GscReportingExecutionFields
            layout="inline"
            executionPayload={action.executionPayload}
            disabled={disabled || !isGscReporting}
            onChange={(executionPayload) =>
              onChange({
                executionPayload,
                keyword:
                  executionPayload.comparePreset === "yoy" ? "gsc-report-yoy" : "gsc-report-mom",
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
