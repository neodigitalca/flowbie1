import { cn } from "@/lib/utils";
import { CONTENT_OPTIMIZER_BODY_INSET_CLASS } from "@/components/overview/overview-tab/overview-tab-content-constants";
import { SEO_WORKSPACE_BODY_SCROLL_CLASS, SEO_WORKSPACE_SHELL_CLASS } from "@/components/seo/seo-workspace-layout";

/** Shared layout classes for Blog Generator unified workspace headers. */
export const BLOG_GENERATOR_TAB_ROOT_CLASS = cn(
  SEO_WORKSPACE_SHELL_CLASS,
  "min-h-0 gap-0",
);

export const BLOG_GENERATOR_WORKSPACE_HEADER_CLASS = "relative z-30 shrink-0";

/** Scrollable body under unified workspace chrome - fills remaining viewport height. */
export const BLOG_GENERATOR_WORKSPACE_BODY_CLASS = cn(
  SEO_WORKSPACE_BODY_SCROLL_CLASS,
  CONTENT_OPTIMIZER_BODY_INSET_CLASS,
);

/** Compact empty rows to fill the workspace (matches Content Optimizer list density). */
export const BULK_GENERATOR_EMPTY_ROW_COUNT = 18;

export const BLOG_GENERATOR_FORM_CARD_CLASS = "p-6";
