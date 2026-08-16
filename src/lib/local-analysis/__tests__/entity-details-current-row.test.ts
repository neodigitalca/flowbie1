import { describe, expect, it } from "vitest";
import { resolveEntityDetailsCurrentRow } from "@/lib/local-analysis/entity-details-current-row";
import type { LocalAnalysisHeaderProgress } from "@/lib/local-analysis/header-progress";

describe("resolveEntityDetailsCurrentRow", () => {
  it("returns -1 when idle", () => {
    expect(resolveEntityDetailsCurrentRow(null, false, 5)).toBe(-1);
  });

  it("returns generating entity rowIndex from title harness", () => {
    const progress: LocalAnalysisHeaderProgress = {
      kind: "generate",
      phase: "Writing titles",
      completed: 0,
      total: 3,
      titleHarnessGroups: [
        {
          clusterKey: "a",
          seedKeyword: "kw",
          status: "generating",
          entities: [
            { rowIndex: 0, entity: "City", status: "done" },
            { rowIndex: 1, entity: "City 2", status: "generating" },
          ],
        },
      ],
    };
    expect(resolveEntityDetailsCurrentRow(progress, true, 3)).toBe(1);
  });

  it("uses completed count during title writing", () => {
    const progress: LocalAnalysisHeaderProgress = {
      kind: "suggest",
      phase: "Writing titles",
      completed: 2,
      total: 5,
    };
    expect(resolveEntityDetailsCurrentRow(progress, true, 5)).toBe(2);
  });

  it("returns row 0 during inventory load", () => {
    const progress: LocalAnalysisHeaderProgress = {
      kind: "suggest",
      phase: "Loading site inventory and GSC cache",
      completed: 0,
      total: 5,
    };
    expect(resolveEntityDetailsCurrentRow(progress, true, 5)).toBe(0);
  });

  it("uses completed count during keyword hydrate", () => {
    const progress: LocalAnalysisHeaderProgress = {
      kind: "suggest",
      phase: "Assigning unique keywords from GSC",
      completed: 1,
      total: 3,
    };
    expect(resolveEntityDetailsCurrentRow(progress, true, 3)).toBe(1);
  });
});
