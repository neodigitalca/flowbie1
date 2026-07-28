import React from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTENT_OPTIMIZER_PAGE_ROW_ACTIONS_CELL,
  CONTENT_OPTIMIZER_PAGE_ROW_DATE_CELL,
  CONTENT_OPTIMIZER_PAGE_ROW_TITLE_CELL,
  CONTENT_OPTIMIZER_PAGE_ROW_URL_CELL,
  contentOptimizerCopyableCellProps,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { bulkSitemapDefaultLabel } from "@/lib/bulk/bulk-sitemap-default-label";
import type { BulkRowSitemapType, BulkSitemapMode } from "@/lib/bulk/bulk-sitemap-mode";
import { cn } from "@/lib/utils";

/** Same rhythm as Content Optimizer rows; flexible columns so nothing ellipsizes. */
const BULK_CSV_PAGE_ROW_GRID_CLASS = cn(
  "grid w-full min-w-0 min-h-[3rem] grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,7rem)_auto] gap-x-2 sm:min-h-[3.25rem] sm:gap-x-3",
);

const BULK_CSV_CELL_TEXT = "whitespace-normal break-words text-sm leading-snug sm:text-base";

/** Active CSV row: blue border only (black fill unchanged). */
export const BULK_CSV_ROW_ACTIVE_CLASS = "!border-sky-500";

export type BulkCsvRunRowCompactProps = {
  keywordLabel: string;
  titleLabel: string;
  entityLabel: string;
  sitemapMode: BulkSitemapMode;
  rowSitemapType: BulkRowSitemapType;
  onRowSitemapChange?: (value: BulkRowSitemapType) => void;
  sitemapControlDisabled?: boolean;
  isExpanded: boolean;
  rowBusy: boolean;
  rowError: boolean;
  rowErrorMessage?: string;
  canDownloadRow?: boolean;
  onDownloadRow?: () => void;
  panelId?: string;
  embedded?: boolean;
  placeholder?: boolean;
  stripeIndex?: number;
  onToggle: () => void;
};

export function BulkCsvRunRowCompact({
  keywordLabel,
  titleLabel,
  entityLabel,
  sitemapMode,
  rowSitemapType,
  onRowSitemapChange,
  sitemapControlDisabled = false,
  isExpanded,
  rowBusy,
  rowError,
  rowErrorMessage,
  canDownloadRow = false,
  onDownloadRow,
  panelId,
  embedded = false,
  placeholder = false,
  stripeIndex = 0,
  onToggle,
}: BulkCsvRunRowCompactProps) {
  if (placeholder) {
    return (
      <div
        className={cn(contentOptimizerRowStripeClass(stripeIndex), BULK_CSV_PAGE_ROW_GRID_CLASS)}
        aria-hidden
      />
    );
  }

  const { className: copyableClassName } = contentOptimizerCopyableCellProps();

  return (
    <div
      className={cn(
        !embedded && contentOptimizerRowStripeClass(stripeIndex, { isActiveOptimize: rowBusy }),
        BULK_CSV_PAGE_ROW_GRID_CLASS,
        rowBusy && !embedded && BULK_CSV_ROW_ACTIVE_CLASS,
      )}
      aria-busy={rowBusy || undefined}
    >
      <div className={cn(CONTENT_OPTIMIZER_PAGE_ROW_URL_CELL, copyableClassName)}>
        <span
          className={cn(
            BULK_CSV_CELL_TEXT,
            "break-all font-bold text-zinc-100",
          )}
        >
          {keywordLabel}
        </span>
      </div>

      <div className={cn(CONTENT_OPTIMIZER_PAGE_ROW_TITLE_CELL, copyableClassName)}>
        <span className={BULK_CSV_CELL_TEXT}>{titleLabel}</span>
      </div>

      <div className={cn(CONTENT_OPTIMIZER_PAGE_ROW_DATE_CELL, copyableClassName)}>
        <span className={BULK_CSV_CELL_TEXT}>{entityLabel}</span>
      </div>

      <div className={CONTENT_OPTIMIZER_PAGE_ROW_DATE_CELL}>
        {sitemapMode === "custom" ? (
          <Select
            value={rowSitemapType}
            onValueChange={(value: BulkRowSitemapType) => onRowSitemapChange?.(value)}
            disabled={sitemapControlDisabled}
          >
            <SelectTrigger
              className="h-8 min-h-0 w-full border-0 bg-transparent px-0 text-base shadow-none focus:ring-0"
              aria-label="Row sitemap"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="post">Posts</SelectItem>
              <SelectItem value="entity">Entity</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className={cn(BULK_CSV_CELL_TEXT, "text-muted-foreground")}>
            {bulkSitemapDefaultLabel(rowSitemapType)}
          </span>
        )}
      </div>

      <div className={CONTENT_OPTIMIZER_PAGE_ROW_ACTIONS_CELL}>
        {rowError ? (
          <AlertCircle
            className="h-4 w-4 shrink-0 text-red-400"
            aria-label={rowErrorMessage?.trim() ? `Row failed: ${rowErrorMessage}` : "Row failed"}
            title={rowErrorMessage?.trim() || "Row failed"}
          />
        ) : null}
        {canDownloadRow ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
            aria-label="Download row files"
            title="Download row files"
            onClick={() => onDownloadRow?.()}
          >
            <Download className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}

        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center text-zinc-300 hover:text-white sm:h-8 sm:w-8"
          aria-expanded={isExpanded}
          aria-controls={panelId}
          aria-label={isExpanded ? "Collapse row files" : "Expand row files"}
          onClick={onToggle}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
