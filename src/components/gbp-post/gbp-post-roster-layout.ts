import { cn } from "@/lib/utils";

/** Matches `CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS` horizontal inset. */
export const GBP_ROSTER_LIST_INSET_CLASS = "px-0 sm:px-1";

/** Matches row shell horizontal padding. */
export const GBP_ROSTER_SHELL_INSET_CLASS = "px-2.5 sm:px-3";

export { GBP_POST_ROW_GRID_CLASS as GBP_ROSTER_ROW_GRID_CLASS } from "@/components/gbp-post/gbp-post-row-constants";

/** Negates `UNIFIED_TOOLBAR_CLASS` padding so roster columns line up with list rows. */
export const GBP_ROSTER_TOOLBAR_BLEED_CLASS = "-mx-3 w-[calc(100%+1.5rem)] sm:-mx-3.5 sm:w-[calc(100%+1.75rem)]";

/** Checkbox | property spacer | posts count | Post button */
export const GBP_ROSTER_TOOLBAR_GRID_CLASS = cn(
  "grid w-full min-w-0 grid-cols-[2.75rem_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1.25fr)_9rem] items-center gap-x-2 sm:gap-x-3",
  GBP_ROSTER_SHELL_INSET_CLASS,
);
