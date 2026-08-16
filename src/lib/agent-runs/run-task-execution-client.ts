import type { Dispatch, SetStateAction } from "react";
import { handleOptimizeContent } from "@/hooks/content-optimization/handle-optimize-content";
import { handleOptimizeMultipleContent } from "@/hooks/content-optimization/bulk-optimization";
import { humanizeSlugFromUrl } from "@/hooks/content-optimization/bulk-optimization-constants";
import type { WordPressSite } from "@/components/integrations/types";
import type { AgentRunHarnessContext } from "@/lib/agent-runs/harness-registry";
import {
  flushAgentRunCheckpointPatch,
  patchAgentRunCheckpoint,
  readAgentRunCheckpoint,
  resumeCompletedUrlsFromCheckpoint,
  scheduleAgentRunCheckpointPatch,
} from "@/lib/agent-runs/agent-run-checkpoint";
import { patchAgentRunInList } from "@/lib/agent-runs/agent-runs-local-patch";
import { resolveAgentRunBatchKey } from "@/lib/agent-runs/agent-run-batch-key";
import { resolveAgentRunRecipeKey } from "@/lib/agent-runs/agent-run-navigation";
import { getAgentRunOptimizationBridge } from "@/lib/agent-runs/agent-run-optimization-bridge";
import { runGscReportingClientHarness } from "@/lib/agent-runs/run-gsc-reporting-client-harness";
import {
  runPostCreatorClientHarness,
  shouldRunPostCreatorHarness,
} from "@/lib/agent-runs/run-post-creator-client-harness";
import { fetchAgentRun } from "@/lib/agent-runs-api";
import type { AgentRun, AgentRunCheckpointUrlSummary, AgentRunResult } from "@/lib/agent-runs-types";
import { resolveTaskExecutionBucketInventory } from "@/lib/task-execution-resolve-bucket-urls";
import { getEntitySiteWarmCacheIfReady } from "@/lib/local-analysis/entity-site-warm-cache";
import { isTaskExecutionTargetAll } from "@/lib/task-execution-target";
import {
  completeTaskExecution,
  fetchTaskExecution,
  patchTaskExecutionProgress,
  reopenTaskExecutionForResume,
} from "@/lib/tasks-api";
import { agentRunHasResumeProgress } from "@/lib/agent-runs/agent-run-resume";
import type { OptimizationProgressState } from "@/hooks/content-optimization/use-optimization-state";
import type { OptimizationFileManager } from "@/lib/optimization-file-manager";

function noopSetState<T>(_value: SetStateAction<T>): void {
  /* agent run harness uses API steps only */
}

async function resolveTaskExecutionTerminalState(
  run: AgentRun,
  ctx: AgentRunHarnessContext,
): Promise<AgentRunResult | null> {
  const executionId = run.plan?.taskExecutionId;
  if (!executionId || !run.teamId) return null;

  const { execution } = await fetchTaskExecution(run.teamId, executionId);
  if (!execution) return null;

  if (execution.status === "completed") {
    const checkpoint = readAgentRunCheckpoint(run);
    return {
      updated: checkpoint.uploadedUrls.length || checkpoint.completedUrls.length || 1,
      message: execution.progress?.message || "Task execution completed",
      batchKey: run.clientBatchKey || undefined,
    };
  }

  if (execution.status === "failed") {
    if (ctx.resumePoint || agentRunHasResumeProgress(run)) {
      await reopenTaskExecutionForResume(run.teamId, executionId);
      return null;
    }
    throw new Error(execution.error || execution.progress?.error || "Task execution failed");
  }

  if (execution.status === "cancelled") {
    throw new Error("Cancelled");
  }

  return null;
}

function progressReporter(
  run: AgentRun,
  ctx: AgentRunHarnessContext,
  siteId: string,
  batchKey: string,
  checkpointTotals?: { totalCount?: number; completedCount?: number },
): Dispatch<SetStateAction<Record<string, OptimizationProgressState>>> {
  const executionId = run.plan?.taskExecutionId;
  const bridge = getAgentRunOptimizationBridge();
  const base = bridge?.setOptimizationProgress;

  return (updater) => {
    let snapshot: Record<string, OptimizationProgressState> = {};

    if (base) {
      base((prev) => {
        snapshot =
          typeof updater === "function"
            ? updater(prev as Record<string, OptimizationProgressState>)
            : (updater as Record<string, OptimizationProgressState>);
        return snapshot;
      });
    } else {
      snapshot =
        typeof updater === "function"
          ? updater({} as Record<string, OptimizationProgressState>)
          : (updater as Record<string, OptimizationProgressState>);
    }

    const entry =
      (snapshot[siteId] as { stepId?: string; message?: string; step?: string; progress?: number; pageUrl?: string } | undefined) ??
      (snapshot[batchKey] as { stepId?: string; message?: string; step?: string; progress?: number; pageUrl?: string } | undefined) ??
      (Object.values(snapshot)[0] as { stepId?: string; message?: string; step?: string; progress?: number; pageUrl?: string } | undefined);

    if (entry?.message || entry?.stepId || entry?.step) {
      const message = entry.message || entry.step || entry.stepId || "Running";
      void ctx.onStep?.(message, "running", {
        currentUrl: entry.pageUrl,
        currentUrlProgress: typeof entry.progress === "number" ? entry.progress : undefined,
        totalCount: checkpointTotals?.totalCount,
        currentIndex: checkpointTotals?.completedCount,
        lastMessage: message,
      });
      if (executionId) {
        void patchTaskExecutionProgress(run.teamId, executionId, {
          stepId: entry.stepId,
          message: entry.message,
          progress: typeof entry.progress === "number" ? entry.progress : undefined,
        });
      }
    }

    const message = entry?.message || entry?.step || undefined;
    const hasProgressPatch = Boolean(message) || typeof entry?.progress === "number";
    if (hasProgressPatch) {
      scheduleAgentRunCheckpointPatch(run.teamId, run.id, {
        lastMessage: message,
        currentUrlProgress: typeof entry?.progress === "number" ? entry.progress : undefined,
        totalCount: checkpointTotals?.totalCount,
      });
    }
  };
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

  const terminalResult = await resolveTaskExecutionTerminalState(run, ctx);
  if (terminalResult) {
    await ctx.onStep?.("Complete", "done");
    return terminalResult;
  }

  const site = sites.find((s) => s.id === contract.siteId);
  if (!site) {
    throw new Error("WordPress site not found for this task.");
  }

  const batchKey = resolveAgentRunBatchKey(run, site.id);
  const effectiveRecipe = resolveAgentRunRecipeKey(run);

  if (effectiveRecipe === "gsc_reporting") {
    const reportingContract = {
      ...contract,
      comparePreset:
        contract.comparePreset === "yoy" || contract.comparePreset === "mom"
          ? contract.comparePreset
          : "mom",
    };
    return runGscReportingClientHarness(run, site, reportingContract, executionId, ctx, batchKey);
  }

  if (effectiveRecipe === "post_creator" || shouldRunPostCreatorHarness(contract)) {
    return runPostCreatorClientHarness(run, site, contract, executionId, ctx, batchKey);
  }

  if (effectiveRecipe !== "content_optimizer_bulk" && effectiveRecipe !== "overview_pages_meta_batch") {
    throw new Error(`Unsupported agent run recipe: ${String(effectiveRecipe || "unknown")}`);
  }

  if (isTaskExecutionTargetAll(contract.url) || contract.scope === "all" || contract.targetBucket) {
    return runTaskExecutionBulkClientHarness(run, site, contract, executionId, ctx, batchKey);
  }

  if (!contract.resolvedPost?.id) {
    throw new Error("Task execution contract is missing resolved post.");
  }

  const resumePayload = ctx.resumePoint?.payload ?? readAgentRunCheckpoint(run).lastStepPayload ?? {};
  if (resumePayload.uploaded === true && typeof resumePayload.url === "string") {
    await completeTaskExecution(run.teamId, executionId, { ok: true, result: { url: resumePayload.url } });
    await ctx.onStep?.("Complete", "done", resumePayload);
    return {
      updated: 1,
      message: `Optimized ${resumePayload.url}`,
      batchKey,
    };
  }

  await ctx.onStep?.("Load", "running", {
    phase: "single_url",
    url: contract.url,
    currentIndex: 0,
    totalCount: 1,
    currentUrl: contract.url,
    currentUrlProgress: 5,
  });
  await patchTaskExecutionProgress(run.teamId, executionId, {
    stepId: "load",
    message: "Loading page and ACF…",
    progress: 0.05,
  });
  await patchAgentRunCheckpoint(run.teamId, run.id, {
    totalCount: 1,
    currentIndex: 0,
    currentUrl: contract.url,
    currentUrlProgress: 5,
    lastMessage: "Loading page and ACF…",
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

  const bridge = getAgentRunOptimizationBridge();

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
    setIsOptimizingContent:
      bridge?.setIsOptimizingContent ??
      (noopSetState as Dispatch<SetStateAction<Record<string, boolean>>>),
    setOptimizationProgress: progressReporter(run, ctx, site.id, batchKey, { totalCount: 1, completedCount: 0 }),
    setOptimizationFileManagers:
      bridge?.setOptimizationFileManagers ??
      (noopSetState as Dispatch<SetStateAction<Record<string, OptimizationFileManager>>>),
    setPendingOptimization: noopSetState as Dispatch<SetStateAction<unknown>>,
    optimizationFileManagers: bridge?.optimizationFileManagers ?? {},
    continueOptimizationRef: bridge?.continueOptimizationRef ?? { current: null },
  });

  await patchAgentRunCheckpoint(run.teamId, run.id, {
    completedUrls: [contract.url],
    uploadedUrls: [contract.url],
    currentUrl: contract.url,
    currentIndex: 0,
    totalCount: 1,
    currentUrlProgress: 100,
    lastMessage: "Uploaded to WordPress",
    updated: 1,
    completedUrlSummaries: [{ url: contract.url, postTitle: humanizeSlugFromUrl(contract.url) }],
  });

  const singleDonePayload = {
    phase: "single_url",
    url: contract.url,
    uploaded: true,
    currentIndex: 0,
    totalCount: 1,
    uploadedUrls: [contract.url],
    completedUrls: [contract.url],
  };
  await ctx.onStep?.("Uploaded to WordPress", "running", singleDonePayload);

  await completeTaskExecution(run.teamId, executionId, { ok: true, result: { url: contract.url } });

  return {
    updated: 1,
    message: `Optimized ${contract.url}`,
    batchKey,
  };
}

async function runTaskExecutionBulkClientHarness(
  run: AgentRun,
  site: WordPressSite,
  contract: NonNullable<AgentRun["plan"]>["clientRunContract"] & object,
  executionId: number,
  ctx: AgentRunHarnessContext,
  batchKey: string,
): Promise<AgentRunResult> {
  const latestRun = (await fetchAgentRun(run.teamId, run.id)) ?? run;
  const checkpoint = readAgentRunCheckpoint(latestRun);
  const resumeCompletedUrls = resumeCompletedUrlsFromCheckpoint(checkpoint);

  await ctx.onStep?.("Inventory", "running");
  if (!getEntitySiteWarmCacheIfReady(site.id)) {
    throw new Error("Site cache is not ready. Use Refresh site data, then retry.");
  }
  await patchTaskExecutionProgress(run.teamId, executionId, {
    stepId: "inventory",
    message: "Using site cache…",
    progress: 0.05,
  });

  if (await ctx.isCancelled?.()) {
    throw new Error("Cancelled");
  }

  const bucket = contract.targetBucket ?? (isTaskExecutionTargetAll(contract.url) ? "all" : null);
  if (!bucket) {
    throw new Error("Task execution contract is missing target bucket.");
  }

  const { urls, snapshot: prefetchedBulkInventorySnapshot } = await resolveTaskExecutionBucketInventory(
    site,
    bucket,
    (message) => {
      void patchTaskExecutionProgress(run.teamId, executionId, { message });
      scheduleAgentRunCheckpointPatch(run.teamId, run.id, { lastMessage: message });
    },
  );

  const filterUrls = contract.targetUrls?.length ? contract.targetUrls : null;
  const workUrls = filterUrls ? urls.filter((u) => filterUrls.includes(u)) : urls;
  if (filterUrls && workUrls.length === 0) {
    throw new Error("No matched URLs found in inventory for this trigger run.");
  }

  const resumeCount = resumeCompletedUrls.length;
  const resumeMessage =
    resumeCount > 0
      ? `Resuming ${resumeCount + 1}/${workUrls.length}…`
      : `Optimizing ${workUrls.length} URLs…`;
  await patchTaskExecutionProgress(run.teamId, executionId, {
    stepId: "bulk",
    message: resumeMessage,
    progress: workUrls.length > 0 ? Math.round((resumeCount / workUrls.length) * 100) : 0,
  });
  const bulkResumePayload = {
    phase: "bulk_optimizer",
    totalCount: workUrls.length,
    currentIndex: resumeCount,
    currentUrl: workUrls[resumeCount],
    uploadedUrls:
      checkpoint.uploadedUrls.length > 0 ? checkpoint.uploadedUrls : resumeCompletedUrls,
    completedUrls: resumeCompletedUrls,
    completedUrlSummaries: checkpoint.completedUrlSummaries,
  };
  await ctx.onStep?.(resumeMessage, "running", bulkResumePayload);
  await patchAgentRunCheckpoint(run.teamId, run.id, {
    totalCount: workUrls.length,
    currentIndex: resumeCount,
    currentUrl: workUrls[resumeCount],
    currentUrlProgress: 0,
    lastMessage: resumeMessage,
    completedUrls: resumeCompletedUrls,
    uploadedUrls:
      checkpoint.uploadedUrls.length > 0 ? checkpoint.uploadedUrls : resumeCompletedUrls,
    completedUrlSummaries: checkpoint.completedUrlSummaries,
    updated: resumeCount,
  });

  const inventorySitemapSource =
    bucket === "all" ? undefined : (bucket as "pages" | "posts" | "sap");

  const bridge = getAgentRunOptimizationBridge();
  let completedUrls = [...resumeCompletedUrls];
  let uploadedUrls =
    checkpoint.uploadedUrls.length > 0 ? [...checkpoint.uploadedUrls] : [...resumeCompletedUrls];
  let completedUrlSummaries: AgentRunCheckpointUrlSummary[] = [...checkpoint.completedUrlSummaries];

  const onBulkUrlComplete = async (info: {
    url: string;
    index: number;
    total: number;
    uploaded: boolean;
  }) => {
    if (!completedUrls.includes(info.url)) {
      completedUrls = [...completedUrls, info.url];
    }
    if (info.uploaded && !uploadedUrls.includes(info.url)) {
      uploadedUrls = [...uploadedUrls, info.url];
    }
    const postTitle = humanizeSlugFromUrl(info.url);
    completedUrlSummaries = [
      ...completedUrlSummaries.filter((entry) => entry.url !== info.url),
      { url: info.url, postTitle },
    ];
    const nextIndex = info.index + 1;
    const stepMessage = info.uploaded ? `Uploaded ${postTitle}` : `Completed ${postTitle}`;
    const stepPayload = {
      phase: "bulk_optimizer",
      totalCount: info.total,
      currentIndex: nextIndex,
      currentUrl: workUrls[nextIndex],
      uploadedUrls,
      completedUrls,
      completedUrlSummaries,
    };
    void ctx.onStep?.(stepMessage, "running", stepPayload);
    const patched = await patchAgentRunCheckpoint(run.teamId, run.id, {
      completedUrls,
      uploadedUrls,
      completedUrlSummaries,
      currentIndex: nextIndex,
      currentUrl: workUrls[nextIndex],
      totalCount: info.total,
      currentUrlProgress: 0,
      lastMessage: stepMessage,
      updated: uploadedUrls.length,
    });
    if (patched?.result) {
      patchAgentRunInList(run.id, { result: patched.result });
    }
  };

  const bulkResult = await handleOptimizeMultipleContent({
    site,
    urls: workUrls,
    updateMode: contract.updateMode,
    setGscQueriesForSelection: noopSetState,
    setIsKeywordSelectionOpen: noopSetState,
    setGscClusterAnalysis: noopSetState,
    setIsAnalyzingClusters: noopSetState,
    optimizationOptions: {
      ...contract.optimizationOptions,
      inventorySitemapSource,
    },
    setIsOptimizingContent:
      bridge?.setIsOptimizingContent ??
      (noopSetState as Dispatch<SetStateAction<Record<string, boolean>>>),
    setOptimizationProgress: progressReporter(run, ctx, site.id, batchKey, {
      totalCount: workUrls.length,
      completedCount: resumeCount,
    }),
    setBulkOptimizationState:
      bridge?.setBulkOptimizationState ??
      (noopSetState as Dispatch<SetStateAction<Record<string, unknown>>>),
    optimizationFileManagers: bridge?.optimizationFileManagers ?? {},
    continueOptimizationRef: bridge?.continueOptimizationRef ?? { current: null },
    muteToasts: true,
    resumeCompletedUrls,
    prefetchedBulkInventorySnapshot,
    useSiteWarmCacheOnly: true,
    onBulkUrlComplete,
    batchKey,
  });

  await flushAgentRunCheckpointPatch(run.teamId, run.id);

  if (uploadedUrls.length <= resumeCount && workUrls.length > resumeCount) {
    throw new Error(
      bulkResult.prepCompleted
        ? "Bulk optimization finished without uploading any URLs."
        : "Bulk optimization stopped during inventory prep.",
    );
  }

  await completeTaskExecution(run.teamId, executionId, {
    ok: true,
    result: { targetBucket: bucket, count: workUrls.length },
  });
  await ctx.onStep?.("Complete", "done");

  return {
    updated: uploadedUrls.length,
    message: `Optimized ${uploadedUrls.length} URLs`,
    batchKey,
  };
}
