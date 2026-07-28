import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  CONTENT_OPTIMIZER_PAGE_ROW_ACTIONS_CELL,
  CONTENT_OPTIMIZER_PAGE_ROW_DATE_CELL,
  CONTENT_OPTIMIZER_PAGE_ROW_EXPANDED_GRID_CLASS,
  CONTENT_OPTIMIZER_PAGE_ROW_GRID_CLASS,
  CONTENT_OPTIMIZER_PAGE_ROW_TITLE_CELL,
  CONTENT_OPTIMIZER_PAGE_ROW_URL_CELL,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { metaDisplayTitle, overviewRowDateLabel } from "@/lib/overview/overview-tab-display";
import { cn } from "@/lib/utils";

export interface MetaOptimizerPageRowCompactProps {
  row: OverviewRow;
  wpTitlesByUrl: Record<string, string>;
  isExpanded: boolean;
  placeholder?: boolean;
  panelId?: string;
  /** When true, skip outer shell (used inside expanded accordion wrapper). */
  embedded?: boolean;
  stripeIndex?: number;
  isActiveOptimize?: boolean;
  onToggle: () => void;
}

export function MetaOptimizerPageRowCompact({
  row,
  wpTitlesByUrl,
  isExpanded,
  placeholder = false,
  panelId,
  embedded = false,
  stripeIndex = 0,
  isActiveOptimize = false,
  onToggle,
}: MetaOptimizerPageRowCompactProps) {
  const hasUrl = Boolean(row.url?.trim());
  const isEmptyShell = placeholder || !hasUrl;
  const titleLabel = hasUrl ? metaDisplayTitle(row, wpTitlesByUrl) || "" : "";
  const keywordLabel = hasUrl ? (row.focusKeyword ?? "").trim() : "";
  const dateRaw = hasUrl ? overviewRowDateLabel(row) : "";
  const dateLabel = dateRaw === " - " ? "" : dateRaw;

  const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEmptyShell) return;
    if ((e.target as HTMLElement).closest("button, a, [role='combobox'], input, textarea")) return;
    onToggle();
  };

  return (
    <div
      className={cn(
        !embedded && contentOptimizerRowStripeClass(stripeIndex, { isActiveOptimize }),
        !embedded && !isActiveOptimize && "hover:bg-zinc-900",
        isExpanded ? CONTENT_OPTIMIZER_PAGE_ROW_EXPANDED_GRID_CLASS : CONTENT_OPTIMIZER_PAGE_ROW_GRID_CLASS,
        !isEmptyShell && "cursor-pointer",
      )}
      role="button"
      tabIndex={isEmptyShell ? -1 : 0}
      aria-expanded={isExpanded}
      aria-controls={panelId}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (isEmptyShell) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {!isExpanded ? (
        <>
          <div className={CONTENT_OPTIMIZER_PAGE_ROW_URL_CELL}>
            {hasUrl ? (
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                title={row.url}
                className="whitespace-normal break-words text-base font-bold leading-snug text-zinc-100 hover:text-cyan-300 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {titleLabel}
              </a>
            ) : (
              <span className="whitespace-normal break-words text-base font-bold leading-snug text-zinc-100">
                {titleLabel}
              </span>
            )}
          </div>

          <div className={CONTENT_OPTIMIZER_PAGE_ROW_TITLE_CELL}>
            <span className="whitespace-normal break-words text-sm leading-snug sm:text-base">
              {keywordLabel}
            </span>
          </div>

          <div className={CONTENT_OPTIMIZER_PAGE_ROW_DATE_CELL}>
            <span className="whitespace-nowrap">{dateLabel}</span>
          </div>
        </>
      ) : null}

      <div className={CONTENT_OPTIMIZER_PAGE_ROW_ACTIONS_CELL}>
        {!isEmptyShell ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center sm:h-8 sm:w-8" aria-hidden>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-zinc-300" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-300" />
            )}
          </span>
        ) : null}
      </div>
    </div>
  );
}
