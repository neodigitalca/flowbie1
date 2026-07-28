import { describe, expect, it } from "vitest";
import { OVERVIEW_RESEARCH_ROW_CONCURRENCY_MAX } from "@/lib/overview/overview-research-batch-constants";
import { overviewBulkPageRanges } from "@/lib/overview/overview-bulk-page-size";

describe("overview research batch limits", () => {
  it("caps row concurrency at 20", () => {
    expect(OVERVIEW_RESEARCH_ROW_CONCURRENCY_MAX).toBeLessThanOrEqual(20);
  });

  it("splits 250 eligible rows into three page slices of 100", () => {
    const ranges = overviewBulkPageRanges(250);
    expect(ranges).toHaveLength(3);
    expect(ranges[0]).toMatchObject({ start: 0, end: 100, page: 1, pageCount: 3 });
    expect(ranges[1]).toMatchObject({ start: 100, end: 200, page: 2, pageCount: 3 });
    expect(ranges[2]).toMatchObject({ start: 200, end: 250, page: 3, pageCount: 3 });
  });
});
