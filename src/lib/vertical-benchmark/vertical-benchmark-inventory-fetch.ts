import { bulkOptimizerInventoryCollections } from "@/hooks/content-optimization/bulk-optimization-load-inventory-snapshot";
import type { WordPressSite } from "@/components/integrations/types";
import type { VerticalBenchmarkContentKind } from "@/lib/vertical-benchmark/vertical-benchmark-types";

/** WordPress published post count above this triggers capped inventory (one probe page). */
export const BENCHMARK_LARGE_SITE_POST_TOTAL = 200;

/** REST collections for curate inventory (skip entity CPTs when only post rows are needed). */
export function benchmarkCurateInventoryCollections(
  site: WordPressSite,
  contentKinds: VerticalBenchmarkContentKind[],
): string[] {
  if (!contentKinds.includes("entity")) {
    return ["posts", "pages"];
  }
  return bulkOptimizerInventoryCollections(site);
}

export function benchmarkInventoryStepDetail(
  rowCount: number,
  truncated: boolean,
): string {
  if (truncated) {
    return `${rowCount} URLs (large site cap)`;
  }
  return `${rowCount} URLs`;
}
