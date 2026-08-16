import React from "react";
import { cn } from "@/lib/utils";
import { TaskFormCompactCell } from "@/components/manager/tasks/TaskFormLayout";
import type { AutomationBlockCatalogItem } from "@/lib/automation-blocks-api";

export type AutomationBlockPickerProps = {
  label: string;
  blocks: AutomationBlockCatalogItem[];
  selectedKeyword: string;
  disabled?: boolean;
  filterKind?: string;
  onSelect: (keyword: string) => void;
};

export function AutomationBlockPicker({
  label,
  blocks,
  selectedKeyword,
  disabled = false,
  filterKind,
  onSelect,
}: AutomationBlockPickerProps): React.ReactElement {
  const filtered = filterKind
    ? blocks.filter((b) => (b.kind ?? "") === filterKind || b.keyword.startsWith(filterKind))
    : blocks;

  return (
    <TaskFormCompactCell label={label}>
      <div className="-mx-1 flex h-9 min-w-0 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:thin]">
        {filtered.map((block) => {
          const selected = block.keyword === selectedKeyword;
          return (
            <button
              key={block.keyword}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(block.keyword)}
              className={cn(
                "h-8 shrink-0 whitespace-nowrap px-2 text-base transition-colors",
                selected
                  ? "bg-primary text-black"
                  : "bg-zinc-900 text-white hover:bg-zinc-800",
              )}
            >
              {block.name}
            </button>
          );
        })}
      </div>
    </TaskFormCompactCell>
  );
}
