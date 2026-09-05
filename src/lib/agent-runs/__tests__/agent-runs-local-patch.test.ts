import { describe, expect, it, beforeEach } from "vitest";
import {
  appendAgentRunStepLocally,
  registerAgentRunListPatcher,
} from "@/lib/agent-runs/agent-runs-local-patch";
import type { AgentRun } from "@/lib/agent-runs-types";

function createRun(steps: AgentRun["steps"] = []): AgentRun {
  return {
    id: 42,
    teamId: 1,
    createdBy: 1,
    title: "Test",
    recipeKey: "gsc_reporting",
    recipeTitle: "GSC reporting",
    status: "running",
    source: "workflow",
    taskId: 0,
    taskTitle: "",
    context: {},
    plan: {},
    result: null,
    errorMessage: "",
    clientBatchKey: "",
    startedAt: null,
    finishedAt: null,
    createdAt: "",
    updatedAt: "",
    steps,
  };
}

describe("agent-runs-local-patch", () => {
  let run: AgentRun;

  beforeEach(() => {
    run = createRun([]);
    registerAgentRunListPatcher((runId, patch) => {
      if (runId !== run.id) return;
      const next = typeof patch === "function" ? patch(run) : patch;
      run = { ...run, ...next };
    });
  });

  it("keeps prior running steps when advancing unkeyed progress", () => {
    appendAgentRunStepLocally(run.id, "GSC reporting bundle API", "running");
    appendAgentRunStepLocally(run.id, "Section 1/5: Executive Summary…", "running");

    expect(run.steps).toHaveLength(2);
    expect(run.steps?.[0]?.status).toBe("running");
    expect(run.steps?.[1]?.status).toBe("running");
  });
});
