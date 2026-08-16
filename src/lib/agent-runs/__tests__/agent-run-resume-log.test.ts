import { describe, expect, it } from "vitest";
import { checkpointFieldsFromStepPayload, readAgentRunCheckpoint } from "@/lib/agent-runs/agent-run-checkpoint";
import { getAgentRunResumePoint, agentRunHasResumeProgress } from "@/lib/agent-runs/agent-run-resume";
import {
  formatAgentRunLogJson,
  formatAgentRunLogTimeline,
  normalizeAgentRunStepsForDisplay,
} from "@/lib/agent-runs/agent-run-log-format";
import type { AgentRun } from "@/lib/agent-runs-types";

function baseRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: 1,
    teamId: 1,
    createdBy: 1,
    title: "Test run",
    recipeKey: "post_creator",
    recipeTitle: "Post creator",
    status: "running",
    source: "task_manager",
    taskId: 0,
    taskTitle: "",
    context: {},
    plan: {},
    result: null,
    errorMessage: "",
    clientBatchKey: "",
    startedAt: "2026-08-16T12:00:00.000Z",
    finishedAt: null,
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
    steps: [],
    ...overrides,
  };
}

describe("agent-run-resume", () => {
  it("returns resume point from last step with payload", () => {
    const run = baseRun({
      steps: [
        {
          id: 1,
          stepIndex: 0,
          label: "Post 2/3: uploading…",
          status: "running",
          createdAt: "2026-08-16T12:05:00.000Z",
          payload: { phase: "bulk", rowIndex: 1, postCount: 3 },
        },
      ],
    });
    const point = getAgentRunResumePoint(run);
    expect(point?.label).toBe("Post 2/3: uploading…");
    expect(point?.payload.rowIndex).toBe(1);
    expect(agentRunHasResumeProgress(run)).toBe(true);
  });

  it("ignores Starting step as resume point", () => {
    const run = baseRun({
      steps: [{ id: 1, stepIndex: 0, label: "Starting…", status: "running", createdAt: "" }],
    });
    expect(getAgentRunResumePoint(run)).toBeNull();
  });
});

describe("checkpointFieldsFromStepPayload", () => {
  it("maps bulk payload fields onto checkpoint", () => {
    const existing = readAgentRunCheckpoint(null);
    const patch = checkpointFieldsFromStepPayload("Optimizing 2/5", "2026-08-16T12:00:00.000Z", {
      currentIndex: 1,
      totalCount: 5,
      uploadedUrls: ["https://example.com/a"],
      completedUrls: ["https://example.com/a"],
    }, existing);
    expect(patch.currentIndex).toBe(1);
    expect(patch.totalCount).toBe(5);
    expect(patch.uploadedUrls).toEqual(["https://example.com/a"]);
  });
});

describe("agent-run-log-format", () => {
  it("builds structured JSON export", () => {
    const run = baseRun({
      steps: [
        {
          id: 1,
          stepIndex: 0,
          stepKey: "content-bucket",
          label: "Loading content bucket…",
          status: "running",
          createdAt: "2026-08-16T12:00:00.000Z",
        },
      ],
    });
    const json = formatAgentRunLogJson(run, run.steps ?? []);
    expect(json.run.title).toBe("Test run");
    expect(json.steps[0]?.stepKey).toBe("content-bucket");
    expect(JSON.stringify(json)).toContain("Loading content bucket");
  });

  it("normalizes duplicate and resume-noise steps", () => {
    const steps = [
      {
        id: 1,
        stepIndex: 0,
        stepKey: "preflight",
        label: "Preflight",
        status: "done" as const,
        createdAt: "2026-08-16T12:00:00.000Z",
      },
      {
        id: 2,
        stepIndex: 1,
        label: "Resuming: Preflight",
        status: "running" as const,
        createdAt: "2026-08-16T12:01:00.000Z",
      },
      {
        id: 3,
        stepIndex: 2,
        stepKey: "preflight",
        label: "Preflight",
        status: "running" as const,
        createdAt: "2026-08-16T12:02:00.000Z",
      },
    ];
    const normalized = normalizeAgentRunStepsForDisplay(steps);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.label).toBe("Preflight");
  });

  it("formats timeline rows with time and label", () => {
    const run = baseRun({
      steps: [
        {
          id: 1,
          stepIndex: 0,
          label: "Generating blog ideas…",
          status: "running",
          createdAt: "2026-08-16T12:01:00.000Z",
        },
      ],
    });
    const rows = formatAgentRunLogTimeline(run, run.steps ?? [], "Generating blog ideas…");
    expect(rows[0]?.label).toBe("Generating blog ideas…");
    expect(rows[0]?.timeLabel.length).toBeGreaterThan(0);
  });
});
