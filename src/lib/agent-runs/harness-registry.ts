import type { AgentRun, AgentRunRecipeKey, AgentRunResult } from "@/lib/agent-runs-types";

export type AgentRunHarnessContext = {
  onStep?: (label: string, status?: "pending" | "running" | "done" | "error") => Promise<void>;
  isCancelled?: () => Promise<boolean>;
};

export type AgentRunHarnessHandler = (
  run: AgentRun,
  ctx: AgentRunHarnessContext,
) => Promise<AgentRunResult>;

const handlers = new Map<AgentRunRecipeKey | string, AgentRunHarnessHandler>();

export function registerAgentRunHarness(recipeKey: AgentRunRecipeKey | string, handler: AgentRunHarnessHandler): void {
  handlers.set(recipeKey, handler);
}

export function unregisterAgentRunHarness(recipeKey: AgentRunRecipeKey | string): void {
  handlers.delete(recipeKey);
}

export async function runAgentRunHarness(
  run: AgentRun,
  ctx: AgentRunHarnessContext,
): Promise<AgentRunResult> {
  const handler = handlers.get(run.recipeKey);
  if (!handler) {
    throw new Error(`No client harness registered for ${run.recipeTitle || run.recipeKey}. Open the related workspace tab.`);
  }
  return handler(run, ctx);
}
