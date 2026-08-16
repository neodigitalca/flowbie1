import { uploadAgentRunArtifact } from "@/lib/agent-runs-api";
import { appendAgentRunStep } from "@/lib/agent-runs/agent-run-step";
import type { AgentRun, AgentRunStepArtifact } from "@/lib/agent-runs-types";

export async function persistAgentRunArtifact(
  teamId: number,
  run: AgentRun,
  input: {
    stepKey: string;
    stepLabel: string;
    name: string;
    mime: string;
    content: string;
    resumePayload?: Record<string, unknown>;
  },
): Promise<AgentRunStepArtifact | null> {
  const upload = await uploadAgentRunArtifact(teamId, run.id, {
    stepKey: input.stepKey,
    name: input.name,
    mime: input.mime,
    content: input.content,
  });
  if (!upload.ok || !upload.artifact) return null;

  const existingArtifacts = Array.isArray(run.steps?.find((s) => s.stepKey === input.stepKey)?.payload?.artifacts)
    ? (run.steps!.find((s) => s.stepKey === input.stepKey)!.payload!.artifacts as AgentRunStepArtifact[])
    : [];

  const artifacts = [
    ...existingArtifacts.filter((a) => a.name !== input.name),
    upload.artifact,
  ];

  await appendAgentRunStep(
    teamId,
    run.id,
    {
      label: input.stepLabel,
      status: "running",
      stepKey: input.stepKey,
      resumePayload: {
        ...(input.resumePayload ?? {}),
        artifacts,
      },
    },
    run,
  );

  return upload.artifact;
}
