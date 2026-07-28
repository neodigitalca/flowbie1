import { cn } from "@/lib/utils";

/** Thin cyan border + soft glow for active bulk rows and harness sections (matches unified header). */
export const BULK_ACTIVE_SEMANTIC_BORDER_CLASS = cn(
  "relative z-10 overflow-visible",
  "!border-[hsl(var(--semantic-data)/0.4)]",
  "shadow-[0_0_14px_-6px_hsl(var(--semantic-data)/0.2)]",
);
