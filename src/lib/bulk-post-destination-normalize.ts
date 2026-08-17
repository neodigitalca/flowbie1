import type { WordPressPostDestination } from "@/lib/bulk-auto-generate";

/** Normalize legacy stored bulk destinations to supported values. */
export function normalizeBulkPostDestination(value: unknown): WordPressPostDestination {
  if (value === "local") return "local";
  if (value === "bank" || value === "hybrid") return "wordpress";
  return "wordpress";
}
