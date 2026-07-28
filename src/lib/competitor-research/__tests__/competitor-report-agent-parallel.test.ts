import { describe, expect, it } from "vitest";
import { stitchCompetitorReportSections } from "@/lib/competitor-research/competitor-report-system-prompt";
import { sortStrategistParallelSectionResults } from "@/lib/competitor-research/competitor-report-agent";

describe("sortStrategistParallelSectionResults + stitch order", () => {
  it("orders parallel completions 3,1,2 into stitched body 1–3", () => {
    const outOfOrder = [
      { section: 3 as const, markdown: "THREE", truncated: false },
      { section: 1 as const, markdown: "ONE", truncated: false },
      { section: 2 as const, markdown: "TWO", truncated: false },
    ];
    const sorted = sortStrategistParallelSectionResults(outOfOrder);
    expect(sorted.map((r) => r.markdown)).toEqual(["ONE", "TWO", "THREE"]);
    const tuple: [string, string, string] = [sorted[0].markdown, sorted[1].markdown, sorted[2].markdown];
    expect(stitchCompetitorReportSections(tuple)).toBe("ONE\n\nTWO\n\nTHREE");
  });

  it("collects truncated section numbers in numeric order after sort", () => {
    const raw = [
      { section: 3 as const, markdown: "c", truncated: true },
      { section: 1 as const, markdown: "a", truncated: false },
      { section: 2 as const, markdown: "b", truncated: true },
    ];
    const sorted = sortStrategistParallelSectionResults(raw);
    const truncated = sorted.filter((r) => r.truncated).map((r) => r.section);
    expect(truncated).toEqual([2, 3]);
  });
});
