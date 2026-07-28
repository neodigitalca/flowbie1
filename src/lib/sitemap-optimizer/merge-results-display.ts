import type { SitemapOptimizerMergeRecommendation } from "@/lib/sitemap-optimizer/types";

const MERGE_GROUP_TINTS = [
  "bg-[hsl(var(--semantic-analysis)/0.14)]",
  "bg-[hsl(var(--semantic-data)/0.14)]",
  "bg-[hsl(var(--semantic-publish)/0.14)]",
] as const;

const PRIORITY_ORDER: Record<SitemapOptimizerMergeRecommendation["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function mergeGroupTintClass(index: number): string {
  return MERGE_GROUP_TINTS[index % MERGE_GROUP_TINTS.length]!;
}

/** Removes compression split suffixes like "Title (2)" — not 4-digit years like "(2024)". */
function stripTrailingPartIndex(title: string): string {
  const stripped = title.replace(/\s\(\d{1,2}\)\s*$/, "").trim();
  return stripped || title;
}

export function displayPostTitle(title: string): string {
  const t = title.trim();
  if (!t) return "Untitled";
  let decoded: string;
  if (typeof document === "undefined") {
    decoded = t
      .replace(/&#0*38;/gi, "&")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#0*39;/gi, "'");
  } else {
    const el = document.createElement("textarea");
    el.innerHTML = t;
    decoded = el.value.trim() || t;
  }
  return stripTrailingPartIndex(decoded);
}

export function priorityBadgeClass(
  priority: SitemapOptimizerMergeRecommendation["priority"],
): string {
  switch (priority) {
    case "high":
      return "bg-[hsl(var(--semantic-analysis)/0.22)] text-[hsl(var(--semantic-analysis-foreground))]";
    case "medium":
      return "bg-[hsl(var(--semantic-data)/0.22)] text-[hsl(var(--semantic-data-foreground))]";
    default:
      return "bg-muted/40 text-muted-foreground";
  }
}

export function sortMergesByPriority(
  merges: SitemapOptimizerMergeRecommendation[],
): SitemapOptimizerMergeRecommendation[] {
  return [...merges].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );
}
