import { describe, expect, it } from "vitest";
import {
  buildAgentRunBatchKey,
  resolveAgentRunBatchKey,
} from "@/lib/agent-runs/agent-run-batch-key";
import type { AgentRun } from "@/lib/agent-runs-types";

function makeRun(partial: Partial<AgentRun> = {}): AgentRun {
  return {
    id: 0,
    teamId: 1,
    title: "",
    status: "pending",
    createdAt: "",
    updatedAt: "",
    ...partial,
  } as AgentRun;
}

describe("buildAgentRunBatchKey", () => {
  it("returns agent-run-{id}", () => {
    expect(buildAgentRunBatchKey(20)).toBe("agent-run-20");
  });
});

describe("resolveAgentRunBatchKey", () => {
  it("prefers stored agent-run clientBatchKey", () => {
    const run = makeRun({ id: 20, clientBatchKey: "agent-run-20" });
    expect(resolveAgentRunBatchKey(run)).toBe("agent-run-20");
  });

  it("ignores legacy site-batch clientBatchKey", () => {
    const run = makeRun({ id: 20, clientBatchKey: "site-a-batch" });
    expect(resolveAgentRunBatchKey(run)).toBe("agent-run-20");
  });

  it("falls back to agent-run-{id} when clientBatchKey is empty", () => {
    const run = makeRun({ id: 21 });
    expect(resolveAgentRunBatchKey(run)).toBe("agent-run-21");
  });

  it("falls back to site batch key when id is not positive", () => {
    const run = makeRun({ id: 0, context: { siteId: "site-a" } });
    expect(resolveAgentRunBatchKey(run, "site-a")).toBe("site-a-batch");
  });
});
