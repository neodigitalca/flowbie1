import { describe, expect, it } from "vitest";
import { workflowThenOutputExistsForSite } from "@/lib/workflow/workflow-then-utils";
import type { WorkflowStepOutput } from "@/lib/workflow/workflow-types";

function driveOutput(overrides: Partial<WorkflowStepOutput> = {}): WorkflowStepOutput {
  return {
    id: 1,
    runId: 10,
    nodeId: "drive",
    variableKey: "then_drive",
    scope: "run",
    label: "Google Drive",
    textPreview: "Uploaded",
    fileRefs: [],
    agentRunId: 42,
    createdAt: "",
    ...overrides,
  };
}

describe("workflowThenOutputExistsForSite", () => {
  it("treats the same client as already uploaded", () => {
    expect(
      workflowThenOutputExistsForSite([driveOutput({ siteId: "site-a" })], "drive", "site-a", 42),
    ).toBe(true);
    expect(
      workflowThenOutputExistsForSite([driveOutput({ agentRunId: 42 })], "drive", "site-a", 42),
    ).toBe(true);
  });

  it("does not treat another client upload as done", () => {
    expect(
      workflowThenOutputExistsForSite([driveOutput({ siteId: "site-a", agentRunId: 42 })], "drive", "site-b", 43),
    ).toBe(false);
  });
});
