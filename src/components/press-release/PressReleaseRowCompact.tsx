import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BulkGeneratorRunActions } from "@/components/keyword-research/bulk/BulkGeneratorRunActions";
import { BULK_HEADER_FIELD } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_SHELL_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import {
  PressReleaseDetailsPanel,
  type PressReleaseDetailsPanelProps,
} from "@/components/press-release/PressReleaseDetailsPanel";
import { DETAILS_DRAWER_PANEL, DETAILS_DRAWER_SHELL } from "@/components/integrations/wordpress/bulk-details-drawer-styles";
import { cn } from "@/lib/utils";

const PR_ENTRY_ROW_GRID_CLASS =
  "grid w-full min-w-0 min-h-[3rem] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-x-2 sm:min-h-[3.25rem] sm:gap-x-3";

export type PressReleaseRowCompactProps =
  | {
      placeholder: true;
      stripeIndex?: number;
    }
  | {
      placeholder?: false;
      stripeIndex?: number;
      keyword: string;
      onKeywordChange: (value: string) => void;
      title: string;
      onTitleChange: (value: string) => void;
      workspaceBusy: boolean;
      isProcessing: boolean;
      canRun: boolean;
      canOpenDetails: boolean;
      detailsOpen: boolean;
      onToggleDetails: () => void;
      onRun: () => void;
      onClear: () => void;
      detailsProps: PressReleaseDetailsPanelProps;
      detailsPanelId?: string;
    };

export function PressReleaseRowCompact(props: PressReleaseRowCompactProps) {
  if (props.placeholder) {
    const stripeIndex = props.stripeIndex ?? 0;
    return (
      <div
        className={cn(contentOptimizerRowStripeClass(stripeIndex), PR_ENTRY_ROW_GRID_CLASS)}
        aria-hidden
      />
    );
  }

  const {
    keyword,
    onKeywordChange,
    title,
    onTitleChange,
    workspaceBusy,
    isProcessing,
    canRun,
    canOpenDetails,
    detailsOpen,
    onToggleDetails,
    onRun,
    onClear,
    detailsProps,
    stripeIndex = 0,
    detailsPanelId = "press-release-row-details",
  } = props;

  return (
    <div className={cn(CONTENT_OPTIMIZER_MULTI_SITE_ROW_SHELL_CLASS, "relative")}>
      <div className={cn(contentOptimizerRowStripeClass(stripeIndex), PR_ENTRY_ROW_GRID_CLASS)}>
        <Input
          type="text"
          placeholder="Keyword"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          className={cn(BULK_HEADER_FIELD, "min-w-0 w-full text-base")}
          disabled={workspaceBusy}
          autoComplete="off"
          aria-label="Keyword"
        />
        <Input
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className={cn(BULK_HEADER_FIELD, "min-w-0 w-full text-base")}
          disabled={workspaceBusy}
          autoComplete="off"
          aria-label="Title override"
        />
        <button
          type="button"
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1 px-2 text-base font-normal text-white transition-colors hover:text-white/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !canOpenDetails && "pointer-events-none opacity-40",
          )}
          onClick={onToggleDetails}
          aria-expanded={detailsOpen}
          aria-controls={detailsPanelId}
          disabled={!canOpenDetails}
        >
          Details
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")}
            aria-hidden
          />
        </button>
        <BulkGeneratorRunActions
          isProcessing={isProcessing}
          canRun={canRun}
          workspaceBusy={workspaceBusy}
          onRun={onRun}
          onCancel={() => {}}
          onClear={onClear}
          runLabel="Generate"
          groupClassName="flex shrink-0 flex-nowrap items-center gap-2"
        />
      </div>

      {detailsOpen && canOpenDetails ? (
        <div id={detailsPanelId} className={cn(DETAILS_DRAWER_PANEL, DETAILS_DRAWER_SHELL)}>
          <PressReleaseDetailsPanel {...detailsProps} />
        </div>
      ) : null}
    </div>
  );
}
