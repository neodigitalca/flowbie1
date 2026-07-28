import { cn } from "@/lib/utils";

/** Matches multi-site row horizontal inset. */
export const KB_ROSTER_LIST_INSET_CLASS = "px-0 sm:px-1";

export const KB_ROSTER_SHELL_INSET_CLASS = "px-2.5 sm:px-3";

/** icon | name (1fr) | size (6rem) | star | download | delete */
export const KB_ROSTER_ROW_GRID_CLASS = cn(
  "grid w-full min-h-[3rem] grid-cols-[2.75rem_minmax(0,1fr)_6rem_2.75rem_2.75rem_2.75rem] items-center gap-x-2 py-1 sm:min-h-[3.25rem] sm:gap-x-3",
);
