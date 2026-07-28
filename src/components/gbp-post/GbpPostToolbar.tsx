import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_RUN_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  GBP_ROSTER_LIST_INSET_CLASS,
  GBP_ROSTER_TOOLBAR_BLEED_CLASS,
  GBP_ROSTER_TOOLBAR_GRID_CLASS,
} from "@/components/gbp-post/gbp-post-roster-layout";
import { clampNumberOfGbpPosts } from "@/lib/gbp-post/gbp-schedule-plan";
import { cn } from "@/lib/utils";

export type GbpPostToolbarProps = {
  disabled: boolean;
  isBusy: boolean;
  isPosting: boolean;
  postLabel: string;
  selectedCount: number;
  rosterSiteCount: number;
  allClientsSelected: boolean;
  someClientsSelected: boolean;
  onSelectAllChange: (selectAll: boolean) => void;
  numberOfPosts: number;
  onNumberOfPostsChange: (value: number) => void;
  onPost: () => void;
};

export function GbpPostToolbar({
  disabled,
  isBusy,
  isPosting,
  postLabel,
  selectedCount,
  rosterSiteCount,
  allClientsSelected,
  someClientsSelected,
  onSelectAllChange,
  numberOfPosts,
  onNumberOfPostsChange,
  onPost,
}: GbpPostToolbarProps) {
  const controlsDisabled = disabled || isBusy;
  const postDisabled = controlsDisabled || selectedCount === 0;
  const selectAllChecked: boolean | "indeterminate" =
    allClientsSelected ? true : someClientsSelected ? "indeterminate" : false;

  return (
    <div className={cn("min-w-0 shrink-0", GBP_ROSTER_TOOLBAR_BLEED_CLASS)}>
      <div className={cn("w-full min-w-0", GBP_ROSTER_LIST_INSET_CLASS)}>
        <div className={GBP_ROSTER_TOOLBAR_GRID_CLASS} role="group" aria-label="Post settings">
          <div className="flex items-center justify-center">
            <Checkbox
              checked={selectAllChecked}
              disabled={controlsDisabled || rosterSiteCount === 0}
              onCheckedChange={(v) => onSelectAllChange(v === true)}
              aria-label="Select all clients"
              title="Select all"
              className="data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
            />
          </div>

          <div aria-hidden />

          <Input
            type="number"
            min={1}
            max={10}
            aria-label="How many GBP posts"
            value={numberOfPosts}
            disabled={controlsDisabled}
            onChange={(e) => onNumberOfPostsChange(clampNumberOfGbpPosts(Number(e.target.value)))}
            className={cn(BULK_HEADER_FIELD, "h-8 w-[4.5rem] shrink-0 px-2 tabular-nums")}
          />

          <Button
            type="button"
            size="sm"
            className={BULK_HEADER_RUN_BTN}
            disabled={postDisabled}
            onClick={onPost}
          >
            {isPosting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
            {postLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
