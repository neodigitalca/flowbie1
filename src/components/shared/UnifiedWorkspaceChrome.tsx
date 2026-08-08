import React, { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { BULK_TOOLBAR_GROUP_DIVIDER } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  MetaBulkMicroProgress,
  type MetaBulkMicroSnapshot,
} from "@/components/overview/OverviewBulkMicroProgress";
import type { MetaBulkActionKey, BulkProgressSlice } from "@/components/overview/overview-tab-constants";
import { cn } from "@/lib/utils";
import { DETAILS_DRAWER_PANEL, DETAILS_DRAWER_SHELL } from "@/components/integrations/wordpress/bulk-details-drawer-styles";

/** Fixed chrome height so workspace tabs do not shift layout. */
export const UNIFIED_TITLE_BAND_CLASS =
  "flex h-12 shrink-0 items-center bg-zinc-900 px-3 sm:px-3.5";
export const UNIFIED_TOOLBAR_CLASS =
  "flex h-11 w-full min-w-0 shrink-0 min-h-11 flex-nowrap items-center justify-start gap-1.5 overflow-x-hidden bg-black px-3 sm:px-3.5";
export const UNIFIED_PROGRESS_BAND_CLASS =
  "relative z-20 flex h-11 w-full shrink-0 items-center overflow-visible bg-zinc-900 px-3 sm:px-3.5";

type UnifiedWorkspaceChromeBaseProps = {
  icon: LucideIcon;
  /** Optional override for title-band icon color (default: white). */
  iconClassName?: string;
  title: string;
  /** Mode menu immediately right of the title (e.g. Content | Multi-site). */
  titleRowMenu?: ReactNode;
  titleRowEnd?: ReactNode;
  toolbar: ReactNode;
  workspaceBusy: boolean;
  /** Omit the black toolbar band when controls live in the body grid. */
  hideToolbar?: boolean;
  /** Square outer frame and controls (default: true). */
  squareFrame?: boolean;
};

type UnifiedWorkspaceChromeFullProgressProps = UnifiedWorkspaceChromeBaseProps & {
  /** Default: full progress bar + Details drawer. */
  progressBand?: "full";
  /** Optional leading slot in the progress band (e.g. grid pagination). */
  progressLeading?: ReactNode;
  progressSnapshot: MetaBulkMicroSnapshot | null;
  /** Optional per-action progress slices for the embedded micro progress bar. */
  bulkActionProgress?: Partial<Record<MetaBulkActionKey, BulkProgressSlice>>;
  /** Hide the idle progress track (no bar when list still has empty rows). */
  hideIdleProgressTrack?: boolean;
  canOpenDetails: boolean;
  isProcessing: boolean;
  detailsPanelId: string;
  detailsPanel: ReactNode;
  /** Override drawer panel classes (e.g. higher z-index over map). */
  detailsDrawerClassName?: string;
  /** When this value changes and Details can open, open the drawer (e.g. Overview harness start). */
  detailsOpenSignal?: number | string | null;
  /** Fires when the Details drawer opens or closes. */
  onDetailsOpenChange?: (open: boolean) => void;
};

type UnifiedWorkspaceChromeEmptyProgressProps = UnifiedWorkspaceChromeBaseProps & {
  /** Empty third grey band (no progress bar, no Details). */
  progressBand: "empty";
};

export type UnifiedWorkspaceChromeProps =
  | UnifiedWorkspaceChromeFullProgressProps
  | UnifiedWorkspaceChromeEmptyProgressProps;

export function UnifiedWorkspaceChrome(props: UnifiedWorkspaceChromeProps) {
  const {
    icon: Icon,
    iconClassName,
    title,
    titleRowMenu,
    titleRowEnd,
    toolbar,
    workspaceBusy,
    squareFrame = true,
    hideToolbar = false,
  } = props;

  const titleIconClassName = iconClassName ?? "text-white [&_svg]:!text-white";

  const progressBand = props.progressBand ?? "full";
  const isEmptyProgressBand = progressBand === "empty";

  const [detailsOpen, setDetailsOpen] = useState(false);

  const canOpenDetails = !isEmptyProgressBand && props.canOpenDetails;
  const detailsOpenSignal =
    !isEmptyProgressBand && "detailsOpenSignal" in props ? props.detailsOpenSignal : null;

  useEffect(() => {
    if (!canOpenDetails) {
      setDetailsOpen(false);
    }
  }, [canOpenDetails]);

  useEffect(() => {
    if (detailsOpenSignal != null && detailsOpenSignal !== "" && canOpenDetails) {
      setDetailsOpen(true);
    }
  }, [detailsOpenSignal, canOpenDetails]);

  const onDetailsOpenChange =
    !isEmptyProgressBand && "onDetailsOpenChange" in props ? props.onDetailsOpenChange : undefined;

  useEffect(() => {
    onDetailsOpenChange?.(detailsOpen);
  }, [detailsOpen, onDetailsOpenChange]);

  return (
    <div className="w-full max-w-full shrink-0 font-sans text-base font-normal">
      <div
        data-unified-workspace-chrome-frame
        className={cn(
          "relative flex w-full max-w-full flex-col overflow-visible border [&_button]:text-base [&_button]:font-normal [&_h2]:font-normal",
          squareFrame ? "rounded-none [&_button]:rounded-none [&_input]:rounded-none" : "rounded-lg",
          workspaceBusy ? "z-20 animate-meta-opt-breathe border-semantic-data/40" : "border-white/[0.08]",
        )}
      >
        <div
          className={cn(
            UNIFIED_TITLE_BAND_CLASS,
            workspaceBusy ? "animate-meta-opt-breathe" : "",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <span
                className={cn("inline-flex shrink-0 [&_svg]:h-5 [&_svg]:w-5", titleIconClassName)}
                aria-hidden
              >
                <Icon className="h-5 w-5 shrink-0" />
              </span>
              <h2 className="truncate text-base font-normal text-white">{title}</h2>
              {titleRowMenu ? (
                <>
                  <div className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />
                  {titleRowMenu}
                </>
              ) : null}
            </div>
            {titleRowEnd ? (
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden">
                {titleRowEnd}
              </div>
            ) : null}
          </div>
        </div>

        {hideToolbar ? null : (
          <nav className={UNIFIED_TOOLBAR_CLASS} aria-label={`${title} tools`}>
            {toolbar}
          </nav>
        )}

        <div className={UNIFIED_PROGRESS_BAND_CLASS} aria-hidden={isEmptyProgressBand}>
          {isEmptyProgressBand ? null : (
            <>
              <div className="flex w-full min-w-0 flex-1 items-center justify-start gap-2.5 overflow-visible">
                {props.progressLeading ? (
                  <div className="flex shrink-0 items-center justify-start">{props.progressLeading}</div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <MetaBulkMicroProgress
                    variant="embedded"
                    snapshot={props.progressSnapshot}
                    bulkActionProgress={props.bulkActionProgress}
                    hideIdleTrack={props.hideIdleProgressTrack === true}
                  />
                </div>
                <button
                  type="button"
                  className={cn(
                    "ml-auto inline-flex h-8 shrink-0 items-center gap-1 px-2 text-base font-normal transition-colors",
                    squareFrame ? "rounded-none" : "rounded-md",
                    "text-white hover:text-white/90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !canOpenDetails && "pointer-events-none opacity-40",
                  )}
                  onClick={() => setDetailsOpen((open) => !open)}
                  aria-expanded={detailsOpen}
                  aria-controls={props.detailsPanelId}
                  disabled={!canOpenDetails}
                >
                  Details
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
              </div>

              {detailsOpen && canOpenDetails ? (
                <div
                  id={props.detailsPanelId}
                  className={cn(
                    DETAILS_DRAWER_SHELL,
                    DETAILS_DRAWER_PANEL,
                    props.detailsDrawerClassName,
                  )}
                >
                  {props.detailsPanel}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
