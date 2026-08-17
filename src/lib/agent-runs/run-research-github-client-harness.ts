import type { WordPressSite } from "@/components/integrations/types";
import type { AgentRunHarnessContext } from "@/lib/agent-runs/harness-registry";
import type { AgentRun, AgentRunResult } from "@/lib/agent-runs-types";
import {
  dispatchResearchJob,
  pollResearchExecution,
  type ResearchJobKey,
} from "@/lib/research-jobs-api";
import { fetchTaskExecution, patchTaskExecutionProgress } from "@/lib/tasks-api";
import type { TaskExecutionClientRunContract } from "@/lib/tasks-types";

export type RunResearchGithubHarnessInput = {
  run: AgentRun;
  site: WordPressSite;
  contract: TaskExecutionClientRunContract;
  executionId: number;
  ctx: AgentRunHarnessContext;
  batchKey: string;
  jobKey: ResearchJobKey;
  dispatchPayload: Record<string, unknown>;
  preflightMessage?: string;
  runningMessage?: string;
  successMessage?: string;
};

const GITHUB_DISPATCH_PROGRESS_MESSAGE = "Running on GitHub Actions…";

function shouldDispatchGithubJob(
  status: string | undefined,
  progressMessage: string,
): boolean {
  if (status === "awaiting_client") return true;
  if (status === "running" && progressMessage !== GITHUB_DISPATCH_PROGRESS_MESSAGE) {
    return true;
  }
  return false;
}

export async function runResearchGithubClientHarness(
  input: RunResearchGithubHarnessInput,
): Promise<AgentRunResult> {
  const {
    run,
    site,
    contract,
    executionId,
    ctx,
    batchKey,
    jobKey,
    dispatchPayload,
    preflightMessage = "Starting research export…",
    runningMessage = "Running on GitHub Actions…",
    successMessage = "Research export completed",
  } = input;

  const current = await fetchTaskExecution(run.teamId, executionId);
  const progressMessage = current.execution?.progress?.message?.trim() ?? "";

  if (shouldDispatchGithubJob(current.execution?.status, progressMessage)) {
    await ctx.onStep?.("Dispatch GitHub job", "running");
    const dispatch = await dispatchResearchJob({
      teamId: run.teamId,
      jobKey,
      executionId,
      agentRunId: run.id,
      payload: {
        ...dispatchPayload,
        siteId: contract.siteId,
      },
    });

    if (!dispatch.ok) {
      throw new Error(dispatch.error ?? "Could not dispatch GitHub research job.");
    }
  }

  await ctx.onStep?.("Preflight", "running");
  await patchTaskExecutionProgress(run.teamId, executionId, {
    stepId: "preflight",
    message: preflightMessage,
    progress: 0.05,
  });

  await ctx.onStep?.("Export on GitHub", "running");
  await patchTaskExecutionProgress(run.teamId, executionId, {
    message: runningMessage,
    progress: 0.25,
  });

  const polled = await pollResearchExecution(run.teamId, executionId);
  if (!polled.ok) {
    throw new Error(polled.error ?? "Research job failed.");
  }

  await ctx.onStep?.("Complete", "done");

  return {
    updated: 1,
    message: successMessage.replace("{siteName}", site.name),
    batchKey,
  };
}
