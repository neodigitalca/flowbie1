import { readAgentRunCheckpoint } from "@/lib/agent-runs/agent-run-checkpoint";
import { AGENT_RUN_STEP_KEYS } from "@/lib/agent-runs/agent-run-step-keys";
import type { AgentRun, AgentRunResumePoint } from "@/lib/agent-runs-types";

const NON_RESUME_LABELS = new Set(["Starting…", "Complete", "Queued for resume"]);

/** Single-pass browser sessions: never resume after failure or partial progress. */
const NON_RESUMABLE_RECIPE_KEYS = new Set(["chatgpt_website_audit"]);

const GSC_RESUME_PHASES = new Set(["gsc_fetch", "gsc_outline", "gsc_outline_generating", "gsc_sections"]);

function isNonResumableRecipe(run: AgentRun | null | undefined): boolean {
  const key = run?.recipeKey?.trim();
  return Boolean(key && NON_RESUMABLE_RECIPE_KEYS.has(key));
}

function isGscFileDeliverableStep(payload: Record<string, unknown>): boolean {
  return payload.phase === "gsc_file";
}

function gscCheckpointResumePoint(run: AgentRun | null | undefined): AgentRunResumePoint | null {
  if (run?.recipeKey !== "gsc_reporting") return null;
  const checkpoint = readAgentRunCheckpoint(run);
  const payload = checkpoint.lastStepPayload ?? {};
  const phase = typeof payload.phase === "string" ? payload.phase : "";
  if (!GSC_RESUME_PHASES.has(phase)) return null;
  if (!checkpoint.lastStepLabel?.trim()) return null;
  return {
    label: checkpoint.lastStepLabel.trim(),
    status: "running",
    createdAt: checkpoint.lastStepAt ?? run.updatedAt ?? run.createdAt ?? "",
    payload,
    stepIndex: -1,
  };
}

export function getLastAgentRunStep(run: AgentRun | null | undefined): AgentRunResumePoint | null {
  const gscCheckpoint = gscCheckpointResumePoint(run);
  if (gscCheckpoint) return gscCheckpoint;

  const steps = run?.steps ?? [];
  if (steps.length === 0) {
    const checkpoint = readAgentRunCheckpoint(run);
    if (!checkpoint.lastStepLabel?.trim()) return null;
    return {
      label: checkpoint.lastStepLabel.trim(),
      status: "running",
      createdAt: checkpoint.lastStepAt ?? run?.updatedAt ?? run?.createdAt ?? "",
      payload: checkpoint.lastStepPayload ?? {},
      stepIndex: -1,
    };
  }

  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index]!;
    const label = step.label?.trim();
    if (!label) continue;
    const payload = step.payload ?? {};
    if (isGscFileDeliverableStep(payload)) continue;
    if (step.stepKey === AGENT_RUN_STEP_KEYS.gscDeliverables || step.stepKey === "gscdeliverables") continue;
    return {
      label,
      status: step.status,
      createdAt: step.createdAt || checkpointFallbackAt(run),
      payload: Object.keys(payload).length > 0 ? payload : readAgentRunCheckpoint(run).lastStepPayload ?? {},
      stepIndex: step.stepIndex,
    };
  }

  return gscCheckpointResumePoint(run);
}

function checkpointFallbackAt(run: AgentRun | null | undefined): string {
  return readAgentRunCheckpoint(run).lastStepAt ?? run?.updatedAt ?? run?.createdAt ?? "";
}

export function getAgentRunResumePoint(run: AgentRun | null | undefined): AgentRunResumePoint | null {
  if (isNonResumableRecipe(run)) return null;
  const last = getLastAgentRunStep(run);
  if (!last) return null;
  if (NON_RESUME_LABELS.has(last.label)) return null;
  if (last.status === "done" || last.status === "error") {
    const payload = last.payload;
    const hasProgress =
      Boolean(payload.phase) ||
      (Array.isArray(payload.uploadedUrls) && payload.uploadedUrls.length > 0) ||
      (Array.isArray(payload.completedUrls) && payload.completedUrls.length > 0) ||
      (typeof payload.rowIndex === "number" && payload.rowIndex > 0) ||
      Boolean(payload.checklistRows) ||
      Boolean(payload.bulkRows);
    if (!hasProgress) return null;
  }
  return last;
}

export function agentRunHasResumeProgress(run: AgentRun | null | undefined): boolean {
  return getAgentRunResumePoint(run) != null;
}
