import { describe, expect, it } from "vitest";
import {
  agentRunCardTitle,
  agentRunCollapsedHint,
  agentRunInlineStatus,
  agentRunStatusHint,
  buildAgentRunProgressLabel,
  splitProgressLabel,
} from "@/lib/agent-runs/agent-run-display";
import type { AgentRun } from "@/lib/agent-runs-types";

describe("buildAgentRunProgressLabel", () => {
  it("returns message only when it already includes the step prefix", () => {
    expect(
      buildAgentRunProgressLabel(
        "SERP research brief complete",
        "SERP research brief complete · Harness 1/8: Overview…",
      ),
    ).toBe("SERP research brief complete · Harness 1/8: Overview…");
  });

  it("joins distinct step and message once", () => {
    expect(buildAgentRunProgressLabel("Load", "Optimizing meta…")).toBe("Load · Optimizing meta…");
  });

  it("returns message when step is empty", () => {
    expect(buildAgentRunProgressLabel("", "Harness 2/8: Blueprint…")).toBe("Harness 2/8: Blueprint…");
  });
});

describe("agentRunStatusHint", () => {
  it("prefers harness detail tail over stale step prefix", () => {
    expect(
      agentRunStatusHint("SERP research brief complete · Harness 3/8: Blueprint and content…"),
    ).toBe("Harness 3/8: Blueprint and content…");
  });

  it("falls back to single-line label", () => {
    expect(agentRunStatusHint("Starting optimization…")).toBe("Starting optimization…");
  });
});

describe("agentRunInlineStatus", () => {
  it("shows detail line only when split", () => {
    expect(
      agentRunInlineStatus("SERP research brief complete · Harness 1/8: Overview…"),
    ).toBe("Harness 1/8: Overview…");
  });
});

describe("splitProgressLabel", () => {
  it("splits on middle dot separator", () => {
    expect(splitProgressLabel("Step one · Step two")).toEqual({
      line1: "Step one",
      line2: "Step two",
    });
  });
});

describe("agentRunCardTitle", () => {
  it("strips client suffix from title when grouped under client folder", () => {
    const run = {
      id: 75,
      title: "Create scheduled blog posts — Advance Blinds",
      recipeTitle: "Post creator",
    } as AgentRun;
    expect(agentRunCardTitle(run, "Advance Blinds")).toBe("Create scheduled blog posts");
  });

  it("keeps title when client suffix does not match", () => {
    const run = {
      id: 1,
      title: "Create scheduled blog posts — Advance Blinds",
      recipeTitle: "Post creator",
    } as AgentRun;
    expect(agentRunCardTitle(run, "Other Site")).toBe("Create scheduled blog posts — Advance Blinds");
  });
});

describe("agentRunCollapsedHint", () => {
  it("prefers terminal error message for failed post_creator runs", () => {
    const run = {
      id: 75,
      recipeKey: "post_creator",
      status: "failed",
      errorMessage: "Blueprint generation failed: Blueprint missing agents.",
      recipeTitle: "Post creator",
      source: "task_manager",
      taskId: 0,
      context: {},
      plan: {},
      createdAt: "",
      updatedAt: "",
    } as AgentRun;
    expect(agentRunCollapsedHint(run, null, 0, null)).toBe(
      "Blueprint generation failed: Blueprint missing agents.",
    );
  });
});
