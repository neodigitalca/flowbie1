import type { SitemapOptimizerGscDateRange } from "@/lib/sitemap-optimizer/types";

/** Last 28 days, end ≈ today − 3 days (GSC data lag). */
export function getDefaultSitemapOptimizerGscDateRange(): SitemapOptimizerGscDateRange {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() - 3);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 28);
  return {
    startDate: startDate.toISOString().split("T")[0]!,
    endDate: endDate.toISOString().split("T")[0]!,
  };
}

/** ~16 months of Search Analytics (GSC practical maximum), end ≈ today − 3 days. */
export function getFullHistorySitemapOptimizerGscDateRange(): SitemapOptimizerGscDateRange {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() - 3);
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 16);
  return {
    startDate: startDate.toISOString().split("T")[0]!,
    endDate: endDate.toISOString().split("T")[0]!,
  };
}
