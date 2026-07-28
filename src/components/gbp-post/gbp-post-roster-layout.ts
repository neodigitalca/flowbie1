import { cn } from "@/lib/utils";

/** Matches `CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS` horizontal inset. */
export const GBP_ROSTER_LIST_INSET_CLASS = "px-0 sm:px-1";

/** Matches row shell horizontal padding. */
export const GBP_ROSTER_SHELL_INSET_CLASS = "px-2.5 sm:px-3";

/** Checkbox | client field (flex) | topic (fixed) | chevron */
export const GBP_ROSTER_ROW_GRID_CLASS = cn(
  "grid w-full min-h-[3rem] grid-cols-[2.75rem_minmax(0,1fr)_10rem_2.75rem] items-center gap-x-2 py-1 sm:min-h-[3.25rem] sm:gap-x-3",
);

/** Read-only client name — flush on row stripe, no border. */
export const GBP_ROSTER_SITE_NAME_FIELD = cn(
  "flex h-8 w-full min-w-0 items-center overflow-x-auto rounded-none border-0 bg-transparent px-1.5",
);

export const GBP_ROSTER_SITE_NAME_TEXT =
  "whitespace-nowrap text-base font-medium leading-none text-foreground";

export const GBP_ROSTER_TOPIC_CELL = "w-full shrink-0";

/** Negates `UNIFIED_TOOLBAR_CLASS` padding so roster columns line up with list rows. */
export const GBP_ROSTER_TOOLBAR_BLEED_CLASS = "-mx-3 w-[calc(100%+1.5rem)] sm:-mx-3.5 sm:w-[calc(100%+1.75rem)]";

export const GBP_ROSTER_TOOLBAR_GRID_CLASS = cn(
  "grid w-full min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto_auto] items-center gap-x-2 sm:gap-x-3",
  GBP_ROSTER_SHELL_INSET_CLASS,
);
