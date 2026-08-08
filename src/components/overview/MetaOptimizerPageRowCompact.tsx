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
  CONTENT_OPTIMIZER_ACTIVE_ROW_TEXT_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { metaDisplayTitle, overviewRowDateLabel } from "@/lib/overview/overview-tab-display";
import { Input } from "@/components/ui/input";
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
  /** Details drawer: formatted publish label when ISO date is unavailable. */
  dateLabelOverride?: string;
  onToggle: () => void;
  /** Details drawer: edit date and sync ACF on commit. */
  editableDate?: boolean;
  onDateModifierChange?: (dateIso: string) => void;
  onDateModifierCommit?: () => void;
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
  dateLabelOverride,
  editableDate = false,
  onDateModifierChange,
  onDateModifierCommit,
}: MetaOptimizerPageRowCompactProps) {
  const urlTrim = row.url?.trim() ?? "";
  const isSyntheticUrl = urlTrim.startsWith("#");
  const hasLiveUrl = Boolean(urlTrim) && !isSyntheticUrl;
  const isDisplayRow = Boolean(urlTrim);
  const isEmptyShell = placeholder || !isDisplayRow;
  const titleLabel = isSyntheticUrl
    ? (row.title?.trim() || "")
    : hasLiveUrl
      ? metaDisplayTitle(row, wpTitlesByUrl) || ""
      : "";
  const keywordLabel = isDisplayRow ? (row.focusKeyword ?? "").trim() : "";
  const wikiSummary = row.blogWikiLinkSummary?.trim() ?? "";
  const middleLabel =
    row.status === "ai-wikipedia-link"
      ? wikiSummary || "Wikipedia link…"
      : wikiSummary || keywordLabel;
  const dateRaw = isDisplayRow ? overviewRowDateLabel(row) : "";
  const dateFromRow = dateRaw === " - " ? "" : dateRaw;
  const dateLabel = dateLabelOverride?.trim() || dateFromRow;
  const activeTextClass = isActiveOptimize ? CONTENT_OPTIMIZER_ACTIVE_ROW_TEXT_CLASS : undefined;

  const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEmptyShell) return;
    if ((e.target as HTMLElement).closest("button, a, [role='combobox'], input, textarea")) return;
    onToggle();
  };

  const showTitleGrid = !isExpanded || embedded;

  return (
    <div
      className={cn(
        !embedded && contentOptimizerRowStripeClass(stripeIndex, { isActiveOptimize }),
        !embedded && !isActiveOptimize && "hover:bg-zinc-900",
        showTitleGrid
          ? CONTENT_OPTIMIZER_PAGE_ROW_GRID_CLASS
          : CONTENT_OPTIMIZER_PAGE_ROW_EXPANDED_GRID_CLASS,
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
      {showTitleGrid ? (
        <>
          <div className={CONTENT_OPTIMIZER_PAGE_ROW_URL_CELL}>
            {hasLiveUrl ? (
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                title={row.url}
                className={cn(
                  "whitespace-normal break-words text-base font-bold leading-snug hover:underline",
                  activeTextClass ?? "text-zinc-100 hover:text-cyan-300",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {titleLabel}
              </a>
            ) : (
              <span
                className={cn(
                  "whitespace-normal break-words text-base font-bold leading-snug",
                  activeTextClass ?? "text-zinc-100",
                )}
              >
                {titleLabel}
              </span>
            )}
          </div>

          <div
            className={cn(
              CONTENT_OPTIMIZER_PAGE_ROW_TITLE_CELL,
              isActiveOptimize &&
                "[&_span]:!text-sky-400 [&_span]:drop-shadow-[0_0_10px_rgba(56,189,248,0.55)]",
            )}
          >
            <span className={cn("whitespace-normal break-words text-sm leading-snug sm:text-base", activeTextClass)}>
              {middleLabel}
            </span>
          </div>

          <div
            className={cn(
              CONTENT_OPTIMIZER_PAGE_ROW_DATE_CELL,
              isActiveOptimize &&
                "!text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.55)] [&_span]:!text-sky-400",
            )}
          >
            {editableDate && onDateModifierChange ? (
              <Input
                type="date"
                value={row.dateModifier || ""}
                onChange={(e) => onDateModifierChange(e.target.value)}
                onBlur={() => onDateModifierCommit?.()}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className={cn(
                  "h-8 min-w-0 w-full border-0 bg-transparent px-0 py-0 text-base shadow-none focus-visible:ring-0",
                  activeTextClass,
                )}
                aria-label="Date modifier"
              />
            ) : (
              <span className={cn("whitespace-nowrap", activeTextClass)}>{dateLabel}</span>
            )}
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
