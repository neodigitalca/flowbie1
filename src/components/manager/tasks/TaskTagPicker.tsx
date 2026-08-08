import React from "react";
import { cn } from "@/lib/utils";
import type { TaskTag } from "@/lib/tasks-types";

export type TaskTagPickerProps = {
  tags: TaskTag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
};

export function TaskTagPicker({ tags, selectedTagIds, onChange }: TaskTagPickerProps): React.ReactElement {
  const toggle = (keyword: string) => {
    if (selectedTagIds.includes(keyword)) {
      onChange(selectedTagIds.filter((id) => id !== keyword));
    } else {
      onChange([...selectedTagIds, keyword]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-white">Tags</p>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => {
          const active = selectedTagIds.includes(tag.keyword);
          return (
            <button
              key={tag.keyword}
              type="button"
              onClick={() => toggle(tag.keyword)}
              className={cn("px-2 py-1 text-base text-white", active ? "opacity-100" : "opacity-40")}
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
