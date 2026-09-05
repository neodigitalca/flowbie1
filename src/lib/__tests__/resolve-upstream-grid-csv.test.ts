import { describe, expect, it } from "vitest";
import { resolveUpstreamGridCsvUrlFromOutputs } from "@/lib/entity-page-creator/resolve-upstream-grid-csv";
import type { WorkflowStepOutput } from "@/lib/workflow/workflow-types";

describe("resolveUpstreamGridCsvUrlFromOutputs", () => {
  const outputs: WorkflowStepOutput[] = [
    {
      id: 1,
      runId: 1,
      nodeId: "archive",
      variableKey: "workflow_output",
      scope: "run",
      label: "Archive",
      textPreview: "Final only",
      fileRefs: [{ name: "gsc-report-mom.md", url: "https://example.com/report.md", mime: "text/markdown" }],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 2,
      runId: 1,
      nodeId: "ld1",
      variableKey: "step_ld1",
      scope: "run",
      label: "Grid export",
      textPreview: "CSV",
      fileRefs: [{ name: "grid-export.csv", url: "https://example.com/grid.csv", mime: "text/csv" }],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("falls back to any run output when ragInputKeys do not match", () => {
    expect(resolveUpstreamGridCsvUrlFromOutputs(outputs, ["missing_key"])).toBe(
      "https://example.com/grid.csv",
    );
  });
});
