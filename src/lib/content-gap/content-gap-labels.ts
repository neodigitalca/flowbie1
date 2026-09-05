import { getLocalCalendarMonthAfterBeforeForMonthKey } from "@/lib/quarter-bounds";
import type { ContentGapCountMode, ContentGapSitemapSource } from "@/lib/tasks-types";

export function contentGapContentNoun(source: ContentGapSitemapSource, plural = true): string {
  if (source === "sap") return plural ? "SAP pages" : "SAP page";
  return plural ? "posts" : "post";
}

export function contentGapMeasureLabel(
  mode: ContentGapCountMode,
  source: ContentGapSitemapSource,
  monthLabel: string,
): string {
  if (mode === "sitemap") {
    return source === "sap" ? "All SAP pages on the sitemap" : "All posts on the sitemap";
  }
  const content = contentGapContentNoun(source);
  if (mode === "editorial_month") return `${content} scheduled or posted in ${monthLabel}`;
  if (mode === "scheduled_month") return `${content} scheduled to publish in ${monthLabel}`;
  return `${content} already published in ${monthLabel}`;
}
