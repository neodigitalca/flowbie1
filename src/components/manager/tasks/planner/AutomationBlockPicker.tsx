import React from "react";
import { cn } from "@/lib/utils";
import { TaskFormInlineRow } from "@/components/manager/tasks/TaskFormLayout";
import type { AutomationBlockCatalogItem } from "@/lib/automation-blocks-api";

export type AutomationBlockPickerProps = {
  label?: string;
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

  const grid = (
    <div className="grid grid-cols-2 gap-1 lg:grid-cols-3 xl:grid-cols-4">
      {filtered.map((block) => {
        const selected = block.keyword === selectedKeyword;
        return (
          <button
            key={block.keyword}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(block.keyword)}
            className={cn(
              "min-h-9 whitespace-normal px-2 py-1.5 text-left text-base transition-colors",
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
  );

  if (!label) return grid;

  return <TaskFormInlineRow label={label}>{grid}</TaskFormInlineRow>;
}
