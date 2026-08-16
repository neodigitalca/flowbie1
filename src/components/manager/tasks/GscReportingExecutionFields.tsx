import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TaskFormFieldGrid,
  TaskFormFlatGrid,
  TaskFormFlatSelectPlaceholder,
  TaskFormInfield,
  TaskFormPlaceholderCell,
} from "@/components/manager/tasks/TaskFormLayout";
import type { TaskExecutionPayload } from "@/lib/tasks-types";

export type GscReportingExecutionFieldsProps = {
  executionPayload?: TaskExecutionPayload | null;
  disabled?: boolean;
  layout?: "stack" | "inline";
  onChange: (payload: TaskExecutionPayload) => void;
};

export function GscReportingExecutionFields({
  executionPayload,
  disabled = false,
  layout = "stack",
  onChange,
}: GscReportingExecutionFieldsProps): React.ReactElement {
  const payload = executionPayload ?? {};
  const comparePreset = payload.comparePreset ?? "mom";
  const saveToDisk = payload.saveToDisk !== false;
  const inline = layout === "inline";

  const patch = (partial: Partial<TaskExecutionPayload>) => {
    onChange({ ...payload, ...partial });
  };

  if (inline) {
    return (
      <TaskFormFlatGrid className="grid-cols-2">
        <TaskFormFlatSelectPlaceholder
          placeholder="Compare"
          value={comparePreset}
          onChange={(v) => patch({ comparePreset: v as TaskExecutionPayload["comparePreset"] })}
          disabled={disabled}
          options={[
            { value: "mom", label: "Month over month" },
            { value: "yoy", label: "Year over year" },
          ]}
        />
        <TaskFormPlaceholderCell className="flex min-w-0 items-center gap-2">
          <Checkbox
            id="gsc-reporting-save-inline"
            checked={saveToDisk}
            disabled={disabled}
            onCheckedChange={(checked) => patch({ saveToDisk: checked === true })}
          />
          <label htmlFor="gsc-reporting-save-inline" className="text-base text-white">
            Save to disk
          </label>
        </TaskFormPlaceholderCell>
      </TaskFormFlatGrid>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TaskFormFieldGrid>
        <TaskFormInfield label="Compare preset">
          <TaskFormFlatSelectPlaceholder
            placeholder="Compare"
            value={comparePreset}
            onChange={(v) => patch({ comparePreset: v as TaskExecutionPayload["comparePreset"] })}
            disabled={disabled}
            options={[
              { value: "mom", label: "Month over month" },
              { value: "yoy", label: "Year over year" },
            ]}
          />
        </TaskFormInfield>
      </TaskFormFieldGrid>
      <div className="flex items-center gap-2">
        <Checkbox
          id="gsc-reporting-save-stack"
          checked={saveToDisk}
          disabled={disabled}
          onCheckedChange={(checked) => patch({ saveToDisk: checked === true })}
        />
        <label htmlFor="gsc-reporting-save-stack" className="text-base text-white">
          Save report to disk
        </label>
      </div>
    </div>
  );
}
