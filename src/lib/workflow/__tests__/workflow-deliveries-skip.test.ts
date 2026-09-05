import { describe, expect, it } from "vitest";
import type { AgentRun } from "@/lib/agent-runs-types";
import { filterRunnableRuns, markClientRunAttempted, clearClientRunAttempted } from "@/lib/agent-runs/executor";
import { shouldSkipInlineDeliveries } from "@/lib/workflow/workflow-deliveries-skip";

function makeRun(partial: Partial<AgentRun>): AgentRun {
  return {
    id: 1,
    teamId: 1,
    createdBy: 1,
    title: "Test",
    recipeKey: "gsc_reporting",
    recipeTitle: "GSC",
    status: "running",
    source: "task_manager",
    taskId: 1,
    taskTitle: "Task",
    context: {},
    plan: {},
    result: null,
    errorMessage: "",
    clientBatchKey: "",
    startedAt: null,
    finishedAt: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("shouldSkipInlineDeliveries", () => {
  it("returns true for workflow source runs", () => {
    expect(
      shouldSkipInlineDeliveries(
        makeRun({
          source: "workflow",
          plan: {},
        }),
      ),
    ).toBe(true);
  });

  it("returns true when workflowThenDelivery is set on plan", () => {
    expect(
      shouldSkipInlineDeliveries(
        makeRun({
          source: "task_manager",
          plan: { workflowThenDelivery: true },
        }),
      ),
    ).toBe(true);
  });

  it("returns false for standalone task manager runs", () => {
    expect(
      shouldSkipInlineDeliveries(
        makeRun({
          source: "task_manager",
          plan: { saveToGoogleDrive: true },
        }),
      ),
    ).toBe(false);
  });
});

describe("filterRunnableRuns", () => {
  it("includes queued workflow runs that are not inflight", () => {
    const runs = [
      makeRun({
        id: 932,
        source: "workflow",
        status: "queued",
        plan: { workflowThenDelivery: true },
      }),
    ];
    expect(filterRunnableRuns(runs)).toHaveLength(1);
  });

  it("does not re-dispatch running or already-attempted runs", () => {
    const runs = [
      makeRun({ id: 933, status: "running" }),
      makeRun({ id: 934, status: "queued" }),
    ];
    markClientRunAttempted(934);
    expect(filterRunnableRuns(runs)).toHaveLength(0);
    clearClientRunAttempted(934);
  });
});
