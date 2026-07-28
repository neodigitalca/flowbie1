import { describe, expect, it } from "vitest";
import { overviewBulkPageProgressLabel } from "@/lib/overview/overview-bulk-page-state";

describe("overviewBulkPageProgressLabel", () => {
  it("formats page range label", () => {
    expect(overviewBulkPageProgressLabel(0, 100, 1, 6, 519)).toBe(
      "Page 1/6: targets 1–100 of 519",
    );
    expect(overviewBulkPageProgressLabel(100, 200, 2, 6, 519)).toBe(
      "Page 2/6: targets 101–200 of 519",
    );
  });
});
