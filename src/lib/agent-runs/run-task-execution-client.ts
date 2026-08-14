import type { Dispatch, SetStateAction } from "react";
import { handleOptimizeContent } from "@/hooks/content-optimization/handle-optimize-content";
import type { WordPressSite } from "@/components/integrations/types";
import type { AgentRunHarnessContext } from "@/lib/agent-runs/harness-registry";
import type { AgentRun, AgentRunResult } from "@/lib/agent-runs-types";
import {
  completeTaskExecution,
  patchTaskExecutionProgress,
} from "@/lib/tasks-api";

function noopSetState<T>(_value: SetStateAction<T>): void {
  /* agent run harness uses API steps only */
}

export async function runTaskExecutionClientHarness(
  run: AgentRun,
  sites: WordPressSite[],
  ctx: AgentRunHarnessContext,
): Promise<AgentRunResult> {
  const contract = run.plan?.clientRunContract;
  const executionId = run.plan?.taskExecutionId;
  if (!contract || !executionId) {
    throw new Error("Task execution contract missing from agent run plan.");
  }

  const site = sites.find((s) => s.id === contract.siteId);
  if (!site) {
    throw new Error("WordPress site not found for this task.");
  }

  await ctx.onStep?.("Load", "running");
  await patchTaskExecutionProgress(run.teamId, executionId, {
    stepId: "load",
    message: "Loading page and ACF…",
    progress: 0.05,
  });

  if (await ctx.isCancelled?.()) {
    throw new Error("Cancelled");
  }

  const resolvedPost = {
    id: contract.resolvedPost.id,
    title: "",
    link: contract.resolvedPost.link ?? contract.url,
    slug: contract.resolvedPost.slug ?? "",
    type: contract.resolvedPost.subtype,
    endpoint: contract.resolvedPost.endpoint,
  };

  await handleOptimizeContent({
    site,
    url: contract.url,
    updateMode: contract.updateMode,
    setGscQueriesForSelection: noopSetState,
    setIsKeywordSelectionOpen: noopSetState,
    setGscClusterAnalysis: noopSetState,
    setIsAnalyzingClusters: noopSetState,
    skipOnNoGSC: true,
    optimizationOptions: contract.optimizationOptions,
    resolvedPost,
    testMode: Boolean(contract.optimizationOptions?.testMode),
    setIsOptimizingContent: noopSetState as Dispatch<SetStateAction<Record<string, boolean>>>,
    setOptimizationProgress: (updater) => {
      if (typeof updater === "function") {
        const next = updater({});
        const entry = Object.values(next)[0] as { stepId?: string; message?: string } | undefined;
        if (entry?.message || entry?.stepId) {
          void ctx.onStep?.(entry.message || entry.stepId || "Running", "running");
          void patchTaskExecutionProgress(run.teamId, executionId, {
            stepId: entry.stepId,
            message: entry.message,
          });
        }
      }
    },
    setOptimizationFileManagers: noopSetState as Dispatch<SetStateAction<Record<string, unknown>>>,
    setPendingOptimization: noopSetState as Dispatch<SetStateAction<unknown>>,
    optimizationFileManagers: {},
    continueOptimizationRef: { current: null },
  });

  await completeTaskExecution(run.teamId, executionId, { ok: true, result: { url: contract.url } });
  await ctx.onStep?.("Complete", "done");

  return {
    updated: 1,
    message: `Optimized ${contract.url}`,
  };
}
