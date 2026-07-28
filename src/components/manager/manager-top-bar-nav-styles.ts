import { cn } from "@/lib/utils";

/** Square grey nav controls for the manager top bar (#000 background). */
export const MANAGER_TOP_BAR_CLASS = "bg-black";

export const MANAGER_NAV_TRIGGER_BASE =
  "inline-flex items-center gap-2 rounded-none px-3 text-base font-normal outline-none transition-colors focus-visible:ring-2 focus-visible:ring-zinc-600 focus-visible:ring-offset-0";

export const MANAGER_NAV_TRIGGER_INACTIVE =
  "bg-zinc-900 text-muted-foreground hover:bg-zinc-800 hover:text-foreground data-[state=open]:bg-zinc-800 data-[state=open]:text-foreground";

export const MANAGER_NAV_TRIGGER_ACTIVE =
  "bg-zinc-800 text-foreground hover:bg-zinc-700 hover:text-foreground";

export const MANAGER_NAV_DROPDOWN_PANEL =
  "z-50 min-w-[16.5rem] rounded-none border border-white/[0.06] bg-zinc-950 p-0 shadow-none";

export const MANAGER_NAV_DROPDOWN_ITEM_BASE =
  "cursor-pointer rounded-none px-3 py-2.5 text-base font-normal outline-none transition-colors focus:!bg-zinc-800/90 focus:!text-foreground data-[highlighted]:!bg-zinc-800/90 data-[highlighted]:!text-foreground";

/** Subtle stripe for rows; active row matches workspace pill (primary + black text). */
export const managerNavDropdownRowClass = (index: number, selected: boolean) =>
  cn(
    !selected && (index % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/55"),
    !selected && "text-muted-foreground hover:bg-zinc-800/90 hover:text-foreground",
    selected &&
      "bg-primary text-black hover:bg-primary hover:text-black focus:!bg-primary focus:!text-black data-[highlighted]:!bg-primary data-[highlighted]:!text-black",
  );

/** Square grey icon buttons on the top bar (Knowledge Base, etc.). */
export const MANAGER_TOP_BAR_ICON_BTN =
  "rounded-none border-0 bg-zinc-900 text-muted-foreground shadow-none hover:bg-zinc-800 hover:text-foreground";

export const MANAGER_TOP_BAR_ICON_BTN_ACTIVE =
  "bg-zinc-800 text-foreground ring-1 ring-inset ring-white/10 hover:bg-zinc-700";
