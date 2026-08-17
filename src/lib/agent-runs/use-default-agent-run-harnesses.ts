import { useEffect } from "react";
import {
  registerAgentRunHarness,
  unregisterAgentRunHarness,
} from "@/lib/agent-runs/harness-registry";
import type { AgentRunHarnessContext } from "@/lib/agent-runs/harness-registry";
import { runGscReportingDirectHarness } from "@/lib/agent-runs/run-gsc-reporting-client-harness";
import { runLocalDominatorExportDirectHarness } from "@/lib/agent-runs/run-local-dominator-export-client-harness";
import { runPostCreatorDirectHarness } from "@/lib/agent-runs/run-post-creator-client-harness";
import type { AgentRun, AgentRunResult } from "@/lib/agent-runs-types";

async function stubHarness(run: AgentRun, _ctx: AgentRunHarnessContext): Promise<AgentRunResult> {
  if (run.recipeKey === "overview_pages_meta_batch") {
    throw new Error("Open Overview with the pages sitemap loaded, then dispatch from Pulse Assist Build.");
  }
  throw new Error("Open Content Optimizer or execute from a task with a target bucket.");
}

export function useDefaultAgentRunHarnesses(): void {
  useEffect(() => {
    registerAgentRunHarness("overview_pages_meta_batch", stubHarness);
    registerAgentRunHarness("content_optimizer_bulk", stubHarness);
    registerAgentRunHarness("gsc_reporting", runGscReportingDirectHarness);
    registerAgentRunHarness("post_creator", runPostCreatorDirectHarness);
    registerAgentRunHarness("local_dominator_export", runLocalDominatorExportDirectHarness);
    return () => {
      unregisterAgentRunHarness("overview_pages_meta_batch");
      unregisterAgentRunHarness("content_optimizer_bulk");
      unregisterAgentRunHarness("gsc_reporting");
      unregisterAgentRunHarness("post_creator");
      unregisterAgentRunHarness("local_dominator_export");
    };
  }, []);
}
