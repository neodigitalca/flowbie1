import { Loader2, Search, Trash2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { BULK_HEADER_FIELD, BULK_HEADER_TOOL_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { PropertiesWorkspaceToolbarState } from "@/components/manager/dashboard/PropertiesDashboardChromeContext";
import { cn } from "@/lib/utils";

export type PropertiesWorkspaceToolbarProps = PropertiesWorkspaceToolbarState;

export function PropertiesWorkspaceToolbar({
  sitesCount,
  siteSearchQuery,
  onSearchChange,
  selectAllChecked,
  onSelectAll,
  selectedCount,
  onDeleteSelected,
  showGbpBulk,
  isBulkGmbNamesBusy,
  onBulkApplyGmbDisplayNames,
  trailingActions,
}: PropertiesWorkspaceToolbarProps) {
  const showSelectionControls =
    sitesCount > 0 && Boolean((onSelectAll ?? onDeleteSelected) || showGbpBulk);

  return (
    <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto">
      {showSelectionControls ? (
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
          {(onSelectAll ?? onDeleteSelected) ? (
            <>
              <label className="flex cursor-pointer items-center" title="Select all">
                <Checkbox
                  checked={selectAllChecked}
                  onCheckedChange={(c) => onSelectAll?.(c === true)}
                  aria-label="Select all"
                  className="border-zinc-500/60 data-[state=checked]:border-zinc-500 data-[state=checked]:bg-zinc-800 data-[state=checked]:text-zinc-400"
                />
              </label>
              {selectedCount > 0 && onDeleteSelected ? (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onDeleteSelected}
                  title={`Delete ${selectedCount} selected`}
                  aria-label={`Delete ${selectedCount} selected`}
                  className="h-8 min-h-8 w-8 shrink-0 border-red-400 text-red-400 hover:bg-red-400/10"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
            </>
          ) : null}
          {showGbpBulk ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBulkGmbNamesBusy}
              onClick={() => void onBulkApplyGmbDisplayNames()}
              className={cn(BULK_HEADER_TOOL_BTN, "gap-1")}
              title="Set each property’s display name from DataForSEO Business Listings + Google Business Profile (visible rows only)"
            >
              {isBulkGmbNamesBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                  …
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  GBP
                </>
              )}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="relative min-h-0 min-w-0 max-w-[36rem] flex-1 basis-0 sm:min-w-[12rem]">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search sites by name..."
            value={siteSearchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(BULK_HEADER_FIELD, "h-8 w-full pl-9 pr-9 text-base")}
          />
          {siteSearchQuery ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSearchChange("")}
              className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0 hover:bg-zinc-700"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
      </div>
      {trailingActions ? (
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:ml-auto">{trailingActions}</div>
      ) : null}
    </div>
  );
}
