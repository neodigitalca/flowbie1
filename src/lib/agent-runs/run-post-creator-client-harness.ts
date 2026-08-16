import type { WordPressSite } from "@/components/integrations/types";
import { getStoredSites } from "@/components/integrations/storage";
import type { AgentRunHarnessContext } from "@/lib/agent-runs/harness-registry";
import {
  initPostCreatorProof,
  syncPostCreatorContentBucketProof,
  syncPostCreatorProof,
} from "@/lib/agent-runs/agent-run-post-creator-proof";
import { AGENT_RUN_STEP_KEYS } from "@/lib/agent-runs/agent-run-step-keys";
import type { AgentRun, AgentRunResult } from "@/lib/agent-runs-types";
import {
  postCreatorPayloadFromContract,
  runPostCreatorAgentHarness,
} from "@/lib/post-creator/post-creator-agent-harness";
import type { BulkGeneratedFile } from "@/lib/bulk-file-manager";
import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import type { PostCreatorExecutionPayload, TaskExecutionClientRunContract } from "@/lib/tasks-types";
import { completeTaskExecution, patchTaskExecutionProgress } from "@/lib/tasks-api";

function resolveSite(siteId: string, sites: WordPressSite[]): WordPressSite {
  const fromList = sites.find((s) => s.id === siteId);
  if (fromList) return fromList;
  const stored = getStoredSites().find((s) => s.id === siteId);
  if (stored) return stored;
  throw new Error("WordPress site not found for this post creator run.");
}

function isPostCreatorContract(contract: TaskExecutionClientRunContract): boolean {
  const count = Number(contract.postCount ?? 0);
  return Number.isFinite(count) && count >= 1;
}

function buildPostCreatorResultMessage(result: {
  created: number;
  failed: number;
  postCount: number;
  blockedRows: Array<{ keyword: string }>;
}): string {
  const blockedCount = result.blockedRows.length;
  const base = `Created ${result.created}/${result.postCount} post${result.postCount === 1 ? "" : "s"}`;
  if (result.failed > 0 && blockedCount > 0) {
    return `${base} (${result.failed} failed, ${blockedCount} blocked: cannibalization)`;
  }
  if (result.failed > 0) {
    return `${base} (${result.failed} failed during generation)`;
  }
  if (blockedCount > 0) {
    return `${base} (${blockedCount} blocked: cannibalization)`;
  }
  return base;
}

function isPostCreatorRunOk(result: {
  created: number;
  failed: number;
  postCount: number;
}): boolean {
  return result.created === result.postCount && result.failed === 0;
}

function buildPostCreatorProofCallbacks(
  runId: number,
  payload: PostCreatorExecutionPayload,
  initialPostCount: number,
): {
  onFilesChanged: (files: BulkGeneratedFile[]) => void;
  onHarnessSection: (harnessPayload: BulkHarnessSectionPayload) => void;
  finalizeProof: (result: {
    postCount: number;
    uploadedPosts: import("@/lib/agent-runs-types").AgentRunUploadedPost[];
  }) => void;
} {
  let postCount = initialPostCount;
  let latestFiles: BulkGeneratedFile[] = [];
  const featuredImageEnabled = payload.featuredImage !== false;

  const sync = (
    partial: Partial<{
      files: readonly BulkGeneratedFile[];
      harnessPayload: BulkHarnessSectionPayload;
      activeRowIndex: number | null;
      uploadedPosts: import("@/lib/agent-runs-types").AgentRunUploadedPost[];
    }>,
  ) => {
    syncPostCreatorProof(runId, {
      postCount,
      files: partial.files ?? latestFiles,
      featuredImageEnabled,
      harnessPayload: partial.harnessPayload,
      activeRowIndex: partial.activeRowIndex,
      uploadedPosts: partial.uploadedPosts,
    });
  };

  return {
    onFilesChanged: (files) => {
      latestFiles = [...files];
      sync({ files: latestFiles });
    },
    onHarnessSection: (harnessPayload) => {
      sync({
        harnessPayload,
        activeRowIndex: harnessPayload.rowIndex,
      });
    },
    finalizeProof: (result) => {
      postCount = result.postCount;
      sync({ uploadedPosts: result.uploadedPosts });
    },
  };
}

export async function runPostCreatorClientHarness(
  run: AgentRun,
  site: WordPressSite,
  contract: TaskExecutionClientRunContract,
  executionId: number,
  ctx: AgentRunHarnessContext,
  batchKey: string,
): Promise<AgentRunResult> {
  const payload = postCreatorPayloadFromContract(contract as Record<string, unknown>);
  const postCount = payload.postCount ?? 1;

  initPostCreatorProof(run.id, postCount, payload.featuredImage !== false);
  const proofCallbacks = buildPostCreatorProofCallbacks(run.id, payload, postCount);

  if (!ctx.isResume) {
    await ctx.onStep?.("Preflight", "running", undefined, AGENT_RUN_STEP_KEYS.preflight);
  }
  await patchTaskExecutionProgress(run.teamId, executionId, {
    stepId: "preflight",
    message: "Starting post creator…",
    progress: 0.02,
  });

  const result = await runPostCreatorAgentHarness({
    site,
    payload,
    run,
    runId: run.id,
    teamId: run.teamId,
    isCancelled: ctx.isCancelled,
    resumePoint: ctx.resumePoint,
    onFilesChanged: proofCallbacks.onFilesChanged,
    onHarnessSection: proofCallbacks.onHarnessSection,
    onContentBucketReady: (files) => {
      syncPostCreatorContentBucketProof(run.id, files);
    },
    onProgress: (p, resumePayload) => {
      void ctx.onStep?.(p.label, "running", resumePayload, p.stepKey);
      void patchTaskExecutionProgress(run.teamId, executionId, {
        message: p.label,
        progress: p.total > 0 ? p.step / p.total : undefined,
      });
    },
  });

  proofCallbacks.finalizeProof(result);

  const message = buildPostCreatorResultMessage(result);
  const ok = isPostCreatorRunOk(result);

  await completeTaskExecution(run.teamId, executionId, {
    ok,
    result: {
      created: result.created,
      failed: result.failed,
      postCount: result.postCount,
      urls: result.urls,
      uploadedPosts: result.uploadedPosts,
      blockedRows: result.blockedRows,
    },
  });

  return {
    updated: result.created,
    failed: result.failed,
    postCount: result.postCount,
    message,
    batchKey,
    uploadedPosts: result.uploadedPosts,
    blockedRows: result.blockedRows,
  };
}

export async function runPostCreatorDirectHarness(
  run: AgentRun,
  ctx: AgentRunHarnessContext,
): Promise<AgentRunResult> {
  const siteId = String(run.context?.siteId ?? "").trim();
  if (!siteId) {
    throw new Error("Open Generator with a site selected, then dispatch from Pulse Assist Build.");
  }

  const site = resolveSite(siteId, getStoredSites());
  const plan = (run.plan ?? {}) as Record<string, unknown>;
  const payload = postCreatorPayloadFromContract(plan);
  const postCount = payload.postCount ?? 1;

  initPostCreatorProof(run.id, postCount, payload.featuredImage !== false);
  const proofCallbacks = buildPostCreatorProofCallbacks(run.id, payload, postCount);

  await ctx.onStep?.("Starting post creator…", "running", undefined, AGENT_RUN_STEP_KEYS.starting);

  const result = await runPostCreatorAgentHarness({
    site,
    payload,
    run,
    runId: run.id,
    teamId: run.teamId,
    isCancelled: ctx.isCancelled,
    resumePoint: ctx.resumePoint,
    onFilesChanged: proofCallbacks.onFilesChanged,
    onHarnessSection: proofCallbacks.onHarnessSection,
    onContentBucketReady: (files) => {
      syncPostCreatorContentBucketProof(run.id, files);
    },
    onProgress: (p, resumePayload) => {
      void ctx.onStep?.(p.label, "running", resumePayload, p.stepKey);
    },
  });

  proofCallbacks.finalizeProof(result);

  const message = buildPostCreatorResultMessage(result);
  const ok = isPostCreatorRunOk(result);

  return {
    updated: result.created,
    failed: result.failed,
    postCount: result.postCount,
    message,
    uploadedPosts: result.uploadedPosts,
    blockedRows: result.blockedRows,
  };
}

export function shouldRunPostCreatorHarness(contract: TaskExecutionClientRunContract): boolean {
  return isPostCreatorContract(contract);
}
