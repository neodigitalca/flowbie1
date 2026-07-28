import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";

/** True when this Overview row is a WordPress page (Pages bucket / page sitemap). */
export function isOverviewPageBucketRow(
  row: OverviewRow,
  sitemapSource?: OverviewSitemapSource,
): boolean {
  const pt = (row.postType ?? "").trim().toLowerCase();
  if (pt === "page" || pt === "pages") return true;
  if (pt === "post" || pt === "posts") return false;
  return sitemapSource === "pages";
}

/** Pages bucket: title is display-only; never AI-optimize or upload title changes. */
export function overviewTitleOptimizationExcluded(
  row: OverviewRow,
  sitemapSource?: OverviewSitemapSource,
): boolean {
  return isOverviewPageBucketRow(row, sitemapSource);
}
