import { patchAgentRun } from "@/lib/agent-runs-api";
import { checkpointFieldsFromStepPayload, readAgentRunCheckpoint } from "@/lib/agent-runs/agent-run-checkpoint";
import { appendAgentRunStepLocally, patchAgentRunInList } from "@/lib/agent-runs/agent-runs-local-patch";
import type { AgentRun, AgentRunStep } from "@/lib/agent-runs-types";

export type AppendAgentRunStepInput = {
  label: string;
  status?: AgentRunStep["status"];
  stepKey?: string;
  resumePayload?: Record<string, unknown>;
};

export async function appendAgentRunStep(
  teamId: number,
  runId: number,
  input: AppendAgentRunStepInput,
  existingRun?: AgentRun | null,
): Promise<void> {
  const label = input.label.trim();
  if (!label) return;

  const status = input.status ?? "running";
  const resumePayload = input.resumePayload ?? {};
  const stepKey = input.stepKey?.trim() || undefined;
  const stepAt = new Date().toISOString();

  appendAgentRunStepLocally(runId, label, status, resumePayload, stepAt, stepKey);

  const existingCheckpoint = readAgentRunCheckpoint(existingRun);
  const derived = checkpointFieldsFromStepPayload(label, stepAt, resumePayload, existingCheckpoint);

  patchAgentRunInList(runId, (run) => ({
    result: {
      ...(run.result ?? {}),
      checkpoint: {
        ...existingCheckpoint,
        ...derived,
        lastStepLabel: label,
        lastStepAt: stepAt,
        lastStepPayload: resumePayload,
        lastMessage: label,
      },
    },
  }));

  await patchAgentRun(teamId, runId, {
    step: { label, status, stepKey, payload: resumePayload },
    result: {
      ...(existingRun?.result ?? {}),
      checkpoint: {
        ...existingCheckpoint,
        ...derived,
        lastStepLabel: label,
        lastStepAt: stepAt,
        lastStepPayload: resumePayload,
        lastMessage: label,
      },
    },
  });
}
