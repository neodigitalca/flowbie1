import { describe, expect, it } from "vitest";
import { resolveWorkflowStepForgeRoute } from "@/lib/workflow/workflow-step-navigation";
import type { WorkflowNode } from "@/lib/workflow/workflow-types";

function node(kind: WorkflowNode["kind"], id: string, config: Record<string, unknown> = {}): WorkflowNode {
  return { id, kind, label: id, config, position: { x: 0, y: 0 } };
}

describe("resolveWorkflowStepForgeRoute", () => {
  it("includes workflow context for trigger_calendar when workflowId is provided", () => {
    const route = resolveWorkflowStepForgeRoute(node("trigger_calendar", "sched-1"), 42);
    expect(route).toEqual({
      section: "recipes",
      view: "builder",
      recipeKeyword: "gsc-monthly-mom-report",
      workflowId: 42,
      workflowNodeId: "sched-1",
    });
  });

  it("includes workflow context for action_agent when workflowId is provided", () => {
    const route = resolveWorkflowStepForgeRoute(
      node("action_agent", "act-1", { executionKind: "gsc_reporting" }),
      7,
    );
    expect(route).toEqual({
      section: "recipes",
      view: "builder",
      recipeKeyword: "gsc-monthly-mom-report",
      workflowId: 7,
      workflowNodeId: "act-1",
    });
  });

  it("omits workflow context when workflowId is not provided", () => {
    const route = resolveWorkflowStepForgeRoute(node("trigger_calendar", "sched-1"));
    expect(route).toEqual({
      section: "recipes",
      view: "builder",
      recipeKeyword: "gsc-monthly-mom-report",
    });
  });

  it("routes content optimizer via actionBlockKeyword", () => {
    const route = resolveWorkflowStepForgeRoute(
      node("action_agent", "act-opt", {
        executionKind: "content_optimizer",
        actionBlockKeyword: "content-optimizer-full",
        recipeKeyword: "dfs-audit-then-optimize",
      }),
      12,
    );
    expect(route).toEqual({
      section: "recipes",
      view: "builder",
      recipeKeyword: "content-optimizer-full",
      workflowId: 12,
      workflowNodeId: "act-opt",
    });
  });

  it("routes content optimizer by execution kind when actionBlockKeyword is missing", () => {
    const route = resolveWorkflowStepForgeRoute(
      node("action_agent", "act-meta", { executionKind: "content_optimizer_meta" }),
      3,
    );
    expect(route).toEqual({
      section: "recipes",
      view: "builder",
      recipeKeyword: "content-optimizer-meta",
      workflowId: 3,
      workflowNodeId: "act-meta",
    });
  });
});
