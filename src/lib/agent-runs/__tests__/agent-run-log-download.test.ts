import { describe, expect, it } from "vitest";
import { buildAgentRunsShareBundle } from "@/lib/agent-runs/agent-run-log-download";
import type { AgentRunLogJsonExport } from "@/lib/agent-runs/agent-run-log-format";

function logStub(id: number): AgentRunLogJsonExport {
  return {
    run: {
      id,
      title: `Full AISEO ${id}`,
      recipeKey: "content_optimizer",
      recipeTitle: "Full AISEO",
      status: "failed",
      source: "workflow",
      startedAt: "",
      finishedAt: "",
      errorMessage: "WordPress site not found for this task.",
      result: undefined,
    },
    plan: undefined,
    emailOutcome: null,
    googleDriveOutcome: null,
    deliverables: [],
    checkpoint: null,
    uploadedPosts: [],
    steps: [],
  } as AgentRunLogJsonExport;
}

describe("buildAgentRunsShareBundle", () => {
  it("writes one file payload with every client run", () => {
    const bundle = buildAgentRunsShareBundle(
      [
        {
          agentRunId: 10,
          clientName: "Ridgeline Solar",
          siteId: "wp-1786635952128-13",
          status: "failed",
          title: "Full AISEO",
          errorMessage: "WordPress site not found for this task.",
          log: logStub(10),
        },
        {
          agentRunId: 11,
          clientName: "Lindsey Blinds",
          siteId: "wp-lindsey",
          status: "failed",
          title: "Full AISEO",
          errorMessage: "WordPress site not found for this task.",
          log: logStub(11),
        },
      ],
      { workflowRunId: 88, exportedAt: "2026-09-12T00:00:00.000Z" },
    );
    expect(bundle.runCount).toBe(2);
    expect(bundle.workflowRunId).toBe(88);
    expect(bundle.runs.map((row) => row.clientName)).toEqual([
      "Ridgeline Solar",
      "Lindsey Blinds",
    ]);
  });
});
