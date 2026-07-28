import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

export type GscSitePerformanceBenchmarks = {
  urlCount: number;
  totalClicks: number;
  totalImpressions: number;
  medianClicks: number;
  medianImpressions: number;
  p25Clicks: number;
  p75Clicks: number;
  p25Impressions: number;
  p75Impressions: number;
  medianCtr: number;
  medianPosition: number;
};

export type GscRowPerformanceRanks = {
  clicksPercentile: number;
  impressionsPercentile: number;
};

function sortedNumeric(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const weight = idx - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}

function rankPercentile(value: number, sorted: number[]): number {
  if (!sorted.length) return 0;
  let below = 0;
  for (const v of sorted) {
    if (v < value) below += 1;
    else if (v === value) below += 0.5;
  }
  return Math.round((below / sorted.length) * 100);
}

export function buildGscSitePerformanceBenchmarks(
  rows: readonly SitemapOptimizerPostRow[],
): GscSitePerformanceBenchmarks {
  const clicks = rows.map((r) => r.gscPageClicks ?? 0);
  const impressions = rows.map((r) => r.gscPageImpressions ?? 0);
  const ctrs = rows
    .map((r) => r.gscPageCtr ?? (r.gscPageImpressions ? (r.gscPageClicks ?? 0) / r.gscPageImpressions! : 0))
    .filter((v) => Number.isFinite(v));
  const positions = rows
    .map((r) => r.gscPagePosition ?? 0)
    .filter((v) => v > 0);

  const sortedClicks = sortedNumeric(clicks);
  const sortedImpressions = sortedNumeric(impressions);
  const sortedCtr = sortedNumeric(ctrs);
  const sortedPos = sortedNumeric(positions);

  return {
    urlCount: rows.length,
    totalClicks: clicks.reduce((a, b) => a + b, 0),
    totalImpressions: impressions.reduce((a, b) => a + b, 0),
    medianClicks: percentile(sortedClicks, 50),
    medianImpressions: percentile(sortedImpressions, 50),
    p25Clicks: percentile(sortedClicks, 25),
    p75Clicks: percentile(sortedClicks, 75),
    p25Impressions: percentile(sortedImpressions, 25),
    p75Impressions: percentile(sortedImpressions, 75),
    medianCtr: percentile(sortedCtr, 50),
    medianPosition: percentile(sortedPos, 50),
  };
}

export function gscRowPerformanceRanks(
  row: SitemapOptimizerPostRow,
  allRows: readonly SitemapOptimizerPostRow[],
): GscRowPerformanceRanks {
  const clicks = allRows.map((r) => r.gscPageClicks ?? 0);
  const impressions = allRows.map((r) => r.gscPageImpressions ?? 0);
  const sortedClicks = sortedNumeric(clicks);
  const sortedImpressions = sortedNumeric(impressions);
  return {
    clicksPercentile: rankPercentile(row.gscPageClicks ?? 0, sortedClicks),
    impressionsPercentile: rankPercentile(row.gscPageImpressions ?? 0, sortedImpressions),
  };
}

export function formatGscBenchmarksForPrompt(benchmarks: GscSitePerformanceBenchmarks): string {
  return [
    `Site GSC snapshot (${benchmarks.urlCount} URLs in scope):`,
    `- Total clicks: ${benchmarks.totalClicks}, total impressions: ${benchmarks.totalImpressions}`,
    `- Median clicks: ${benchmarks.medianClicks}, p25: ${benchmarks.p25Clicks}, p75: ${benchmarks.p75Clicks}`,
    `- Median impressions: ${benchmarks.medianImpressions}, p25: ${benchmarks.p25Impressions}, p75: ${benchmarks.p75Impressions}`,
    `- Median CTR: ${(benchmarks.medianCtr * 100).toFixed(2)}%, median position: ${benchmarks.medianPosition.toFixed(1)}`,
  ].join("\n");
}
