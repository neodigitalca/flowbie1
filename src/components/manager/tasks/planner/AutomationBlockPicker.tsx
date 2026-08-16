import React from "react";
import { cn } from "@/lib/utils";
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
    <div className="flex flex-col gap-2">
      <p className="text-base font-medium text-white">{label}</p>
      <div className="flex flex-wrap gap-2">
        {filtered.map((block) => {
          const selected = block.keyword === selectedKeyword;
          return (
            <button
              key={block.keyword}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(block.keyword)}
              className={cn(
                "px-3 py-2 text-left text-base transition-colors",
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
    </div>
  );
}
