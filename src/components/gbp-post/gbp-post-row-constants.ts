import { cn } from "@/lib/utils";

/** Checkbox | property | keyword | landing page URL | end rail */
export const GBP_POST_ROW_GRID_CLASS = cn(
  "grid w-full min-w-0 min-h-[3rem] grid-cols-[2.75rem_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1.25fr)_9rem] items-center gap-x-2 sm:min-h-[3.25rem] sm:gap-x-3",
);

export const GBP_POST_ROW_FIELD_CELL =
  "flex min-w-0 w-full items-center border-0 bg-transparent px-0 py-0";

export const GBP_POST_ROW_PROPERTY_FIELD = cn(
  "flex h-8 w-full min-w-0 items-center overflow-x-auto rounded-none border-0 bg-transparent px-1.5",
);

export const GBP_POST_ROW_PROPERTY_TEXT =
  "whitespace-nowrap text-base font-medium leading-none text-foreground";
