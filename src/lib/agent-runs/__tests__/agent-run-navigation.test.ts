import { describe, expect, it } from "vitest";
import { resolveAgentRunRecipeKey } from "@/lib/agent-runs/agent-run-navigation";
import type { AgentRun } from "@/lib/agent-runs-types";

function makeRun(partial: Partial<AgentRun>): AgentRun {
  return {
    id: 1,
    teamId: 1,
    status: "running",
    source: "workflow",
    recipeKey: "entity_page_creator",
    title: "Create entity pages from grid",
    context: {},
    plan: {},
    ...partial,
  } as AgentRun;
}

describe("resolveAgentRunRecipeKey", () => {
  it("keeps entity_page_creator when clientRunContract has businessName and keyword", () => {
    const run = makeRun({
      recipeKey: "entity_page_creator",
      plan: {
        executionKind: "entity_page_creator",
        clientRunContract: {
          businessName: "KWB",
          keyword: "blinds near me",
        } as never,
      },
    });
    expect(resolveAgentRunRecipeKey(run)).toBe("entity_page_creator");
  });

  it("uses plan executionKind before businessName heuristic", () => {
    const run = makeRun({
      recipeKey: "",
      plan: {
        executionKind: "chatgpt_website_audit",
        clientRunContract: {} as never,
      },
    });
    expect(resolveAgentRunRecipeKey(run)).toBe("chatgpt_website_audit");
  });

  it("routes local dominator only from contract when recipe is unset", () => {
    const run = makeRun({
      recipeKey: "",
      plan: {
        clientRunContract: {
          businessName: "KWB",
          keyword: "auto",
        } as never,
      },
    });
    expect(resolveAgentRunRecipeKey(run)).toBe("local_dominator_export");
  });
});
