import { fetchAgentRun, patchAgentRun } from "@/lib/agent-runs-api";
import type { AgentRun, AgentRunCheckpoint, AgentRunResult } from "@/lib/agent-runs-types";

export function readAgentRunCheckpoint(run: AgentRun | null | undefined): AgentRunCheckpoint {
  const checkpoint = run?.result?.checkpoint;
  return {
    completedUrls: Array.isArray(checkpoint?.completedUrls) ? [...checkpoint.completedUrls] : [],
    uploadedUrls: Array.isArray(checkpoint?.uploadedUrls) ? [...checkpoint.uploadedUrls] : [],
    currentUrl: checkpoint?.currentUrl,
    currentIndex: checkpoint?.currentIndex,
    totalCount: checkpoint?.totalCount,
    currentUrlProgress: checkpoint?.currentUrlProgress,
    lastMessage: checkpoint?.lastMessage,
    completedUrlSummaries: Array.isArray(checkpoint?.completedUrlSummaries)
      ? checkpoint.completedUrlSummaries.map((entry) => ({ ...entry }))
      : [],
    lastStepLabel: checkpoint?.lastStepLabel,
    lastStepAt: checkpoint?.lastStepAt,
    lastStepPayload: checkpoint?.lastStepPayload ? { ...checkpoint.lastStepPayload } : undefined,
  };
}

export function checkpointFieldsFromStepPayload(
  label: string,
  _stepAt: string,
  payload: Record<string, unknown>,
  existing: AgentRunCheckpoint,
): Partial<AgentRunCheckpoint> {
  const patch: Partial<AgentRunCheckpoint> = {};

  if (typeof payload.currentIndex === "number") patch.currentIndex = payload.currentIndex;
  if (typeof payload.totalCount === "number") patch.totalCount = payload.totalCount;
  if (typeof payload.currentUrl === "string") patch.currentUrl = payload.currentUrl;
  if (typeof payload.currentUrlProgress === "number") patch.currentUrlProgress = payload.currentUrlProgress;

  if (Array.isArray(payload.completedUrls)) {
    patch.completedUrls = payload.completedUrls.filter((u): u is string => typeof u === "string");
  }
  if (Array.isArray(payload.uploadedUrls)) {
    patch.uploadedUrls = payload.uploadedUrls.filter((u): u is string => typeof u === "string");
  }
  if (Array.isArray(payload.completedUrlSummaries)) {
    patch.completedUrlSummaries = payload.completedUrlSummaries as AgentRunCheckpoint["completedUrlSummaries"];
  }

  if (!patch.completedUrls?.length && existing.completedUrls.length) {
    patch.completedUrls = existing.completedUrls;
  }
  if (!patch.uploadedUrls?.length && existing.uploadedUrls.length) {
    patch.uploadedUrls = existing.uploadedUrls;
  }

  void label;
  return patch;
}

export function resumeCompletedUrlsFromCheckpoint(checkpoint: AgentRunCheckpoint): string[] {
  const uploaded = checkpoint.uploadedUrls.filter(Boolean);
  if (uploaded.length > 0) return uploaded;
  return checkpoint.completedUrls.filter(Boolean);
}

export function isAgentRunResumable(run: AgentRun): boolean {
  if (run.status !== "failed" && run.status !== "cancelled") return false;
  const checkpoint = readAgentRunCheckpoint(run);
  const payload = checkpoint.lastStepPayload ?? {};
  if (payload.phase === "bulk" && typeof payload.rowIndex === "number" && typeof payload.postCount === "number") {
    return payload.rowIndex < payload.postCount;
  }
  if (payload.phase === "gsc_sections" && Array.isArray(payload.sectionResults) && payload.outline) {
    const outline = payload.outline as { sections?: unknown[] };
    const total = outline.sections?.length ?? 0;
    return payload.sectionResults.length < total;
  }
  if (!checkpoint.totalCount || checkpoint.totalCount <= 0) return false;
  const done =
    checkpoint.uploadedUrls.length > 0
      ? checkpoint.uploadedUrls.length
      : checkpoint.completedUrls.length;
  return done < checkpoint.totalCount;
}

export function isAgentRunInterrupted(run: AgentRun): boolean {
  if (run.status !== "failed" && run.status !== "cancelled") return false;
  if (isAgentRunResumable(run)) return true;
  const checkpoint = readAgentRunCheckpoint(run);
  if (checkpoint.totalCount != null && checkpoint.totalCount > 0) return true;
  return Boolean(run.errorMessage?.trim());
}

type CheckpointPatch = Partial<AgentRunCheckpoint> &
  Pick<AgentRunResult, "updated" | "skipped" | "failed" | "batchKey" | "message">;

function definedCheckpointPatch(partial: CheckpointPatch): CheckpointPatch {
  return Object.fromEntries(
    Object.entries(partial).filter(([, value]) => value !== undefined),
  ) as CheckpointPatch;
}

const pendingCheckpointPatches = new Map<number, CheckpointPatch>();
const checkpointPatchTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function flushAllAgentRunCheckpointPatches(teamId: number): Promise<void> {
  const runIds = [...pendingCheckpointPatches.keys()];
  if (runIds.length === 0) return Promise.resolve();
  return Promise.all(runIds.map((runId) => flushAgentRunCheckpointPatch(teamId, runId))).then(() => undefined);
}

export function flushAgentRunCheckpointPatch(teamId: number, runId: number): Promise<AgentRun | null> {
  const timer = checkpointPatchTimers.get(runId);
  if (timer) {
    clearTimeout(timer);
    checkpointPatchTimers.delete(runId);
  }
  const pending = pendingCheckpointPatches.get(runId);
  if (!pending) return Promise.resolve(null);
  pendingCheckpointPatches.delete(runId);
  return patchAgentRunCheckpoint(teamId, runId, pending);
}

export function scheduleAgentRunCheckpointPatch(
  teamId: number,
  runId: number,
  partial: CheckpointPatch,
  delayMs = 750,
): void {
  const next = definedCheckpointPatch({
    ...(pendingCheckpointPatches.get(runId) ?? {}),
    ...partial,
  });
  if (Object.keys(next).length === 0) return;
  pendingCheckpointPatches.set(runId, next);

  if (checkpointPatchTimers.has(runId)) return;
  checkpointPatchTimers.set(
    runId,
    setTimeout(() => {
      checkpointPatchTimers.delete(runId);
      const pending = pendingCheckpointPatches.get(runId);
      if (!pending) return;
      pendingCheckpointPatches.delete(runId);
      void patchAgentRunCheckpoint(teamId, runId, pending).catch(() => {
        /* progress autosave must not fail the run */
      });
    }, delayMs),
  );
}

export async function patchAgentRunCheckpoint(
  teamId: number,
  runId: number,
  partial: CheckpointPatch,
): Promise<AgentRun | null> {
  const latest = await fetchAgentRun(teamId, runId);
  if (!latest) return null;

  const existing = readAgentRunCheckpoint(latest);
  const patch = definedCheckpointPatch(partial);
  const nextCheckpoint: AgentRunCheckpoint = {
    ...existing,
    ...patch,
    completedUrls: patch.completedUrls ?? existing.completedUrls,
    uploadedUrls: patch.uploadedUrls ?? existing.uploadedUrls,
    completedUrlSummaries: patch.completedUrlSummaries ?? existing.completedUrlSummaries,
  };

  const result: AgentRunResult = {
    ...(latest.result ?? {}),
    checkpoint: nextCheckpoint,
  };

  if (patch.updated !== undefined) result.updated = patch.updated;
  if (patch.skipped !== undefined) result.skipped = patch.skipped;
  if (patch.failed !== undefined) result.failed = patch.failed;
  if (patch.batchKey !== undefined) result.batchKey = patch.batchKey;
  if (patch.message !== undefined) result.message = patch.message;

  const { run } = await patchAgentRun(teamId, runId, { result });
  return run ?? null;
}
