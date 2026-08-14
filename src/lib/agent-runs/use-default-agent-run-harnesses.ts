import { useEffect } from "react";
import {
  registerAgentRunHarness,
  unregisterAgentRunHarness,
} from "@/lib/agent-runs/harness-registry";
import type { AgentRunHarnessContext } from "@/lib/agent-runs/harness-registry";
import type { AgentRun, AgentRunResult } from "@/lib/agent-runs-types";

async function stubHarness(run: AgentRun, _ctx: AgentRunHarnessContext): Promise<AgentRunResult> {
  if (run.recipeKey === "overview_pages_meta_batch") {
    throw new Error("Open Overview with the pages sitemap loaded, then dispatch from Pulse Assist Build.");
  }
  throw new Error("Open Content Optimizer or execute from a task with a target URL.");
}

export function useDefaultAgentRunHarnesses(): void {
  useEffect(() => {
    registerAgentRunHarness("overview_pages_meta_batch", stubHarness);
    registerAgentRunHarness("content_optimizer_bulk", stubHarness);
    return () => {
      unregisterAgentRunHarness("overview_pages_meta_batch");
      unregisterAgentRunHarness("content_optimizer_bulk");
    };
  }, []);
}
