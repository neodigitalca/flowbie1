import React, { useMemo } from "react";
import { TaskFormMultiSelect } from "@/components/manager/tasks/TaskFormLayout";
import type { TaskTag } from "@/lib/tasks-types";

export type TaskTagMultiSelectProps = {
  tags: TaskTag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function TaskTagMultiSelect({
  tags,
  selectedTagIds,
  onChange,
  disabled = false,
  placeholder = "Tags",
  className,
}: TaskTagMultiSelectProps): React.ReactElement {
  const options = useMemo(
    () => tags.map((tag) => ({ value: tag.keyword, label: tag.name })),
    [tags],
  );

  return (
    <TaskFormMultiSelect
      placeholder={placeholder}
      options={options}
      selectedValues={selectedTagIds}
      onChange={onChange}
      disabled={disabled}
      className={className}
    />
  );
}
