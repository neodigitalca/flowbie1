import { cn } from "@/lib/utils";

export const REPORTING_TOOLBAR_BTN =
  "mt-0 !mt-0 h-9 min-h-9 w-auto shrink-0 justify-center gap-1.5 whitespace-nowrap px-3 text-base font-semibold leading-none";

export const REPORTING_TOOLBAR_BTN_DATA =
  "border border-[hsl(var(--semantic-data)/0.48)] bg-black/30 text-foreground shadow-none transition-colors hover:border-[hsl(var(--semantic-data)/0.72)] hover:bg-[hsl(var(--semantic-data)/0.1)] disabled:border-border disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-50";

export const REPORTING_TOOLBAR_BTN_PUBLISH =
  "border border-[hsl(var(--semantic-publish)/0.48)] bg-black/30 text-foreground shadow-none transition-colors hover:border-[hsl(var(--semantic-publish)/0.72)] hover:bg-[hsl(var(--semantic-publish)/0.1)] disabled:border-border disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-50";

export function reportingToolbarButtonData(className?: string) {
  return cn(REPORTING_TOOLBAR_BTN, REPORTING_TOOLBAR_BTN_DATA, className);
}

export function reportingToolbarButtonPublish(className?: string) {
  return cn(REPORTING_TOOLBAR_BTN, REPORTING_TOOLBAR_BTN_PUBLISH, className);
}
