import type { WordPressSite } from "@/components/integrations/types";
import { getStoredSites } from "@/components/integrations/storage";
import type { AgentRunHarnessContext } from "@/lib/agent-runs/harness-registry";
import type { AgentRun, AgentRunResult, AgentRunStepArtifact } from "@/lib/agent-runs-types";
import { persistAgentRunArtifact } from "@/lib/agent-runs/agent-run-artifacts";
import { commitAgentRunDeliverable } from "@/lib/agent-runs/commit-agent-run-deliverable";
import { agentRunBrowserPreviewDataUrl } from "@/lib/agent-runs/agent-run-browser-preview";
import { patchAgentRunInList } from "@/lib/agent-runs/agent-runs-local-patch";
import {
  startBrowserAutomationJob,
  waitForBrowserAutomationJob,
  type BrowserAutomationJobProgress,
  type BrowserAutomationProgressDeliverable,
} from "@/lib/browser-automation-api";
import { buildExecutionCompletePayload, type TaskArchiveFileInput } from "@/lib/task-execution-archive";
import { completeTaskExecution, patchTaskExecutionProgress } from "@/lib/tasks-api";
import {
  browserAutomationRequiresClient,
  browserInstructionsForJob,
  resolveBrowserTargetUrl,
} from "@/lib/browser-automation/resolve-browser-target-url";
import type { TaskExecutionClientRunContract, TaskExecutionPayload } from "@/lib/tasks-types";
import { effectiveSaveLocalArchive } from "@/lib/schedule-output-destination";
import { automationTitleFromRun } from "@/lib/automation-email-delivery";
import { completeAgentRunExecution } from "@/lib/workflow/workflow-deliveries-skip";
import { fetchWorkflowStepOutputs } from "@/lib/workflow/workflow-api";
import { effectiveClientSiteIds } from "@/lib/workflow/workflow-rag-client";

function resolveSite(siteId: string, sites: WordPressSite[]): WordPressSite {
  const fromList = sites.find((s) => s.id === siteId);
  if (fromList) return fromList;
  const stored = getStoredSites().find((s) => s.id === siteId);
  if (stored) return stored;
  throw new Error("WordPress site not found for this browser automation run.");
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

async function handleAutomationProgress(
  run: AgentRun,
  ctx: AgentRunHarnessContext,
  progress: BrowserAutomationJobProgress,
  state: {
    lastLabel: string;
    lastScreenshot: string | null;
    lastPreviewLabel: string;
    saveLocalArchive: boolean;
    committedDeliverableSignatures: Set<string>;
    workflowOutputs?: Awaited<ReturnType<typeof fetchWorkflowStepOutputs>>;
  },
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

  if (progress.deliverable) {
    await commitProgressDeliverable(run, progress.deliverable, state);
  }
}

export function progressDeliverableCommitSignature(
  item: Pick<BrowserAutomationProgressDeliverable, "filename" | "kind" | "rowIndex">,
  contentLength: number,
): string {
  const filename = String(item.filename ?? "deliverable").trim() || "deliverable";
  const isStreamingText = item.kind === "csv" || item.kind === "text";
  if (isStreamingText) {
    return `${filename}:${contentLength}`;
  }
  return `${filename}:${contentLength}:${item.rowIndex ?? 0}`;
}

async function commitProgressDeliverable(
  run: AgentRun,
  item: BrowserAutomationProgressDeliverable,
  state: {
    saveLocalArchive: boolean;
    committedDeliverableSignatures: Set<string>;
    workflowOutputs?: Awaited<ReturnType<typeof fetchWorkflowStepOutputs>>;
  },
): Promise<void> {
  const content = String(item.content ?? item.base64 ?? "").trim();
  if (!content) return;

  const signature = progressDeliverableCommitSignature(item, content.length);
  if (state.committedDeliverableSignatures.has(signature)) return;
  state.committedDeliverableSignatures.add(signature);

  if (!state.workflowOutputs) {
    const workflowId = Number(run.context?.workflowId ?? run.plan?.workflowId ?? 0);
    const workflowRunId = Number(run.context?.workflowRunId ?? run.plan?.workflowRunId ?? 0);
    if (workflowId > 0 && workflowRunId > 0) {
      state.workflowOutputs = await fetchWorkflowStepOutputs(run.teamId, workflowId, workflowRunId);
    }
  }

  const filename = String(item.filename ?? "deliverable").trim() || "deliverable";
  const mime = String(item.mime ?? "application/octet-stream").trim() || "application/octet-stream";
  const stepKey =
    item.kind === "text" || item.kind === "csv" ? "browser_deliverable" : "browser_capture";
  const stepLabel = String(item.label ?? "Browser deliverable").trim() || "Browser deliverable";
  const replaceOutput = item.kind === "csv" || item.kind === "text";

  await commitAgentRunDeliverable({
    run,
    stepKey,
    stepLabel,
    files: [{ fileName: filename, mime, content }],
    textPreview: stepLabel,
    saveLocalArchive: state.saveLocalArchive,
    workflowOutputs: state.workflowOutputs,
    replaceOutput,
  });
}

function sessionArchiveFile(input: {
  runId: number;
  targetUrl: string;
  summary: Record<string, unknown>;
}): TaskArchiveFileInput {
  const archiveSummary = {
    ...input.summary,
    deliverables: Array.isArray(input.summary.deliverables)
      ? (input.summary.deliverables as Array<Record<string, unknown>>).map((item) => ({
          filename: item.filename,
          label: item.label,
          mime: item.mime,
          fullPage: item.fullPage,
          capturedAt: item.capturedAt,
          url: item.url,
        }))
      : [],
  };
  const content = JSON.stringify(archiveSummary, null, 2);
  return {
    fileName: `browser-automation-${input.runId}.json`,
    mime: "application/json",
    content,
  };
}

type BrowserDeliverable = {
  filename?: string;
  label?: string;
  mime?: string;
  base64?: string;
  content?: string;
  kind?: string;
};

function deliverableContent(item: BrowserDeliverable): string {
  const text = String(item.content ?? "").trim();
  if (text) return text;
  return String(item.base64 ?? "").trim();
}

function deliverableStepKey(item: BrowserDeliverable): string {
  if (item.kind === "text" || item.kind === "csv") return "browser_deliverable";
  return "browser_capture";
}

function instructionsAskForScreenshot(html: string): boolean {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return /\bscreenshot\b|\bscreen shot\b/.test(text);
}

function captureDeliverablesFromSummary(
  summary: Record<string, unknown>,
  fallbackScreenshot: string | null,
  browserInstructionsHtml: string,
): BrowserDeliverable[] {
  const fromSummary = Array.isArray(summary.deliverables)
    ? (summary.deliverables as BrowserDeliverable[])
    : [];
  if (fromSummary.some((item) => deliverableContent(item))) {
    return fromSummary;
  }
  const screenshot = fallbackScreenshot?.trim();
  if (!screenshot || !instructionsAskForScreenshot(browserInstructionsHtml)) {
    return fromSummary;
  }
  return [
    {
      filename: "homepage-screenshot.jpg",
      label: "Homepage screenshot",
      mime: "image/jpeg",
      base64: screenshot,
    },
  ];
}

async function persistBrowserDeliverables(
  run: AgentRun,
  deliverables: BrowserDeliverable[],
  saveLocalArchive: boolean,
  committedDeliverableSignatures?: Set<string>,
): Promise<TaskArchiveFileInput[]> {
  const files: TaskArchiveFileInput[] = [];
  const groups = new Map<string, BrowserDeliverable[]>();
  for (const item of deliverables) {
    const content = deliverableContent(item);
    if (!content) continue;
    const filename = String(item.filename ?? "deliverable");
    const alreadyStreamed = [...(committedDeliverableSignatures ?? [])].some((sig) =>
      sig.startsWith(`${filename}:`),
    );
    if (alreadyStreamed && (item.kind === "csv" || item.kind === "text")) continue;
    const stepKey = deliverableStepKey(item);
    const bucket = groups.get(stepKey) ?? [];
    bucket.push(item);
    groups.set(stepKey, bucket);
  }

  const workflowId = Number(run.context?.workflowId ?? run.plan?.workflowId ?? 0);
  const workflowRunId = Number(run.context?.workflowRunId ?? run.plan?.workflowRunId ?? 0);
  const workflowOutputs =
    workflowId > 0 && workflowRunId > 0
      ? await fetchWorkflowStepOutputs(run.teamId, workflowId, workflowRunId)
      : undefined;

  for (const [stepKey, items] of groups) {
    const batchFiles: TaskArchiveFileInput[] = [];
    for (const item of items) {
      const content = deliverableContent(item);
      const name = String(item.filename ?? "deliverable").trim() || "deliverable";
      const mime = String(item.mime ?? "application/octet-stream").trim() || "application/octet-stream";
      batchFiles.push({ fileName: name, mime, content });
    }
    if (!batchFiles.length) continue;
    const stepLabel = String(items[0]?.label ?? "Browser deliverable").trim() || "Browser deliverable";
    await commitAgentRunDeliverable({
      run,
      stepKey,
      stepLabel,
      files: batchFiles,
      textPreview: stepLabel,
      saveLocalArchive,
      workflowOutputs,
    });
    files.push(...batchFiles);
  }

  return files;
}

async function resolveBrowserRunInputs(
  run: AgentRun,
  contract: TaskExecutionClientRunContract & Record<string, unknown>,
  site?: WordPressSite,
): Promise<{ targetUrl: string; browserInstructionsHtml: string }> {
  const instructionsHtml = String(contract.browserInstructionsHtml ?? "").trim();
  if (!instructionsHtml) {
    throw new Error("Set browser instructions before running.");
  }

  const workflowId = Number(run.context?.workflowId ?? run.plan?.workflowId ?? 0);
  const workflowRunId = Number(run.context?.workflowRunId ?? run.plan?.workflowRunId ?? 0);
  const outputs =
    workflowId > 0 && workflowRunId > 0
      ? await fetchWorkflowStepOutputs(run.teamId, workflowId, workflowRunId)
      : undefined;
  const siteId = String(site?.id ?? contract.siteId ?? run.context?.siteId ?? "").trim() || undefined;
  const clientSiteIds = outputs ? effectiveClientSiteIds(outputs, siteId ? [siteId] : []) : [];

  const targetUrl = resolveBrowserTargetUrl(contract as TaskExecutionPayload, site, {
    outputs,
    siteId,
    clientSiteIds,
  });
  const browserInstructionsHtml = browserInstructionsForJob(
    instructionsHtml,
    String(contract.workflowContextBlock ?? ""),
  );

  return { targetUrl, browserInstructionsHtml };
}

function resolveBrowserAutomationRunContext(run: AgentRun): {
  contract: TaskExecutionClientRunContract & Record<string, unknown>;
  site?: WordPressSite;
} {
  const planPayload = (run.plan ?? {}) as Record<string, unknown>;
  const raw = (planPayload.executionPayload ?? planPayload.clientRunContract ?? planPayload) as
    | TaskExecutionClientRunContract
    | Record<string, unknown>;
  const siteId = String(raw.siteId ?? run.context?.siteId ?? "").trim() || undefined;
  const contract = {
    ...raw,
    ...(siteId ? { siteId } : {}),
  } as TaskExecutionClientRunContract & Record<string, unknown>;
  const site = siteId ? getStoredSites().find((item) => item.id === siteId) : undefined;
  return { contract, site };
}

async function runBrowserAutomationSession(
  run: AgentRun,
  targetUrl: string,
  browserInstructionsHtml: string,
  ctx: AgentRunHarnessContext,
): Promise<{
  archiveFiles: TaskArchiveFileInput[];
  summary: Record<string, unknown>;
}> {
  const planPayload = (run.plan ?? {}) as Record<string, unknown>;
  const contract = (planPayload.executionPayload ?? planPayload.clientRunContract ?? planPayload) as
    | TaskExecutionClientRunContract
    | Record<string, unknown>;
  const saveLocalArchive = effectiveSaveLocalArchive("browser_automation", contract);

  const started = await startBrowserAutomationJob({ targetUrl, browserInstructionsHtml });
  if (!started.ok || !started.jobId) {
    throw new Error(started.error ?? "Browser automation worker is not configured.");
  }

  const state = {
    lastLabel: "",
    lastScreenshot: null as string | null,
    lastPreviewLabel: "",
    saveLocalArchive,
    committedDeliverableSignatures: new Set<string>(),
  };

  const terminal = await waitForBrowserAutomationJob(started.jobId, {
    onProgress: (progress) => handleAutomationProgress(run, ctx, progress, state),
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

  const summary = (terminal.result ?? {}) as Record<string, unknown>;
  const captureDeliverables = captureDeliverablesFromSummary(
    summary,
    state.lastScreenshot,
    browserInstructionsHtml,
  );
  const captureFiles = await persistBrowserDeliverables(
    run,
    captureDeliverables,
    saveLocalArchive,
    state.committedDeliverableSignatures,
  );
  const archiveFile = sessionArchiveFile({
    runId: run.id,
    targetUrl,
    summary,
  });

  await persistAgentRunArtifact(run.teamId, run, {
    stepKey: "browser_automation",
    stepLabel: "Browser automation result",
    name: archiveFile.fileName,
    mime: archiveFile.mime,
    content: archiveFile.content,
  });

  return {
    archiveFiles: [archiveFile, ...captureFiles],
    summary,
  };
}

export async function runBrowserAutomationDirectHarness(
  run: AgentRun,
  ctx: AgentRunHarnessContext,
): Promise<AgentRunResult> {
  const { contract, site } = resolveBrowserAutomationRunContext(run);

  if (
    browserAutomationRequiresClient(contract as TaskExecutionPayload) &&
    !String(contract.siteId ?? "").trim()
  ) {
    throw new Error("Set a client before running browser automation.");
  }

  const { targetUrl, browserInstructionsHtml } = await resolveBrowserRunInputs(run, contract, site);

  await ctx.onStep?.("Starting browser automation", "running");
  const { archiveFiles, summary } = await runBrowserAutomationSession(
    run,
    targetUrl,
    browserInstructionsHtml,
    ctx,
  );

  const saveLocalArchive = effectiveSaveLocalArchive("browser_automation", contract);
  if (saveLocalArchive && run.plan?.taskExecutionId) {
    await completeTaskExecution(
      run.teamId,
      Number(run.plan.taskExecutionId),
      buildExecutionCompletePayload({
        ok: Boolean(summary.success ?? true),
        run,
        saveLocalArchive: true,
        archiveFiles,
        result: summary,
      }),
    );
  }

  await ctx.onStep?.("Browser automation complete", "done");

  return {
    updated: 1,
    message: String(summary.summary ?? "Browser automation finished."),
    batchKey: run.clientBatchKey || undefined,
  };
}

function archiveFileContent(files: TaskArchiveFileInput[]): string {
  return files.map((file) => file.content).join("\n\n");
}

export async function runBrowserAutomationClientHarness(
  run: AgentRun,
  site: WordPressSite,
  contract: TaskExecutionClientRunContract,
  executionId: number,
  ctx: AgentRunHarnessContext,
  batchKey: string,
): Promise<AgentRunResult> {
  const { targetUrl, browserInstructionsHtml } = await resolveBrowserRunInputs(run, contract, site);

  await ctx.onStep?.("Starting browser automation", "running");
  await patchTaskExecutionProgress(run.teamId, executionId, {
    stepId: "preflight",
    message: `Opening ${targetUrl}…`,
    progress: 0.05,
  });

  const { archiveFiles, summary } = await runBrowserAutomationSession(
    run,
    targetUrl,
    browserInstructionsHtml,
    ctx,
  );
  const saveLocalArchive = effectiveSaveLocalArchive("browser_automation", contract);
  const summaryText = archiveFileContent(archiveFiles);

  const deliveryResult = await completeAgentRunExecution({
    teamId: run.teamId,
    executionId,
    contract,
    run,
    saveLocalArchive,
    ok: Boolean(summary.success ?? true),
    archiveFiles,
    summaryText,
    fileNameHint: site.name?.trim() ? `${site.name} browser automation` : "Browser automation",
    tokenContext: {
      siteName: site.name?.trim() || undefined,
      automationTitle: automationTitleFromRun(run),
      executionKind: "browser_automation",
      summary: String(summary.summary ?? "Browser automation finished."),
    },
    result: summary,
    onStep: (label, status) => ctx.onStep?.(label, status ?? "running"),
  });

  return {
    updated: 1,
    message: String(summary.summary ?? "Browser automation finished."),
    batchKey,
    ...deliveryResult,
  };
}

export { resolveSite };
