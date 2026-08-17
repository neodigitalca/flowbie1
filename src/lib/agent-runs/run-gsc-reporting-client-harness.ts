import type { WordPressSite } from "@/components/integrations/types";
import { getStoredSites } from "@/components/integrations/storage";
import type { AgentRunHarnessContext } from "@/lib/agent-runs/harness-registry";
import { runGscReportingAgentHarness } from "@/lib/gsc-reporting/gsc-reporting-agent-harness";
import { downloadGscReportingArtifacts } from "@/lib/gsc-reporting/gsc-reporting-download";
import type { AgentRun, AgentRunResult } from "@/lib/agent-runs-types";
import type { GscReportingComparePreset, TaskExecutionClientRunContract } from "@/lib/tasks-types";
import { completeTaskExecution, patchTaskExecutionProgress } from "@/lib/tasks-api";
import {
  effectiveSaveLocalArchive,
  effectiveSaveToDisk,
} from "@/lib/schedule-output-destination";
import {
  buildExecutionCompletePayload,
  gscReportingArchiveFiles,
  gscReportingFinalReportFile,
} from "@/lib/task-execution-archive";
import {
  automationTitleFromRun,
  sendAutomationEmailIfConfigured,
} from "@/lib/automation-email-delivery";

function resolveSite(siteId: string, sites: WordPressSite[]): WordPressSite {
  const fromList = sites.find((s) => s.id === siteId);
  if (fromList) return fromList;
  const stored = getStoredSites().find((s) => s.id === siteId);
  if (stored) return stored;
  throw new Error("WordPress site not found for this report run.");
}

function comparePresetFromContract(
  contract: TaskExecutionClientRunContract | Record<string, unknown>,
): GscReportingComparePreset {
  const preset = String((contract as TaskExecutionClientRunContract).comparePreset ?? "mom").trim();
  return preset === "yoy" ? "yoy" : "mom";
}

export async function runGscReportingClientHarness(
  run: AgentRun,
  site: WordPressSite,
  contract: TaskExecutionClientRunContract,
  executionId: number,
  ctx: AgentRunHarnessContext,
  batchKey: string,
): Promise<AgentRunResult> {
  const comparePreset = comparePresetFromContract(contract);
  const saveToDisk = effectiveSaveToDisk("gsc_reporting", contract);
  const saveLocalArchive = effectiveSaveLocalArchive("gsc_reporting", contract);

  await ctx.onStep?.("Preflight", "running");
  await patchTaskExecutionProgress(run.teamId, executionId, {
    stepId: "preflight",
    message: "Starting GSC report…",
    progress: 0.02,
  });

  const result = await runGscReportingAgentHarness({
    site,
    comparePreset,
    isCancelled: ctx.isCancelled,
    resumePoint: ctx.resumePoint,
    onProgress: (p, resumePayload) => {
      void ctx.onStep?.(p.label, "running", resumePayload);
      void patchTaskExecutionProgress(run.teamId, executionId, {
        message: p.label,
        progress: p.total > 0 ? p.step / p.total : undefined,
      });
    },
  });

  if (saveToDisk && !saveLocalArchive) {
    downloadGscReportingArtifacts({
      markdown: result.markdown,
      files: result.files,
      siteName: site.name,
      comparePreset,
    });
  }

  const archiveStamp = Date.now();
  const archiveFiles = gscReportingArchiveFiles({
    markdown: result.markdown,
    files: result.files,
    siteName: site.name,
    comparePreset,
    dateStamp: archiveStamp,
  });

  const emailResult = await sendAutomationEmailIfConfigured({
    teamId: run.teamId,
    executionId,
    contract,
    tokenContext: {
      siteName: site.name,
      automationTitle: automationTitleFromRun(run),
      executionKind: "gsc_reporting",
      compareLabel: result.compareLabel,
      comparePreset,
      attachmentDateStamp: archiveStamp,
      summary: `GSC ${comparePreset === "yoy" ? "YoY" : "MoM"} report generated`,
    },
    summaryText: result.markdown,
    attachments: [
      gscReportingFinalReportFile({
        markdown: result.markdown,
        siteName: site.name,
        comparePreset,
        dateStamp: archiveStamp,
      }),
    ],
    runOk: true,
    onStep: (label, status) => ctx.onStep?.(label, status ?? "running"),
  });

  const archiveFilesWithScript =
    saveLocalArchive && emailResult.meetingScriptFile
      ? [emailResult.meetingScriptFile, ...archiveFiles]
      : archiveFiles;

  await completeTaskExecution(
    run.teamId,
    executionId,
    buildExecutionCompletePayload({
      ok: true,
      run,
      saveLocalArchive,
      archiveFiles: saveLocalArchive ? archiveFilesWithScript : undefined,
      result: {
        comparePreset,
        compareLabel: result.compareLabel,
        sectionCount: result.sectionResults.length,
        ...emailResult,
      },
    }),
  );

  return {
    updated: 1,
    message: `GSC ${comparePreset === "yoy" ? "YoY" : "MoM"} report generated`,
    batchKey,
    ...emailResult,
  };
}

export async function runGscReportingDirectHarness(
  run: AgentRun,
  ctx: AgentRunHarnessContext,
): Promise<AgentRunResult> {
  const siteId = String(run.context?.siteId ?? "").trim();
  if (!siteId) {
    throw new Error("Open Generator → Report with a site selected, then dispatch from Pulse Assist Build.");
  }

  const site = resolveSite(siteId, getStoredSites());
  const plan = (run.plan ?? {}) as Record<string, unknown>;
  const comparePreset = comparePresetFromContract(plan);
  const saveToDisk = plan.saveToDisk !== false;

  await ctx.onStep?.("Starting GSC report…", "running");

  const result = await runGscReportingAgentHarness({
    site,
    comparePreset,
    isCancelled: ctx.isCancelled,
    resumePoint: ctx.resumePoint,
    onProgress: (p, resumePayload) => {
      void ctx.onStep?.(p.label, "running", resumePayload);
    },
  });

  if (saveToDisk) {
    downloadGscReportingArtifacts({
      markdown: result.markdown,
      files: result.files,
      siteName: site.name,
      comparePreset,
    });
  }

  return {
    updated: 1,
    message: `GSC ${comparePreset === "yoy" ? "YoY" : "MoM"} report generated`,
    batchKey: run.clientBatchKey || undefined,
  };
}
