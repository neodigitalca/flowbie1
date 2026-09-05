import { completeTaskExecution } from "@/lib/tasks-api";
import { buildExecutionCompletePayload, type TaskArchiveFileInput } from "@/lib/task-execution-archive";
import type { AgentRun } from "@/lib/agent-runs-types";
import {
  sendAutomationEmailIfConfigured,
  type AutomationEmailDeliveryResult,
  type AutomationEmailTokenContext,
} from "@/lib/automation-email-delivery";
import type { TaskExecutionClientRunContract } from "@/lib/tasks-types";

export type AutomationRunDeliveryResult = AutomationEmailDeliveryResult;

export async function completeExecutionWithDeliveries(args: {
  teamId: number;
  executionId: number;
  contract: TaskExecutionClientRunContract | Record<string, unknown>;
  run: AgentRun;
  saveLocalArchive: boolean;
  ok: boolean;
  result: Record<string, unknown>;
  summaryText: string;
  archiveFiles?: TaskArchiveFileInput[];
  attachments?: TaskArchiveFileInput[];
  fileNameHint?: string;
  tokenContext: AutomationEmailTokenContext;
  onStep?: (label: string, status?: "running" | "done" | "error") => void | Promise<void>;
}): Promise<AutomationRunDeliveryResult> {
  const contract = { ...(args.contract as TaskExecutionClientRunContract) };
  if (args.tokenContext.executionKind === "gsc_reporting") {
    contract.automationEmailAiIntro = true;
  }

  const emailResult = await sendAutomationEmailIfConfigured({
    teamId: args.teamId,
    executionId: args.executionId,
    contract,
    tokenContext: args.tokenContext,
    summaryText: args.summaryText,
    attachments: args.attachments,
    runOk: args.ok,
    onStep: args.onStep,
  });

  const archiveFilesWithExtras =
    emailResult.meetingScriptFile && args.archiveFiles?.length
      ? [emailResult.meetingScriptFile, ...args.archiveFiles]
      : emailResult.meetingScriptFile
        ? [emailResult.meetingScriptFile]
        : args.archiveFiles;

  await completeTaskExecution(
    args.teamId,
    args.executionId,
    buildExecutionCompletePayload({
      ok: args.ok,
      run: args.run,
      saveLocalArchive: args.saveLocalArchive,
      archiveFiles: args.saveLocalArchive ? archiveFilesWithExtras : undefined,
      result: { ...args.result, ...emailResult },
      error: args.ok ? undefined : String(args.result.error ?? "Run failed"),
    }),
  );

  return emailResult;
}
