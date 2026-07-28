import { ArrowUpDown } from "lucide-react";
import { BULK_HEADER_TOOL_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Dispatch, SetStateAction } from "react";

export type OverviewContentSortControlsProps = {
  sortColumn: "title" | "date" | null;
  sortDir: "asc" | "desc";
  setSortColumn: Dispatch<SetStateAction<"title" | "date" | null>>;
  setSortDir: Dispatch<SetStateAction<"asc" | "desc">>;
  disabled?: boolean;
  showSortLabel?: boolean;
};

export function OverviewContentSortControls({
  sortColumn,
  sortDir,
  setSortColumn,
  setSortDir,
  disabled = false,
  showSortLabel = true,
}: OverviewContentSortControlsProps) {
  return (
    <div
      className="flex shrink-0 flex-nowrap items-center gap-1.5"
      role="group"
      aria-label="Sort rows"
    >
      {showSortLabel ? (
        <span className="text-base font-medium uppercase tracking-wide text-muted-foreground">Sort</span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        className={cn(
          BULK_HEADER_TOOL_BTN,
          "h-8 rounded-none px-2.5",
          sortColumn === "title" && "bg-primary text-black hover:bg-primary hover:text-black",
        )}
        onClick={() => {
          if (sortColumn !== "title") {
            setSortColumn("title");
            setSortDir("asc");
          } else {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          }
        }}
      >
        Title{" "}
        <span className="inline-flex text-foreground" aria-hidden>
          {sortColumn === "title" ? (
            sortDir === "asc" ? (
              "\u2191"
            ) : (
              "\u2193"
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-60" strokeWidth={2.25} />
          )}
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        className={cn(
          BULK_HEADER_TOOL_BTN,
          "h-8 rounded-none px-2.5",
          sortColumn === "date" && "bg-primary text-black hover:bg-primary hover:text-black",
        )}
        onClick={() => {
          if (sortColumn !== "date") {
            setSortColumn("date");
            setSortDir("asc");
          } else {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          }
        }}
      >
        Date{" "}
        <span className="inline-flex text-foreground" aria-hidden>
          {sortColumn === "date" ? (
            sortDir === "asc" ? (
              "\u2191"
            ) : (
              "\u2193"
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-60" strokeWidth={2.25} />
          )}
        </span>
      </Button>
    </div>
  );
}
