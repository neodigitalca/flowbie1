import { describe, expect, it } from "vitest";
import { buildVerticalBenchmarkMicroSnapshot } from "../vertical-benchmark-header-progress";
import type { BenchmarkPipelineProgress } from "../vertical-benchmark-pipeline-types";

const baseProgress = (overrides: Partial<BenchmarkPipelineProgress>): BenchmarkPipelineProgress => ({
  phase: "gsc",
  message: "Exporting GSC…",
  percent: 40,
  busy: true,
  steps: [
    { id: "a", label: "Step A", status: "done" },
    { id: "b", label: "Step B", status: "active" },
    { id: "c", label: "Step C", status: "waiting" },
  ],
  ...overrides,
});

describe("buildVerticalBenchmarkMicroSnapshot", () => {
  it("returns null when idle", () => {
    expect(
      buildVerticalBenchmarkMicroSnapshot({
        exporting: false,
        generatingBulkTemplate: false,
        exportProgress: null,
        bulkTemplateProgress: null,
      }),
    ).toBeNull();
  });

  it("maps GSC export progress", () => {
    const snap = buildVerticalBenchmarkMicroSnapshot({
      exporting: true,
      generatingBulkTemplate: false,
      exportProgress: baseProgress({ message: "Fetching GSC top 10…" }),
      bulkTemplateProgress: null,
    });
    expect(snap?.label).toBe("GSC export");
    expect(snap?.completed).toBe(1);
    expect(snap?.total).toBe(3);
    expect(snap?.progressPct).toBe(40);
    expect(snap?.statusMessage).toBe("Fetching GSC top 10…");
  });

  it("prefers bulk CSV when both flags set", () => {
    const snap = buildVerticalBenchmarkMicroSnapshot({
      exporting: true,
      generatingBulkTemplate: true,
      exportProgress: baseProgress({ message: "GSC" }),
      bulkTemplateProgress: baseProgress({
        phase: "bulk",
        message: "Curating bulk CSV…",
        percent: 66,
      }),
    });
    expect(snap?.label).toBe("Bulk CSV");
    expect(snap?.statusMessage).toBe("Curating bulk CSV…");
  });
});
