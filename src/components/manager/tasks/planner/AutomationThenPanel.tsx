import React from "react";
import { Input } from "@/components/ui/input";
import { GscReportingExecutionFields } from "@/components/manager/tasks/GscReportingExecutionFields";
import { PostCreatorExecutionFields } from "@/components/manager/tasks/PostCreatorExecutionFields";
import {
  TASK_FORM_FLAT_CONTROL_CLASS,
  TaskFormFlatGrid,
  TaskFormFlatSelectPlaceholder,
  TaskFormPlaceholderCell,
} from "@/components/manager/tasks/TaskFormLayout";
import { ensurePostCreatorPayload } from "@/lib/post-creator/post-creator-defaults";
import { TASK_EXECUTION_KIND_OPTIONS } from "@/lib/task-execution-kind-options";
import type { AutomationActionBlock } from "@/lib/automation-planner-types";
import type { TaskExecutionKind, TaskStatus } from "@/lib/tasks-types";
import { TASK_STATUS_LABELS, TASK_STATUSES } from "@/lib/tasks-types";

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
        <TaskFormPlaceholderCell>
          <Input
            value={action.title ?? ""}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Action title"
            aria-label="Action title"
            disabled={disabled}
            className={TASK_FORM_FLAT_CONTROL_CLASS}
          />
        </TaskFormPlaceholderCell>
        <TaskFormFlatSelectPlaceholder
          placeholder="Execution"
          value={kind}
          onChange={(v) => {
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
          options={TASK_EXECUTION_KIND_OPTIONS}
        />
      </TaskFormFlatGrid>

      {isPostCreator ? (
        <PostCreatorExecutionFields
          layout="inline"
          executionPayload={ensurePostCreatorPayload(action.executionPayload)}
          disabled={disabled}
          onChange={(executionPayload) => onChange({ executionPayload })}
        />
      ) : null}

      {isGscReporting ? (
        <GscReportingExecutionFields
          layout="inline"
          executionPayload={action.executionPayload}
          disabled={disabled}
          onChange={(executionPayload) =>
            onChange({
              executionPayload,
              keyword:
                executionPayload.comparePreset === "yoy" ? "gsc-report-yoy" : "gsc-report-mom",
            })
          }
        />
      ) : null}
    </div>
  );
}
