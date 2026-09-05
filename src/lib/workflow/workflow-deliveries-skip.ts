import { completeTaskExecution } from "@/lib/tasks-api";
import { buildExecutionCompletePayload, type TaskArchiveFileInput } from "@/lib/task-execution-archive";
import type { AgentRun } from "@/lib/agent-runs-types";
import { completeExecutionWithDeliveries, type AutomationRunDeliveryResult } from "@/lib/automation-run-deliveries";
import { createAutomationDeliveryOnStep } from "@/lib/workflow/automation-delivery-log";
import type { AutomationEmailTokenContext } from "@/lib/automation-email-delivery";
import type { TaskExecutionClientRunContract } from "@/lib/tasks-types";

export function shouldSkipInlineDeliveries(run: AgentRun): boolean {
  return run.source === "workflow" || run.plan?.workflowThenDelivery === true;
}

export async function completeExecutionArchiveOnly(args: {
  teamId: number;
  executionId: number;
  run: AgentRun;
  saveLocalArchive: boolean;
  ok: boolean;
  result: Record<string, unknown>;
  archiveFiles?: TaskArchiveFileInput[];
  error?: string;
}): Promise<void> {
  if (args.executionId <= 0) return;
  await completeTaskExecution(
    args.teamId,
    args.executionId,
    buildExecutionCompletePayload({
      ok: args.ok,
      run: args.run,
      saveLocalArchive: args.saveLocalArchive,
      archiveFiles: args.saveLocalArchive ? args.archiveFiles : undefined,
      result: args.result,
      error: args.error,
    }),
  );
}

export async function completeAgentRunExecution(args: {
  run: AgentRun;
  teamId: number;
  executionId: number;
  contract: TaskExecutionClientRunContract | Record<string, unknown>;
  saveLocalArchive: boolean;
  ok: boolean;
  result: Record<string, unknown>;
  summaryText: string;
  archiveFiles?: TaskArchiveFileInput[];
  attachments?: TaskArchiveFileInput[];
  fileNameHint?: string;
  tokenContext: AutomationEmailTokenContext;
  onStep?: (label: string, status?: "running" | "done" | "error") => void | Promise<void>;
}): Promise<AutomationRunDeliveryResult | Record<string, never>> {
  if (shouldSkipInlineDeliveries(args.run)) {
    await completeExecutionArchiveOnly({
      teamId: args.teamId,
      executionId: args.executionId,
      run: args.run,
      saveLocalArchive: args.saveLocalArchive,
      ok: args.ok,
      archiveFiles: args.archiveFiles,
      result: args.result,
      error: args.ok ? undefined : String(args.result.error ?? "Run failed"),
    });
    return {};
  }

  return completeExecutionWithDeliveries({
    teamId: args.teamId,
    executionId: args.executionId,
    contract: args.contract,
    run: args.run,
    saveLocalArchive: args.saveLocalArchive,
    ok: args.ok,
    archiveFiles: args.archiveFiles,
    attachments: args.attachments,
    fileNameHint: args.fileNameHint,
    summaryText: args.summaryText,
    tokenContext: args.tokenContext,
    result: args.result,
    onStep: args.onStep ? createAutomationDeliveryOnStep(args.onStep) : undefined,
  });
}
