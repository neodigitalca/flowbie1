import { cn } from "@/lib/utils";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_SELECT_TRIGGER,
  BULK_HEADER_TOOL_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";

/** Single-row generator toolbar root (matches UNIFIED_TOOLBAR_CLASS gap). */
export const GENERATOR_TOOLBAR_ROOT_CLASS =
  "flex w-full min-w-0 flex-nowrap items-center gap-1.5";

/** Left zone: uploads, keyword, main intent. */
export const GENERATOR_TOOLBAR_PRIMARY_CLASS =
  "flex min-w-0 flex-1 flex-nowrap items-center gap-1.5";

/** Middle zone: fixed-width selects and toggles. */
export const GENERATOR_TOOLBAR_OPTIONS_CLASS =
  "flex shrink-0 flex-nowrap items-center gap-1.5";

/** Right zone: run / clear cluster. */
export const GENERATOR_TOOLBAR_ACTIONS_CLASS =
  "ml-auto flex shrink-0 flex-nowrap items-center gap-1.5";

export const GENERATOR_FIELD_KEYWORD = cn(BULK_HEADER_FIELD, "w-[10rem] shrink-0 text-base");

export const GENERATOR_FIELD_TITLE = cn(BULK_HEADER_FIELD, "w-[10rem] shrink-0 text-base");

export const GENERATOR_FIELD_COUNT = cn(
  BULK_HEADER_FIELD,
  "w-[3.25rem] shrink-0 text-center font-mono text-base tabular-nums",
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-auto [&::-webkit-outer-spin-button]:appearance-auto",
);

export const GENERATOR_FIELD_FLEX = cn(BULK_HEADER_FIELD, "min-w-0 flex-1 text-base");

export const GENERATOR_FIELD_URL = cn(BULK_HEADER_FIELD, "min-w-0 max-w-md flex-1 font-mono text-base");

export const GENERATOR_SELECT = cn(BULK_HEADER_SELECT_TRIGGER, "w-[9rem] shrink-0");

export const GENERATOR_EXPORT_BTN = cn(
  BULK_HEADER_TOOL_BTN,
  "min-h-8 border-0 bg-[hsl(var(--muted)/0.45)] shadow-none transition-colors hover:bg-[hsl(var(--muted)/0.6)] disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-50",
);

export const GENERATOR_NESTED_SHELL = cn(
  "flex h-8 shrink-0 items-center gap-1 rounded-none bg-zinc-900 px-1.5 py-0 focus-within:ring-0",
);

export const GENERATOR_NESTED_LABEL = "shrink-0 text-base text-muted-foreground";

export const GENERATOR_NESTED_NUM_INPUT = cn(
  "h-8 w-[3.75rem] min-w-[3.75rem] shrink-0 border-0 bg-transparent pl-0.5 pr-3 text-right text-base tabular-nums text-foreground shadow-none focus-visible:outline-none focus-visible:ring-0",
);

/** Reserve fixed slot when a conditional control is hidden (prevents horizontal CLS). */
export const GENERATOR_TOOLBAR_SLOT_RESERVE = "invisible pointer-events-none shrink-0";
