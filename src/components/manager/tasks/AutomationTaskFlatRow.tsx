import React from "react";
import { Input } from "@/components/ui/input";
import {
  TASK_FORM_FLAT_CONTROL_CLASS,
  TaskFormDatePicker,
  TaskFormFlatGrid,
  TaskFormFlatSelectPlaceholder,
  TaskFormPlaceholderCell,
  TaskFormTimePicker,
} from "@/components/manager/tasks/TaskFormLayout";
import { GscReportingExecutionFields } from "@/components/manager/tasks/GscReportingExecutionFields";
import { PostCreatorExecutionFields } from "@/components/manager/tasks/PostCreatorExecutionFields";
import { TaskTriggerFields } from "@/components/manager/tasks/TaskTriggerFields";
import { ensurePostCreatorPayload } from "@/lib/post-creator/post-creator-defaults";
import { automationUsesTriggerUi } from "@/lib/task-automation-ui";
import { TASK_EXECUTION_KIND_OPTIONS } from "@/lib/task-execution-kind-options";
import type {
  TaskExecutionKind,
  TaskExecutionPayload,
  TaskRecurrenceRule,
  TaskScheduleMode,
  TaskStatus,
} from "@/lib/tasks-types";
import { TASK_RECURRENCE_LABELS, TASK_RECURRENCE_RULES, TASK_STATUS_LABELS, TASK_STATUSES } from "@/lib/tasks-types";
import type { TaskTriggerConfig } from "@/lib/task-trigger-types";

export type AutomationActionDraft = {
  title: string;
  status: TaskStatus;
  scheduleMode?: TaskScheduleMode;
  dueDate?: string;
  dueTime?: string;
  recurrenceRule?: TaskRecurrenceRule;
  triggerConfig: TaskTriggerConfig;
  executionKind: TaskExecutionKind;
  executionPayload: TaskExecutionPayload;
};

/** @deprecated Use AutomationActionDraft */
export type AutomationTaskDraft = AutomationActionDraft;

export type AutomationActionFlatRowProps = {
  draft: AutomationActionDraft;
  saving: boolean;
  onChange: (patch: Partial<AutomationActionDraft>) => void;
};

function handleExecutionKindChange(
  kind: TaskExecutionKind,
  draft: AutomationActionDraft,
): Partial<AutomationActionDraft> {
  if (kind === "post_creator") {
    return {
      executionKind: kind,
      scheduleMode: "calendar",
      recurrenceRule: draft.recurrenceRule && draft.recurrenceRule !== "none" ? draft.recurrenceRule : "monthly",
      executionPayload: ensurePostCreatorPayload(draft.executionPayload),
    };
  }
  if (kind === "gsc_reporting") {
    return {
      executionKind: kind,
      scheduleMode: "calendar",
      recurrenceRule: draft.recurrenceRule && draft.recurrenceRule !== "none" ? draft.recurrenceRule : "monthly",
      executionPayload: {
        comparePreset: draft.executionPayload.comparePreset ?? "mom",
        saveToDisk: draft.executionPayload.saveToDisk !== false,
      },
    };
  }
  return {
    executionKind: kind,
    scheduleMode: "trigger",
    recurrenceRule: "none",
    executionPayload: { ...draft.executionPayload, updateMode: draft.executionPayload.updateMode ?? "update" },
  };
}

export function AutomationActionFlatRow({
  draft,
  saving,
  onChange,
}: AutomationActionFlatRowProps): React.ReactElement {
  const showTrigger = automationUsesTriggerUi(draft.executionKind, draft.scheduleMode);
  const showCalendar = !showTrigger;
  const isPostCreator = draft.executionKind === "post_creator";
  const isGscReporting = draft.executionKind === "gsc_reporting";

  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      <TaskFormFlatGrid className="grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <TaskFormPlaceholderCell>
          <Input
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Action title"
            aria-label="Action title"
            disabled={saving}
            className={TASK_FORM_FLAT_CONTROL_CLASS}
          />
        </TaskFormPlaceholderCell>
        <TaskFormFlatSelectPlaceholder
          placeholder="Status"
          value={draft.status}
          onChange={(v) => onChange({ status: v as TaskStatus })}
          disabled={saving}
          options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
        />
        <TaskFormFlatSelectPlaceholder
          placeholder="Execution"
          value={draft.executionKind}
          onChange={(v) => onChange(handleExecutionKindChange(v as TaskExecutionKind, draft))}
          disabled={saving}
          options={TASK_EXECUTION_KIND_OPTIONS}
        />
      </TaskFormFlatGrid>

      {showCalendar ? (
        <>
          <TaskFormFlatGrid className="grid-cols-2 md:grid-cols-3">
            <TaskFormFlatSelectPlaceholder
              placeholder="Recurrence"
              value={draft.recurrenceRule === "none" ? "" : (draft.recurrenceRule ?? "monthly")}
              onChange={(v) => onChange({ recurrenceRule: (v || "monthly") as TaskRecurrenceRule })}
              disabled={saving}
              options={TASK_RECURRENCE_RULES.filter((r) => r !== "none").map((rule) => ({
                value: rule,
                label: TASK_RECURRENCE_LABELS[rule],
              }))}
            />
            <TaskFormDatePicker
              placeholder="Due date"
              value={draft.dueDate ?? ""}
              onChange={(dueDate) => onChange({ dueDate })}
              disabled={saving}
            />
            <TaskFormTimePicker
              placeholder="Due time"
              value={draft.dueTime ?? ""}
              onChange={(dueTime) => onChange({ dueTime })}
              disabled={saving}
            />
          </TaskFormFlatGrid>
          {isPostCreator ? (
            <PostCreatorExecutionFields
              layout="inline"
              executionPayload={draft.executionPayload}
              disabled={saving}
              onChange={(executionPayload) => onChange({ executionPayload })}
            />
          ) : null}
          {isGscReporting ? (
            <GscReportingExecutionFields
              layout="inline"
              executionPayload={draft.executionPayload}
              disabled={saving}
              onChange={(executionPayload) => onChange({ executionPayload })}
            />
          ) : null}
        </>
      ) : (
        <TaskTriggerFields
          layout="inline"
          triggerConfig={draft.triggerConfig}
          executionPayload={draft.executionPayload}
          disabled={saving}
          onChange={(triggerConfig) => onChange({ triggerConfig })}
          onExecutionPayloadChange={(executionPayload) => onChange({ executionPayload })}
        />
      )}
    </div>
  );
}

/** @deprecated Use AutomationActionFlatRow */
export const AutomationTaskFlatRow = AutomationActionFlatRow;
