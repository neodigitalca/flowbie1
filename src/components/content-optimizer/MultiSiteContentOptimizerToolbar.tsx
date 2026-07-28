import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  BULK_HEADER_RUN_BTN,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { MultiSiteUrlSource } from "@/lib/content-optimizer/multi-site-source-urls";
import { cn } from "@/lib/utils";

export const MULTI_SITE_CHECKBOX_CLASS =
  "border-zinc-500/60 data-[state=checked]:border-zinc-500 data-[state=checked]:bg-zinc-800 data-[state=checked]:text-zinc-400 data-[state=indeterminate]:border-zinc-500 data-[state=indeterminate]:bg-zinc-800 data-[state=indeterminate]:text-zinc-400";

export type MultiSiteSelectAllControlProps = {
  actionsBlocked: boolean;
  propertySiteCount: number;
  allSitesSelected: boolean;
  someSitesSelected: boolean;
  onSelectAllChange: (selectAll: boolean) => void;
  className?: string;
};

export function MultiSiteSelectAllControl({
  actionsBlocked,
  propertySiteCount,
  allSitesSelected,
  someSitesSelected,
  onSelectAllChange,
  className,
}: MultiSiteSelectAllControlProps) {
  return (
    <label
      htmlFor="ms-select-all"
      className={cn("flex shrink-0 cursor-pointer items-center gap-2 text-base text-white", className)}
    >
      <Checkbox
        id="ms-select-all"
        className={MULTI_SITE_CHECKBOX_CLASS}
        checked={allSitesSelected ? true : someSitesSelected ? "indeterminate" : false}
        disabled={actionsBlocked || propertySiteCount === 0}
        onCheckedChange={(c) => onSelectAllChange(c === true)}
      />
      Select all
    </label>
  );
}

export type MultiSiteContentOptimizerToolbarProps = {
  actionsBlocked: boolean;
  optimizeMode: "update" | "draft";
  onOptimizeModeChange: (mode: "update" | "draft") => void;
  optimizeQueueBusy: boolean;
  runnableSelectedCount: number;
  propertySiteCount: number;
  allSitesSelected: boolean;
  someSitesSelected: boolean;
  universalSourceShared: MultiSiteUrlSource | null;
  onSelectAllChange: (selectAll: boolean) => void;
  onOptimizeSelected: () => void;
  onUniversalSitemapSelect: (source: MultiSiteUrlSource) => void;
};

export function MultiSiteContentOptimizerToolbar({
  actionsBlocked,
  optimizeMode,
  onOptimizeModeChange,
  optimizeQueueBusy,
  runnableSelectedCount,
  onOptimizeSelected,
}: MultiSiteContentOptimizerToolbarProps) {
  return (
    <>
      <div
        className="flex min-w-0 shrink flex-nowrap items-center gap-1.5"
        role="group"
        aria-label="Multi-site bulk run"
      >
        <Button
          type="button"
          size="sm"
          disabled={actionsBlocked || runnableSelectedCount === 0}
          onClick={onOptimizeSelected}
          className={BULK_HEADER_RUN_BTN}
          aria-label={
            optimizeQueueBusy
              ? "Optimizing selected sites"
              : `Optimize selected${runnableSelectedCount > 0 ? ` (${runnableSelectedCount})` : ""}`
          }
        >
          {optimizeQueueBusy ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          )}
          Selected{runnableSelectedCount > 0 ? ` (${runnableSelectedCount})` : ""}
        </Button>
      </div>

      <div className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />

      <div
        className="ml-auto flex min-w-0 shrink-0 flex-nowrap items-center gap-1.5"
        role="group"
        aria-label="Publish mode"
      >
        <RadioGroup
          value={optimizeMode}
          onValueChange={(v) => onOptimizeModeChange(v as "update" | "draft")}
          className="flex shrink-0 flex-row flex-nowrap items-center gap-3"
          aria-label="Publish mode"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="update" id="ms-opt-live-global" disabled={actionsBlocked} />
            <Label htmlFor="ms-opt-live-global" className="cursor-pointer text-base font-normal text-white">
              Live
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="draft" id="ms-opt-draft-global" disabled={actionsBlocked} />
            <Label htmlFor="ms-opt-draft-global" className="cursor-pointer text-base font-normal text-white">
              Draft
            </Label>
          </div>
        </RadioGroup>
      </div>
    </>
  );
}
