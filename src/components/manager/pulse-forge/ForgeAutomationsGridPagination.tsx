import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BULK_HEADER_ICON_TOOL_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  clampForgeAutomationsPageIndex,
  forgeAutomationsPageCount,
} from "@/lib/pulse-forge/forge-automations-pagination";
import { cn } from "@/lib/utils";

export type ForgeAutomationsGridPaginationProps = {
  pageIndex: number;
  totalCount: number;
  onPageChange: (pageIndex: number) => void;
  className?: string;
};

export function ForgeAutomationsGridPagination({
  pageIndex,
  totalCount,
  onPageChange,
  className,
}: ForgeAutomationsGridPaginationProps): React.ReactElement {
  const pageCount = forgeAutomationsPageCount(totalCount);
  const safePageIndex = clampForgeAutomationsPageIndex(pageIndex, totalCount);
  const onFirstPage = safePageIndex <= 0;
  const onLastPage = safePageIndex >= pageCount - 1;
  const hidden = totalCount <= 0;

  return (
    <nav
      aria-label={
        hidden
          ? "Automations pagination"
          : `Automations pagination, page ${safePageIndex + 1} of ${pageCount}`
      }
      aria-hidden={hidden}
      className={cn(
        "flex h-10 shrink-0 items-center justify-center gap-2",
        hidden && "pointer-events-none invisible",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Previous page"
        disabled={onFirstPage || hidden}
        onClick={() => onPageChange(Math.max(0, safePageIndex - 1))}
        className={BULK_HEADER_ICON_TOOL_BTN}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-[2.5rem] text-center text-base tabular-nums text-white">
        {safePageIndex + 1}
      </span>
      <button
        type="button"
        aria-label="Next page"
        disabled={onLastPage || hidden}
        onClick={() => onPageChange(Math.min(pageCount - 1, safePageIndex + 1))}
        className={BULK_HEADER_ICON_TOOL_BTN}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}
