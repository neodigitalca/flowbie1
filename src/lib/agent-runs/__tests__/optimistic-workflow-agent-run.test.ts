import { describe, expect, it } from "vitest";
import {
  applyOptimisticWorkflowAgentProgress,
  createOptimisticWorkflowAgentRun,
  retainSiblingOptimisticAgentRuns,
} from "@/lib/agent-runs/optimistic-workflow-agent-run";

describe("createOptimisticWorkflowAgentRun", () => {
  it("builds a running sidebar row with a negative id", () => {
    const run = createOptimisticWorkflowAgentRun({
      teamId: 1,
      title: "Full AISEO",
      siteId: "wp-1",
    });
    expect(run.id).toBeLessThan(0);
    expect(run.status).toBe("running");
    expect(run.title).toBe("Full AISEO");
    expect(run.steps?.[0]?.label).toBe("Starting…");
  });

  it("keeps other clients' starting rows when one real run arrives", () => {
    const siteA = createOptimisticWorkflowAgentRun({
      teamId: 1,
      title: "Full AISEO",
      siteId: "site-a",
      id: -1,
    });
    const siteB = createOptimisticWorkflowAgentRun({
      teamId: 1,
      title: "Full AISEO",
      siteId: "site-b",
      id: -2,
    });
    const realA = {
      ...siteA,
      id: 88,
      context: { siteId: "site-a" },
    };
    const kept = retainSiblingOptimisticAgentRuns([siteA, siteB], realA);
    expect(kept.map((run) => run.id)).toEqual([-2]);
  });

  it("updates one client's starting label without touching the others", () => {
    const siteA = createOptimisticWorkflowAgentRun({
      teamId: 1,
      title: "Full AISEO",
      siteId: "site-a",
      id: -1,
    });
    const siteB = createOptimisticWorkflowAgentRun({
      teamId: 1,
      title: "Full AISEO",
      siteId: "site-b",
      id: -2,
    });
    const next = applyOptimisticWorkflowAgentProgress([siteA, siteB], "Page audit…", "site-a");
    expect(next[0]?.steps?.[0]?.label).toBe("Page audit…");
    expect(next[1]?.steps?.[0]?.label).toBe("Starting…");
  });
});
