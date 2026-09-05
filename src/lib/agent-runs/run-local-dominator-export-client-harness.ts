import type { WordPressSite } from "@/components/integrations/types";
import { getStoredSites } from "@/components/integrations/storage";
import type { AgentRunHarnessContext } from "@/lib/agent-runs/harness-registry";
import type { AgentRun, AgentRunResult, AgentRunStepArtifact } from "@/lib/agent-runs-types";
import { persistAgentRunArtifact } from "@/lib/agent-runs/agent-run-artifacts";
import {
  agentRunBrowserPreviewDataUrl,
} from "@/lib/agent-runs/agent-run-browser-preview";
import { patchAgentRunInList } from "@/lib/agent-runs/agent-runs-local-patch";
import {
  registerLocalDominatorExportJob,
  unregisterLocalDominatorExportJob,
  cancelLocalDominatorExportJobForAgentRun,
} from "@/lib/local-dominator/local-dominator-export-job-registry";
import {
  decodeLocalDominatorCsvBase64,
  downloadLocalDominatorCsv,
  startLocalDominatorExportJob,
  waitForLocalDominatorExportJob,
  type LocalDominatorExportJobProgress,
  type LocalDominatorExportResponse,
} from "@/lib/local-dominator-export-api";
import type { TaskExecutionClientRunContract } from "@/lib/tasks-types";
import { patchTaskExecutionProgress } from "@/lib/tasks-api";
import {
  effectiveSaveLocalArchive,
  effectiveSaveToDisk,
} from "@/lib/schedule-output-destination";
import {
  localDominatorArchiveFiles,
  persistTaskArchiveFiles,
} from "@/lib/task-execution-archive";
import { fetchWorkflow, fetchWorkflowStepOutputs } from "@/lib/workflow/workflow-api";
import { syncWorkflowRunArchiveDeliverables } from "@/lib/workflow/workflow-rag-archive";
import { syncAgentRunHostedFilesFromBulk } from "@/lib/agent-runs/agent-run-hosted-files";
import type { BulkGeneratedFile } from "@/lib/bulk-file-manager";
import { automationTitleFromRun } from "@/lib/automation-email-delivery";
import { chainWorkflowOnGridExport } from "@/lib/workflow/workflow-grid-export-chain";
import { completeAgentRunExecution } from "@/lib/workflow/workflow-deliveries-skip";
import { readWorkflowAgentBinding } from "@/lib/workflow/workflow-agent-binding";
import { stashWorkflowGridCsv } from "@/lib/workflow/workflow-grid-csv-stash";
import {
  dominantKeywordFromRows,
  parseLocalDominatorCsv,
} from "@/lib/local-dominator-csv";
import {
  resolveLocalDominatorExportKeyword,
  resolveWorkflowLocalDominatorGridKeyword,
} from "@/lib/local-dominator/local-dominator-export-keyword";

function resolveSite(siteId: string, sites: WordPressSite[]): WordPressSite {
  const fromList = sites.find((s) => s.id === siteId);
  if (fromList) return fromList;
  const stored = getStoredSites().find((s) => s.id === siteId);
  if (stored) return stored;
  throw new Error("WordPress site not found for this research export run.");
}

export function resolveEffectiveGridKeyword(
  keyword: string,
  csvContent: string,
  businessName?: string,
): string {
  const trimmed = resolveLocalDominatorExportKeyword(keyword);
  if (trimmed) return trimmed;
  const fallback = businessName?.trim() ?? "";
  const parsed = parseLocalDominatorCsv(csvContent, { defaultKeyword: fallback });
  const fromRows = dominantKeywordFromRows(parsed.rows).trim();
  return fromRows || fallback;
}

function contractFields(
  contract: TaskExecutionClientRunContract | Record<string, unknown>,
  site?: WordPressSite,
) {
  const rawBusinessName = String((contract as TaskExecutionClientRunContract).businessName ?? "").trim();
  const businessName = rawBusinessName || site?.name?.trim() || "";
  const rawKeyword = String((contract as TaskExecutionClientRunContract).keyword ?? "");
  const keyword = resolveLocalDominatorExportKeyword(
    resolveWorkflowLocalDominatorGridKeyword(
      { keyword: rawKeyword, businessName },
      rawKeyword,
      businessName,
    ),
  );
  if (!businessName) {
    throw new Error("businessName is required for Local Dominator export.");
  }
  return { businessName, keyword };
}

function executionPayloadFromRun(run: AgentRun): TaskExecutionClientRunContract | Record<string, unknown> {
  const plan = (run.plan ?? {}) as Record<string, unknown>;
  return (plan.executionPayload ?? plan.clientRunContract ?? plan) as
    | TaskExecutionClientRunContract
    | Record<string, unknown>;
}

function syncLocalDominatorHostedFile(
  runId: number,
  fileName: string,
  csvContent: string,
  businessName: string,
  keyword: string,
): void {
  const file: BulkGeneratedFile = {
    id: `local-dominator-${runId}`,
    rowIndex: 0,
    fileName,
    content: csvContent,
    mimeType: "text/csv",
    status: "completed",
    timestamp: Date.now(),
    rowData: {
      keyword,
      title: businessName,
    },
  };
  syncAgentRunHostedFilesFromBulk(runId, [file]);
}

async function persistLocalDominatorDeliverable(
  run: AgentRun,
  archiveFiles: ReturnType<typeof localDominatorArchiveFiles>,
  onChainStep?: (label: string, status: "running" | "error") => void | Promise<void>,
): Promise<void> {
  const file = archiveFiles[0];
  if (!file) return;
  const artifact = await persistAgentRunArtifact(run.teamId, run, {
    stepKey: "grid_export",
    stepLabel: "Grid export CSV",
    name: file.fileName,
    mime: file.mime,
    content: file.content,
  });
  if (!artifact?.url) {
    throw new Error("Could not save grid export CSV to run archive.");
  }
  const fileRefs = [{ name: file.fileName, url: artifact.url, mime: file.mime }];
  if (run.taskId > 0) {
    await persistTaskArchiveFiles(run.teamId, run.taskId, archiveFiles);
  }
  const binding = readWorkflowAgentBinding(run);
  if (binding) {
    const contract = executionPayloadFromRun(run);
    const siteId = String(run.context?.siteId ?? "").trim();
    const site = siteId ? resolveSite(siteId, getStoredSites()) : undefined;
    const { businessName, keyword } = contractFields(contract, site);
    const effectiveKeyword = resolveEffectiveGridKeyword(keyword, file.content, businessName);
    stashWorkflowGridCsv(binding.workflowRunId, file.content, fileRefs, effectiveKeyword);
    const workflow = await fetchWorkflow(run.teamId, binding.workflowId);
    if (workflow) {
      const outputs = await fetchWorkflowStepOutputs(
        run.teamId,
        binding.workflowId,
        binding.workflowRunId,
      );
      await syncWorkflowRunArchiveDeliverables({
        teamId: run.teamId,
        workflowId: binding.workflowId,
        workflowRunId: binding.workflowRunId,
        nodes: workflow.nodes,
        outputs,
        agentRunId: run.id,
        textPreview: "Grid export CSV",
        extraFileRefs: fileRefs,
      });
    }
    await onChainStep?.("Chaining entity pages…", "running");
    try {
      await chainWorkflowOnGridExport(run, { fileRefs });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Workflow chain failed";
      await onChainStep?.(message, "error");
      throw err instanceof Error ? err : new Error(message);
    }
  }
}

async function patchBrowserPreviewLocally(
  runId: number,
  label: string,
  screenshotBase64: string,
  mime = "image/jpeg",
): Promise<void> {
  const artifact: AgentRunStepArtifact = {
    id: "preview-live",
    name: "browser-preview.jpg",
    url: agentRunBrowserPreviewDataUrl(screenshotBase64, mime),
    mime,
  };
  const at = new Date().toISOString();
  patchAgentRunInList(runId, (run) => {
    const steps = run.steps ?? [];
    const idx = steps.findIndex((step) => step.stepKey === "browser_preview");
    if (idx >= 0) {
      const next = [...steps];
      next[idx] = {
        ...steps[idx]!,
        label,
        status: "running",
        payload: { artifacts: [artifact] },
        updatedAt: at,
      };
      return { steps: next };
    }
    return {
      steps: [
        ...steps,
        {
          id: Date.now(),
          stepIndex: steps.length,
          stepKey: "browser_preview",
          label,
          status: "running",
          payload: { artifacts: [artifact] },
          createdAt: at,
          updatedAt: at,
        },
      ],
    };
  });
}

async function handleExportProgress(
  run: AgentRun,
  ctx: AgentRunHarnessContext,
  progress: LocalDominatorExportJobProgress,
  state: { lastLabel: string; lastScreenshot: string | null; lastPreviewLabel: string },
): Promise<void> {
  const label = progress.label?.trim();
  if (label && label !== state.lastLabel) {
    state.lastLabel = label;
    await ctx.onStep?.(label, "running");
  }

  const screenshot = progress.screenshotBase64?.trim();
  const previewLabel = label || state.lastLabel || "Browser preview";
  const shouldUpdatePreview =
    Boolean(screenshot) &&
    (screenshot !== state.lastScreenshot || previewLabel !== state.lastPreviewLabel);
  if (shouldUpdatePreview && screenshot) {
    state.lastScreenshot = screenshot;
    state.lastPreviewLabel = previewLabel;
    await patchBrowserPreviewLocally(run.id, previewLabel, screenshot);
  }
}

async function runLocalDominatorExportWithPreview(
  run: AgentRun,
  ctx: AgentRunHarnessContext,
  businessName: string,
  keyword: string,
): Promise<LocalDominatorExportResponse> {
  const started = await startLocalDominatorExportJob({ businessName, keyword });
  if (!started.ok || !started.jobId) {
    throw new Error(started.error ?? "Local Dominator export worker is not configured.");
  }

  registerLocalDominatorExportJob(run.id, started.jobId);

  const state = { lastLabel: "", lastScreenshot: null as string | null, lastPreviewLabel: "" };
  try {
    const response = await waitForLocalDominatorExportJob(started.jobId, {
      onProgress: (progress) => handleExportProgress(run, ctx, progress, state),
      shouldAbort: async () => {
        const cancelled = (await ctx.isCancelled?.()) ?? false;
        if (cancelled) {
          await cancelLocalDominatorExportJobForAgentRun(run.id);
        }
        return cancelled;
      },
    });

    if (state.lastScreenshot) {
      await persistAgentRunArtifact(run.teamId, run, {
        stepKey: "browser_preview",
        stepLabel: state.lastLabel || "Browser preview",
        name: "browser-preview.jpg",
        mime: "image/jpeg",
        content: state.lastScreenshot,
      });
    }

    return response;
  } finally {
    unregisterLocalDominatorExportJob(run.id);
  }
}

async function finalizeLocalDominatorExport(
  run: AgentRun,
  response: LocalDominatorExportResponse,
  contract: TaskExecutionClientRunContract | Record<string, unknown>,
  businessName: string,
  keyword: string,
  onChainStep?: (label: string, status: "running" | "error") => void | Promise<void>,
): Promise<{ csvContent: string; archiveFiles: ReturnType<typeof localDominatorArchiveFiles> }> {
  if (!response.csvBase64 || !response.fileName) {
    throw new Error(response.error ?? "Local Dominator export failed.");
  }

  const csvContent = decodeLocalDominatorCsvBase64(response.csvBase64);
  const effectiveKeyword = resolveEffectiveGridKeyword(keyword, csvContent, businessName);
  const archiveFiles = localDominatorArchiveFiles({
    fileName: response.fileName,
    csvContent,
    businessName,
    keyword: effectiveKeyword,
  });

  const saveToDisk = effectiveSaveToDisk("local_dominator_export", contract);
  const saveLocalArchive = effectiveSaveLocalArchive("local_dominator_export", contract);

  if (saveToDisk && !saveLocalArchive) {
    downloadLocalDominatorCsv(archiveFiles[0]?.fileName ?? response.fileName, csvContent);
  }

  syncLocalDominatorHostedFile(
    run.id,
    archiveFiles[0]?.fileName ?? response.fileName,
    csvContent,
    businessName,
    effectiveKeyword,
  );

  await persistLocalDominatorDeliverable(run, archiveFiles, onChainStep);

  return { csvContent, archiveFiles };
}

export async function runLocalDominatorExportDirectHarness(
  run: AgentRun,
  ctx: AgentRunHarnessContext,
): Promise<AgentRunResult> {
  const siteId = String(run.context?.siteId ?? "").trim();
  if (!siteId) {
    throw new Error("Set a client on the workflow before running.");
  }

  const site = resolveSite(siteId, getStoredSites());
  const contract = executionPayloadFromRun(run);
  const { businessName, keyword } = contractFields(contract, site);

  await ctx.onStep?.("Preflight", "running");
  await ctx.onStep?.("Export grid CSV", "running");

  const response = await runLocalDominatorExportWithPreview(run, ctx, businessName, keyword);
  await finalizeLocalDominatorExport(
    run,
    response,
    contract,
    businessName,
    keyword,
    (label, status) => ctx.onStep?.(label, status === "error" ? "error" : "running"),
  );

  return {
    updated: 1,
    message: `Exported Local Dominator grid for ${businessName}`,
    batchKey: run.clientBatchKey || undefined,
  };
}

export async function runLocalDominatorExportClientHarness(
  run: AgentRun,
  site: WordPressSite,
  contract: TaskExecutionClientRunContract,
  executionId: number,
  ctx: AgentRunHarnessContext,
  batchKey: string,
): Promise<AgentRunResult> {
  const { businessName, keyword } = contractFields(contract, site);

  await ctx.onStep?.("Preflight", "running");
  await patchTaskExecutionProgress(run.teamId, executionId, {
    stepId: "preflight",
    message: "Starting Local Dominator export…",
    progress: 0.05,
  });

  await ctx.onStep?.("Export grid CSV", "running");
  await patchTaskExecutionProgress(run.teamId, executionId, {
    message: `Exporting ${businessName}…`,
    progress: 0.2,
  });

  const response = await runLocalDominatorExportWithPreview(run, ctx, businessName, keyword);
  const { archiveFiles } = await finalizeLocalDominatorExport(
    run,
    response,
    contract,
    businessName,
    keyword,
    (label, status) => ctx.onStep?.(label, status === "error" ? "error" : "running"),
  );

  const saveLocalArchive = effectiveSaveLocalArchive("local_dominator_export", contract);
  const fileName = archiveFiles[0]?.fileName ?? response.fileName;

  const deliveryResult = await completeAgentRunExecution({
    teamId: run.teamId,
    executionId,
    contract,
    run,
    saveLocalArchive,
    ok: true,
    summaryText: archiveFiles[0]?.content ?? "",
    fileNameHint: fileName.replace(/\.csv$/i, ""),
    tokenContext: {
      siteName: site.name,
      automationTitle: automationTitleFromRun(run),
      executionKind: "local_dominator_export",
      summary: `Exported Local Dominator grid for ${businessName}`,
    },
    result: {
      businessName,
      keyword,
      fileName,
      siteName: site.name,
    },
    onStep: (label, status) => ctx.onStep?.(label, status ?? "running"),
  });

  return {
    updated: 1,
    message: `Exported Local Dominator grid for ${businessName}`,
    batchKey,
    ...deliveryResult,
  };
}

export { resolveSite };
