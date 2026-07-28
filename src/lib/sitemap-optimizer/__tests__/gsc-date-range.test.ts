import { describe, expect, it } from "vitest";
import { getFullHistorySitemapOptimizerGscDateRange } from "@/lib/sitemap-optimizer/gsc-date-range";

describe("getFullHistorySitemapOptimizerGscDateRange", () => {
  it("returns ~16 month span ending a few days before today", () => {
    const { startDate, endDate } = getFullHistorySitemapOptimizerGscDateRange();
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const months =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (end.getUTCMonth() - start.getUTCMonth());
    expect(months).toBeGreaterThanOrEqual(15);
    expect(months).toBeLessThanOrEqual(17);
  });
});
