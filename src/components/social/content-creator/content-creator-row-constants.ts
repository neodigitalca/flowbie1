import { cn } from "@/lib/utils";
import type { ContentCalendarRow } from "@/lib/social/content-creator-types";

export const CONTENT_CREATOR_PLACEHOLDER_ROW_COUNT = 18;

export function contentCreatorGridRowCount(realRowCount: number): number {
  return Math.max(CONTENT_CREATOR_PLACEHOLDER_ROW_COUNT, realRowCount);
}

export function buildContentCreatorGridRows(rows: ContentCalendarRow[]): Array<ContentCalendarRow | null> {
  const totalRows = contentCreatorGridRowCount(rows.length);
  return Array.from({ length: totalRows }, (_, index) => rows[index] ?? null);
}

export const CONTENT_CREATOR_ROW_GRID_CLASS = cn(
  "grid w-full min-w-0 min-h-[3rem] grid-cols-[minmax(0,1fr)_minmax(0,1.75fr)_9rem] items-center gap-x-2 sm:min-h-[3.25rem] sm:gap-x-3",
);

export const CONTENT_CREATOR_ROW_FIELD_CELL =
  "flex min-w-0 w-full items-center border-0 bg-transparent px-0 py-0";

export const CONTENT_CREATOR_ROW_CONTENT_SPAN_CLASS =
  "col-start-1 col-span-2 flex min-w-0 items-center gap-2 pl-[5px]";
