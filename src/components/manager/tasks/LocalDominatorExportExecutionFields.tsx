import React from "react";
import { Input } from "@/components/ui/input";
import {
  TaskFormFieldGrid,
  TaskFormFlatGrid,
  TaskFormInfield,
} from "@/components/manager/tasks/TaskFormLayout";
import type { TaskExecutionPayload } from "@/lib/tasks-types";

export type LocalDominatorExportExecutionFieldsProps = {
  executionPayload?: TaskExecutionPayload | null;
  disabled?: boolean;
  layout?: "stack" | "inline";
  onChange: (payload: TaskExecutionPayload) => void;
};

export function LocalDominatorExportExecutionFields({
  executionPayload,
  disabled = false,
  layout = "stack",
  onChange,
}: LocalDominatorExportExecutionFieldsProps): React.ReactElement {
  const payload = executionPayload ?? {};
  const businessName = payload.businessName ?? "Advance Blinds & Drapery";
  const keyword = payload.keyword ?? "blinds near me";
  const inline = layout === "inline";

  const patch = (partial: Partial<TaskExecutionPayload>) => {
    onChange({ ...payload, ...partial });
  };

  const fields = (
    <>
      <TaskFormInfield label="Business">
        <Input
          value={businessName}
          disabled={disabled}
          onChange={(event) => patch({ businessName: event.target.value })}
          className="h-8 border-0 bg-zinc-900/50 text-base"
        />
      </TaskFormInfield>
      <TaskFormInfield label="Keyword">
        <Input
          value={keyword}
          disabled={disabled}
          onChange={(event) => patch({ keyword: event.target.value })}
          className="h-8 border-0 bg-zinc-900/50 text-base"
        />
      </TaskFormInfield>
    </>
  );

  if (inline) {
    return <TaskFormFlatGrid className="grid-cols-2">{fields}</TaskFormFlatGrid>;
  }

  return <TaskFormFieldGrid>{fields}</TaskFormFieldGrid>;
}
