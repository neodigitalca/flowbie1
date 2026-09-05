import { patchAgentRun } from "@/lib/agent-runs-api";
import { AGENT_RUN_STEP_KEYS } from "@/lib/agent-runs/agent-run-step-keys";
import {
  checkpointFieldsFromStepPayload,
  readAgentRunCheckpoint,
  stripHeavyAgentRunStepPayload,
} from "@/lib/agent-runs/agent-run-checkpoint";
import {
  appendAgentRunStepLocally,
  patchAgentRunInList,
} from "@/lib/agent-runs/agent-runs-local-patch";
import type { AgentRun, AgentRunStep } from "@/lib/agent-runs-types";

export type AppendAgentRunStepInput = {
  label: string;
  status?: AgentRunStep["status"];
  stepKey?: string;
  resumePayload?: Record<string, unknown>;
};

export async function finalizeOpenAgentRunSteps(
  _teamId: number,
  _runId: number,
  _existingRun?: AgentRun | null,
): Promise<void> {
  // Intentionally no-op: do not mark open steps as done or append duplicate terminal rows.
}

export async function appendAgentRunStep(
  teamId: number,
  runId: number,
  input: AppendAgentRunStepInput,
  existingRun?: AgentRun | null,
): Promise<void> {
  const label = input.label.trim();
  if (!label) return;

  const status = input.status ?? "running";
  const resumePayload = stripHeavyAgentRunStepPayload(input.resumePayload ?? {});
  const stepKey = input.stepKey?.trim() || undefined;
  const stepAt = new Date().toISOString();

  appendAgentRunStepLocally(runId, label, status, resumePayload, stepAt, stepKey);

  const existingCheckpoint = readAgentRunCheckpoint(existingRun);
  const derived = checkpointFieldsFromStepPayload(label, stepAt, resumePayload, existingCheckpoint);
  const preserveCheckpointTail =
    stepKey === AGENT_RUN_STEP_KEYS.gscDeliverables || resumePayload.phase === "gsc_file";

  const nextCheckpoint = {
    ...existingCheckpoint,
    ...derived,
    ...(preserveCheckpointTail
      ? {}
      : {
          lastStepLabel: label,
          lastStepAt: stepAt,
          lastStepPayload: resumePayload,
          lastMessage: label,
        }),
  };

  patchAgentRunInList(runId, (run) => ({
    result: {
      ...(run.result ?? {}),
      checkpoint: nextCheckpoint,
    },
  }));

  await patchAgentRun(teamId, runId, {
    step: { label, status, stepKey, payload: resumePayload },
    result: {
      ...(existingRun?.result ?? {}),
      checkpoint: nextCheckpoint,
    },
  });
}
