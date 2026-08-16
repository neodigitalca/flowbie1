import { readAgentRunCheckpoint } from "@/lib/agent-runs/agent-run-checkpoint";
import type { AgentRun, AgentRunResumePoint } from "@/lib/agent-runs-types";

const NON_RESUME_LABELS = new Set(["Starting…", "Complete", "Queued for resume"]);

export function getLastAgentRunStep(run: AgentRun | null | undefined): AgentRunResumePoint | null {
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

  const last = steps[steps.length - 1]!;
  const label = last.label?.trim();
  if (!label) return null;

  return {
    label,
    status: last.status,
    createdAt: last.createdAt || checkpointFallbackAt(run),
    payload: last.payload ?? readAgentRunCheckpoint(run).lastStepPayload ?? {},
    stepIndex: last.stepIndex,
  };
}

function checkpointFallbackAt(run: AgentRun | null | undefined): string {
  return readAgentRunCheckpoint(run).lastStepAt ?? run?.updatedAt ?? run?.createdAt ?? "";
}

export function getAgentRunResumePoint(run: AgentRun | null | undefined): AgentRunResumePoint | null {
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
      Boolean(payload.checklistRows);
    if (!hasProgress) return null;
  }
  return last;
}

export function agentRunHasResumeProgress(run: AgentRun | null | undefined): boolean {
  return getAgentRunResumePoint(run) != null;
}
