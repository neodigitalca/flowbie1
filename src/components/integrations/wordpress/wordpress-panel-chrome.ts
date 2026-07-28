import { cn } from "@/lib/utils";

/** Root wrapper for a property sub-tab (borderless tonal block). */
export const WP_PANEL_SECTION_SHELL = cn("rounded-lg border-0 bg-card p-3 shadow-none");

/** Date ranges, summaries, info bands (no hairline box). */
export const WP_PANEL_INSET_BAND = cn("space-y-1 rounded-lg border-0 bg-muted p-3 text-base");

/** Vertical list with gap instead of dividers. */
export const WP_PANEL_LIST_GAP = "flex flex-col gap-2";

/** Scrollable list region (matches SitemapSection child sitemap list). */
export const WP_PANEL_LIST_SCROLL = "max-h-[min(50vh,420px)] overflow-y-auto";

/**
 * Row action / toolbar buttons (matches SitemapSection `smBtnRow` + h-10 triggers).
 * Use with `variant="ghost"`.
 */
export const WP_PANEL_TOOLBAR_BTN = cn(
  "h-10 min-h-10 shrink-0 gap-1 rounded-md border-0 bg-secondary px-3 text-base text-foreground shadow-none",
  "hover:bg-tile-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

/** One list row: near-canvas inset vs `bg-card` shells (see `--background` vs `--card` in index.css). */
export const WP_PANEL_ROW_TILE = cn(
  "rounded-md border-0 bg-background px-3 py-2 text-base text-foreground shadow-none transition-colors",
);

export const WP_PANEL_ROW_TILE_INTERACTIVE = cn(WP_PANEL_ROW_TILE, "hover:bg-tile-hover");

/** Section title / label line. */
export const WP_PANEL_LABEL = "text-base font-semibold tracking-tight text-foreground";

/** Secondary body copy. */
export const WP_PANEL_MUTED = "text-base text-muted-foreground";

/** Popovers and select menus: theme tokens, no green frame. */
export const WP_POPOVER_CONTENT = cn("border-0 bg-popover text-popover-foreground shadow-md");

/** Select dropdown panel. */
export const WP_SELECT_CONTENT = cn("border-0 bg-popover text-popover-foreground");

/** Select trigger: muted well, h-10. */
export const WP_SELECT_TRIGGER = cn(
  "h-10 min-h-10 flex-1 border-0 bg-muted text-base text-foreground shadow-none",
  "focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
);

/** Calendar / date popover trigger. */
export const WP_DATE_TRIGGER = cn(
  "h-10 min-h-10 w-full justify-start border-0 bg-muted text-base font-normal text-foreground shadow-none",
  "hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
);
