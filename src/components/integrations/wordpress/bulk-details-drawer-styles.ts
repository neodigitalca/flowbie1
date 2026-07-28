import { cn } from "@/lib/utils";
import {
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
  CONTENT_OPTIMIZER_SQUARE_CONTROLS_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";

/** Details dropdown panel surface — continues the progress band (UnifiedWorkspaceChrome). */
export const DETAILS_DRAWER_SHELL = cn(
  "rounded-none border-0 bg-zinc-900 px-0 py-0",
  CONTENT_OPTIMIZER_SQUARE_CONTROLS_CLASS,
);

/** Full progress-band width (stay inside overflow-hidden shells; do not use negative inset). */
export const DETAILS_DRAWER_PANEL =
  "absolute left-0 right-0 top-full z-50 mt-0 max-h-[min(60vh,720px)] overflow-y-auto overscroll-y-contain bg-zinc-900";

/** Inner body padding for details panels mounted in the drawer. */
export const DETAILS_DRAWER_BODY_CLASS = "px-3 pb-3 pt-0 font-sans text-base";

/** URL / step row trigger inside a stripe (chevron + label). */
export const DETAILS_CO_ROW_TRIGGER = cn(
  "flex w-full min-h-9 items-start gap-2 border-0 px-2.5 py-1.5 text-left text-base text-white sm:px-3 sm:py-2",
);

/** Section header row inside the drawer (matches title/progress band tone). */
export const DETAILS_CO_COLLAPSE_TRIGGER =
  "flex min-h-9 w-full items-center justify-between gap-2 rounded-none border-0 bg-zinc-950 px-3 py-1.5 text-left text-base text-white [&[data-state=open]>svg]:rotate-180";

/** Active/generating harness or step row. */
export const DETAILS_CO_ROW_ACTIVE = "bg-zinc-900";

/** Flush vertical stack (same as Content Optimizer multi-site list). */
export const DETAILS_CO_STACK = CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS;

/** Expanded section body — transparent, no borders. */
export const DETAILS_CO_SECTION_BODY = "space-y-0 border-0 bg-transparent px-2.5 pb-2 pt-0 sm:px-3";

/** Single line inside section body (stripe applied via contentOptimizerRowStripeClass). */
export const DETAILS_CO_SECTION_LINE =
  "flex min-h-9 w-full items-center justify-between gap-2 border-0 px-2.5 py-1.5 text-white sm:px-3";

/** Alternating stripes — same black / zinc-950 as Content Optimizer rows. */
export function detailsDrawerRowStripeClass(
  index: number,
  { isActiveOptimize = false }: { isActiveOptimize?: boolean } = {},
): string {
  return contentOptimizerRowStripeClass(index, { isActiveOptimize });
}

export { contentOptimizerRowStripeClass };
