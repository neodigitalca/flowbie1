import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { WP_PANEL_LIST_GAP, WP_PANEL_ROW_TILE } from "./wordpress-panel-chrome";

export type BankRowLike = {
  id: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  created_at: string | null;
  scheduled_date_gmt: string | null;
};

function formatBankDate(iso: string | null | undefined): string | null {
  const raw = typeof iso === "string" ? iso.trim() : "";
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Prefer scheduled publish (GMT); otherwise fall back to when the row was banked. */
function publicationDisplay(scheduled: string | null, created: string | null): {
  text: string;
  fromSchedule: boolean;
} {
  const scheduledText = formatBankDate(scheduled);
  if (scheduledText) return { text: scheduledText, fromSchedule: true };
  const createdText = formatBankDate(created);
  if (createdText) return { text: createdText, fromSchedule: false };
  return { text: "—", fromSchedule: false };
}

const rowGrid = "grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(7.5rem,10.5rem)] items-start gap-x-2";

export interface BankPropertyRowsGridProps {
  rows: BankRowLike[];
  selected: Set<string>;
  onToggleId: (id: string) => void;
}

export const BankPropertyRowsGrid: React.FC<BankPropertyRowsGridProps> = ({ rows, selected, onToggleId }) => {
  return (
    <div className={cn(WP_PANEL_LIST_GAP, "min-w-0")}>
      <div className={cn(rowGrid, "px-1")} role="row">
        <div className="min-w-0" aria-hidden />
        <div
          className="min-w-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          role="columnheader"
        >
          Title
        </div>
        <div
          className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          role="columnheader"
        >
          Publication
        </div>
      </div>
      {rows.map((r) => {
        const pub = publicationDisplay(r.scheduled_date_gmt, r.created_at);
        return (
          <div key={r.id} className={cn(WP_PANEL_ROW_TILE, rowGrid, "gap-y-1 py-2.5 pr-1")} role="row">
            <div className="flex shrink-0 items-start justify-center pt-0.5">
              <Checkbox
                checked={selected.has(r.id)}
                onCheckedChange={() => onToggleId(r.id)}
                className="shrink-0"
                aria-label={`Select ${r.title || r.id}`}
              />
            </div>
            <div className="min-w-0 whitespace-normal break-words text-base font-medium leading-snug text-foreground">
              {r.title?.trim() ? r.title : "Untitled"}
            </div>
            <div
              className={cn(
                "text-right text-sm tabular-nums leading-snug",
                pub.fromSchedule ? "text-foreground" : "text-muted-foreground",
              )}
              title={
                pub.fromSchedule
                  ? "Scheduled publication (GMT)"
                  : pub.text !== "—"
                    ? "No publish schedule — date added to bank"
                    : undefined
              }
            >
              {pub.text}
            </div>
          </div>
        );
      })}
    </div>
  );
};
