import React from "react";
import { Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { BULK_HEADER_ICON_TOOL_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  getPropertyListRowBlackIconButtonClass,
  getPropertyListRowIconButtonHoverGlowClass,
} from "@/components/integrations/wordpress/cyberpunk-theme";
import { cn } from "@/lib/utils";

const CHECKBOX_CLASS =
  "border-white/50 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=indeterminate]:border-white data-[state=indeterminate]:bg-white data-[state=indeterminate]:text-black pointer-events-none";

const DELETE_BTN_CLASS = cn(
  getPropertyListRowBlackIconButtonClass(true),
  getPropertyListRowIconButtonHoverGlowClass("destructive"),
  BULK_HEADER_ICON_TOOL_BTN,
  "h-8 w-8",
);

export type ForgeAutomationBulkSelectBarProps = {
  selectedCount: number;
  allFilteredSelected: boolean;
  someSelected: boolean;
  disabled?: boolean;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  className?: string;
};

export function ForgeAutomationBulkSelectBar({
  selectedCount,
  allFilteredSelected,
  someSelected,
  disabled = false,
  onSelectAllFiltered,
  onClearSelection,
  onDeleteSelected,
  className,
}: ForgeAutomationBulkSelectBarProps): React.ReactElement {
  const masterChecked = allFilteredSelected ? true : someSelected ? "indeterminate" : false;

  return (
    <div className={cn("flex shrink-0 items-center gap-3", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-label="Select all filtered automations"
        onClick={() => {
          if (allFilteredSelected) onClearSelection();
          else onSelectAllFiltered();
        }}
        className="flex shrink-0 items-center gap-2 border-0 bg-transparent p-0 text-base text-white hover:opacity-90 disabled:opacity-50"
      >
        <Checkbox
          checked={masterChecked}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden
          className={CHECKBOX_CLASS}
        />
        Select all
      </button>
      <button
        type="button"
        disabled={disabled || selectedCount === 0}
        onClick={onClearSelection}
        className="shrink-0 border-0 bg-transparent p-0 text-base text-white hover:opacity-80 disabled:opacity-50"
      >
        Clear
      </button>
      <button
        type="button"
        disabled={disabled || selectedCount === 0}
        onClick={onDeleteSelected}
        aria-label={`Delete ${selectedCount} selected automation${selectedCount === 1 ? "" : "s"}`}
        className={DELETE_BTN_CLASS}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
