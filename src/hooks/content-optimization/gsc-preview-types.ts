/** Last GSC page-performance fetch for Content Optimizer preview (last calendar month, top queries). */
export type GscPerformancePreviewSnapshot = {
  pageUrl: string;
  dateRange: { startDate: string; endDate: string };
  queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  fetchedAt: number;
};

/** Per-target URL snapshots for a site (bulk fleet rows + single-post current URL). */
export type GscPerformancePreviewByUrl = Record<string, GscPerformancePreviewSnapshot | null>;
