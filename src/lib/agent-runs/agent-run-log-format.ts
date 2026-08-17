import type { AgentRunArtifactRecord } from "@/lib/agent-runs-api";
import { formatAgentRunTimeOnly, formatAgentRunTimestamp } from "@/lib/edmonton-time";
import type { AgentRun, AgentRunStep, AgentRunStepArtifact, AgentRunUploadedPost } from "@/lib/agent-runs-types";
import { AGENT_RUN_STATUS_LABELS } from "@/lib/agent-runs-types";
import { agentRunSourceLine } from "@/lib/agent-runs/agent-run-display";
import { dedupeAgentRunLogLines } from "@/lib/agent-runs/agent-run-log-download";

export type AgentRunLogTimelineRow = {
  key: string;
  timeLabel: string;
  label: string;
  status: AgentRunStep["status"];
  isActive?: boolean;
  artifacts?: AgentRunStepArtifact[];
};

function isResumeNoiseLabel(label: string): boolean {
  const trimmed = label.trim();
  return trimmed.startsWith("Resuming:") || trimmed === "Queued for resume";
}

export function normalizeAgentRunStepsForDisplay(steps: AgentRunStep[]): AgentRunStep[] {
  const filtered = steps.filter((step) => {
    const label = step.label.trim();
    return label && !isResumeNoiseLabel(label);
  });

  const keyed = filtered.filter((s) => s.stepKey?.trim());
  if (keyed.length > 0) {
    const byKey = new Map<string, AgentRunStep>();
    const legacy: AgentRunStep[] = [];
    for (const step of filtered) {
      const key = step.stepKey?.trim();
      if (key) {
        byKey.set(key, step);
      } else {
        legacy.push(step);
      }
    }
    const keyedSteps = Array.from(byKey.values()).sort((a, b) => a.stepIndex - b.stepIndex);
    const keyedLabels = new Set(keyedSteps.map((s) => s.label.trim()));
    const extraLegacy = legacy.filter((s) => !keyedLabels.has(s.label.trim()));
    return [...keyedSteps, ...extraLegacy].sort((a, b) => a.stepIndex - b.stepIndex);
  }

  const collapsed: AgentRunStep[] = [];
  for (const step of filtered) {
    const label = step.label.trim();
    const prev = collapsed[collapsed.length - 1];
    if (prev?.label.trim() === label) {
      collapsed[collapsed.length - 1] = step;
      continue;
    }
    collapsed.push(step);
  }

  const seen = new Set<string>();
  const deduped: AgentRunStep[] = [];
  for (const step of collapsed) {
    const label = step.label.trim();
    if (seen.has(label)) continue;
    seen.add(label);
    deduped.push(step);
  }
  return deduped;
}

function stepArtifacts(step: AgentRunStep): AgentRunStepArtifact[] {
  const raw = step.payload?.artifacts;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is AgentRunStepArtifact =>
      Boolean(item && typeof item === "object" && typeof (item as AgentRunStepArtifact).url === "string"),
  );
}

function parseUploadStepRowIndex(stepKey: string): number | null {
  const match = /^post(\d+)upload$/.exec(stepKey.trim());
  if (!match) return null;
  const rowIndex = Number(match[1]);
  return Number.isFinite(rowIndex) ? rowIndex : null;
}

function artifactRecordToStepArtifact(record: AgentRunArtifactRecord): AgentRunStepArtifact {
  return {
    id: record.id ?? record.stepKey ?? record.name,
    name: record.name,
    url: record.url ?? "",
    mime: record.mime,
  };
}

function mergeStepArtifacts(
  existing: AgentRunStepArtifact[],
  incoming: AgentRunStepArtifact[],
): AgentRunStepArtifact[] {
  const byKey = new Map<string, AgentRunStepArtifact>();
  for (const artifact of [...existing, ...incoming]) {
    if (!artifact.url) continue;
    byKey.set(`${artifact.name}:${artifact.url}`, artifact);
  }
  return Array.from(byKey.values());
}

export function enrichAgentRunStepsWithServerData(
  run: AgentRun,
  steps: AgentRunStep[],
  serverArtifacts: readonly AgentRunArtifactRecord[],
): AgentRunStep[] {
  const artifactByStepKey = new Map<string, AgentRunArtifactRecord>();
  for (const artifact of serverArtifacts) {
    const key = artifact.stepKey?.trim();
    if (key) artifactByStepKey.set(key, artifact);
  }

  const uploadedPosts: AgentRunUploadedPost[] = run.result?.uploadedPosts ?? [];

  return steps.map((step) => {
    const stepKey = step.stepKey?.trim() ?? "";
    let artifacts = stepArtifacts(step);

    const serverArtifact =
      artifactByStepKey.get(stepKey) ??
      artifactByStepKey.get(stepKey.replace(/-/g, ""));
    if (serverArtifact?.url) {
      artifacts = mergeStepArtifacts(artifacts, [artifactRecordToStepArtifact(serverArtifact)]);
    }

    if (artifacts.length === 0 && (stepKey === "contentbucket" || stepKey === "content-bucket")) {
      for (const artifact of serverArtifacts) {
        if (/^content-bucket-/i.test(artifact.name ?? "")) {
          artifacts = mergeStepArtifacts(artifacts, [artifactRecordToStepArtifact(artifact)]);
          break;
        }
      }
    }

    const uploadRowIndex = parseUploadStepRowIndex(stepKey);
    if (uploadRowIndex != null) {
      const post = uploadedPosts[uploadRowIndex];
      if (post?.url) {
        artifacts = mergeStepArtifacts(artifacts, [
          {
            id: `post-${uploadRowIndex}`,
            name: "View post",
            url: post.url,
          },
        ]);
      }
    }

    if (artifacts.length === 0) return step;
    return {
      ...step,
      payload: {
        ...(step.payload ?? {}),
        artifacts,
      },
    };
  });
}

function sanitizeCheckpointForExport(
  checkpoint: AgentRun["result"] extends infer R ? (R extends { checkpoint?: infer C } ? C : null) : null,
) {
  if (!checkpoint || typeof checkpoint !== "object") return checkpoint;
  const record = checkpoint as Record<string, unknown>;
  const server = record.server;
  if (!server || typeof server !== "object") return checkpoint;
  const serverRecord = { ...(server as Record<string, unknown>) };
  delete serverRecord.generatedContent;
  return { ...record, server: serverRecord };
}

export function formatAgentRunLogTimeline(
  run: AgentRun,
  steps: AgentRunStep[],
  activeLabel?: string | null,
): AgentRunLogTimelineRow[] {
  const normalized = normalizeAgentRunStepsForDisplay(steps);
  return normalized.map((step, index) => ({
    key: step.stepKey || `${step.id}-${index}`,
    timeLabel: formatAgentRunTimeOnly(step.updatedAt ?? step.createdAt) || "—",
    label: step.label.trim(),
    status: step.status,
    artifacts: stepArtifacts(step),
    isActive: Boolean(activeLabel && step.label.trim() === activeLabel.trim() && run.status === "running"),
  }));
}

export type AgentRunLogJsonExport = {
  run: {
    id: number;
    title: string;
    recipeKey: string;
    recipeTitle: string;
    status: AgentRun["status"];
    source: AgentRun["source"];
    startedAt: string | null;
    finishedAt: string | null;
    errorMessage: string;
    result: AgentRun["result"];
  };
  plan?: {
    clientRunContract?: {
      sendAutomationEmail?: boolean;
      automationEmailTo?: string;
    };
  };
  emailOutcome?: {
    emailSent?: boolean;
    emailError?: string;
    emailSkipped?: boolean;
    emailSkipReason?: string;
    transport?: string;
  };
  checkpoint: AgentRun["result"] extends infer R ? (R extends { checkpoint?: infer C } ? C : null) : null;
  uploadedPosts: AgentRunUploadedPost[];
  steps: Array<{
    stepKey?: string;
    label: string;
    status: AgentRunStep["status"];
    createdAt: string;
    updatedAt?: string;
    payload?: Record<string, unknown>;
    artifacts?: AgentRunStepArtifact[];
    postUrl?: string;
  }>;
};

function exportEmailContractFromPlan(
  plan: AgentRun["plan"] | undefined,
): AgentRunLogJsonExport["plan"] | undefined {
  const contract = plan?.clientRunContract;
  if (!contract) return undefined;
  return {
    clientRunContract: {
      sendAutomationEmail: contract.sendAutomationEmail,
      automationEmailTo: contract.automationEmailTo,
    },
  };
}

function exportEmailOutcomeFromResult(
  result: AgentRun["result"],
): AgentRunLogJsonExport["emailOutcome"] | undefined {
  if (!result || typeof result !== "object") return undefined;
  const r = result as Record<string, unknown>;
  const outcome: NonNullable<AgentRunLogJsonExport["emailOutcome"]> = {};
  if (typeof r.emailSent === "boolean") outcome.emailSent = r.emailSent;
  if (typeof r.emailError === "string") outcome.emailError = r.emailError;
  if (typeof r.emailSkipped === "boolean") outcome.emailSkipped = r.emailSkipped;
  if (typeof r.emailSkipReason === "string") outcome.emailSkipReason = r.emailSkipReason;
  if (typeof r.transport === "string") outcome.transport = r.transport;
  return Object.keys(outcome).length > 0 ? outcome : undefined;
}

export function formatAgentRunLogJson(run: AgentRun, steps: AgentRunStep[]): AgentRunLogJsonExport {
  const normalized = normalizeAgentRunStepsForDisplay(steps);
  const sanitizedResult = run.result
    ? {
        ...run.result,
        checkpoint: sanitizeCheckpointForExport(run.result.checkpoint ?? null),
      }
    : run.result;
  return {
    run: {
      id: run.id,
      title: run.title,
      recipeKey: run.recipeKey,
      recipeTitle: run.recipeTitle,
      status: run.status,
      source: run.source,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      errorMessage: run.errorMessage,
      result: sanitizedResult,
    },
    plan: exportEmailContractFromPlan(run.plan),
    emailOutcome: exportEmailOutcomeFromResult(run.result),
    checkpoint: sanitizeCheckpointForExport(run.result?.checkpoint ?? null),
    uploadedPosts: run.result?.uploadedPosts ?? [],
    steps: normalized.map((step) => ({
      stepKey: step.stepKey,
      label: step.label.trim(),
      status: step.status,
      createdAt: step.createdAt,
      updatedAt: step.updatedAt,
      payload: step.payload,
      artifacts: stepArtifacts(step),
      postUrl: typeof step.payload?.postUrl === "string" ? step.payload.postUrl : undefined,
    })),
  };
}

/** @deprecated Use formatAgentRunLogJson for downloads. */
export function formatAgentRunLogMarkdown(run: AgentRun, steps: AgentRunStep[]): string {
  const lines: string[] = [];
  lines.push(`# ${run.title}`);
  lines.push(`Run #${run.id} · ${run.recipeTitle} · Status: ${AGENT_RUN_STATUS_LABELS[run.status]}`);
  lines.push(agentRunSourceLine(run));
  lines.push("");

  if (run.startedAt) {
    lines.push(`Started: ${formatAgentRunTimestamp(run.startedAt)}`);
  }
  const normalized = normalizeAgentRunStepsForDisplay(steps);
  const lastStep = normalized[normalized.length - 1];
  if (lastStep?.createdAt) {
    lines.push(`Last step: ${formatAgentRunTimestamp(lastStep.updatedAt ?? lastStep.createdAt)}`);
  }
  if (run.finishedAt) {
    lines.push(`Finished: ${formatAgentRunTimestamp(run.finishedAt)}`);
  }
  lines.push("");

  if (normalized.length > 0) {
    lines.push("## Progress");
    const labels = dedupeAgentRunLogLines(normalized.map((s) => s.label.trim()));
    for (const label of labels) {
      const step = normalized.find((s) => s.label.trim() === label);
      const time = step ? formatAgentRunTimeOnly(step.updatedAt ?? step.createdAt) || "—" : "—";
      lines.push(`- ${time}  ${label}`);
    }
    lines.push("");
  }

  const uploaded = run.result?.uploadedPosts ?? [];
  if (uploaded.length > 0) {
    lines.push("## Uploaded posts");
    for (const post of uploaded) {
      const parts = [post.url];
      if (post.postId != null) parts.push(`ID ${post.postId}`);
      if (post.scheduledFor) parts.push(`scheduled ${post.scheduledFor}`);
      lines.push(`- ${parts.join(", ")}`);
    }
    lines.push("");
  }

  const blocked = run.result?.blockedRows ?? [];
  if (blocked.length > 0) {
    lines.push("## Blocked (cannibalization)");
    for (const row of blocked) {
      const conflict = row.conflictingUrl ? ` — ${row.conflictingUrl}` : "";
      lines.push(`- ${row.keyword}: ${row.reason}${conflict}`);
    }
    lines.push("");
  }

  if (run.errorMessage?.trim()) {
    lines.push("## Error");
    lines.push(run.errorMessage.trim());
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}
