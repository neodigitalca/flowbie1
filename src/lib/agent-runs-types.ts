import type { AssistCardStep } from "@/lib/pulse-assist/types";
import {
  taskExecutionLocalDominatorIsConfigured,
  taskExecutionPostCreatorIsConfigured,
  taskExecutionReportingIsConfigured,
  taskExecutionTargetIsConfigured,
} from "@/lib/task-execution-bucket";

export type AgentRunStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export type AgentRunSource = "pulse_assist" | "task_manager" | "workflow";

export type AgentRunRecipeKey =
  | "overview_pages_meta_batch"
  | "content_optimizer_bulk"
  | "gsc_reporting"
  | "post_creator"
  | "local_dominator_export";

export type AgentRunStepArtifact = {
  id: string;
  name: string;
  url: string;
  mime?: string;
};

export type AgentRunStep = {
  id: number;
  stepIndex: number;
  stepKey?: string;
  label: string;
  status: AssistCardStep["status"];
  payload?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
};

export type AgentRunContext = {
  siteId?: string;
  managerTab?: string;
  sitemapSource?: string;
  message?: string;
  taskKeyword?: string;
  taskTitle?: string;
  projectId?: number;
};

export type AgentRunPlan = Record<string, unknown> & {
  taskExecutionId?: number;
  clientRunContract?: import("@/lib/tasks-types").TaskExecutionClientRunContract;
  sitemapSource?: string;
  executionMode?: "client" | "server";
};

export type AgentRunCheckpointUrlSummary = {
  url: string;
  postTitle?: string;
};

export type AgentRunCheckpoint = {
  completedUrls: string[];
  uploadedUrls: string[];
  currentUrl?: string;
  currentIndex?: number;
  totalCount?: number;
  currentUrlProgress?: number;
  lastMessage?: string;
  completedUrlSummaries?: AgentRunCheckpointUrlSummary[];
  lastStepLabel?: string;
  lastStepAt?: string;
  lastStepPayload?: Record<string, unknown>;
};

export type AgentRunResumePoint = {
  label: string;
  status: AgentRunStep["status"];
  createdAt: string;
  payload: Record<string, unknown>;
  stepIndex: number;
};

export type AgentRunUploadedPost = {
  url: string;
  postId?: number;
  title?: string;
  scheduledFor?: string;
};

export type AgentRunBlockedRow = {
  keyword: string;
  reason: string;
  conflictingUrl?: string;
};

export type AgentRunResult = {
  updated?: number;
  skipped?: number;
  failed?: number;
  batchKey?: string;
  message?: string;
  checkpoint?: AgentRunCheckpoint;
  uploadedPosts?: AgentRunUploadedPost[];
  blockedRows?: AgentRunBlockedRow[];
  postCount?: number;
  executionMode?: "client" | "server";
};

export type AgentRun = {
  id: number;
  teamId: number;
  createdBy: number;
  title: string;
  recipeKey: AgentRunRecipeKey | string;
  recipeTitle: string;
  status: AgentRunStatus;
  source: AgentRunSource;
  taskId: number;
  taskTitle: string;
  context: AgentRunContext;
  plan: AgentRunPlan;
  result: AgentRunResult | null;
  errorMessage: string;
  clientBatchKey: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps?: AgentRunStep[];
};

export type StartAgentRunPayload = {
  teamId: number;
  source: AgentRunSource;
  recipeKey: AgentRunRecipeKey | string;
  title?: string;
  taskId?: number | null;
  context?: AgentRunContext;
  plan?: AgentRunPlan;
};

export const AGENT_RUN_STATUS_LABELS: Record<AgentRunStatus, string> = {
  queued: "Queued",
  running: "Running",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const AGENT_RUN_SOURCE_LABELS: Record<AgentRunSource, string> = {
  pulse_assist: "Pulse Assist",
  task_manager: "Task",
  workflow: "Workflow",
};

export function isAgentRunTerminal(status: AgentRunStatus): boolean {
  return status === "done" || status === "failed" || status === "cancelled";
}

export function taskExecutionKindToRecipe(kind: string): AgentRunRecipeKey | null {
  if (kind === "content_optimizer") return "content_optimizer_bulk";
  if (kind === "content_optimizer_meta") return "overview_pages_meta_batch";
  if (kind === "gsc_reporting") return "gsc_reporting";
  if (kind === "post_creator") return "post_creator";
  if (kind === "local_dominator_export") return "local_dominator_export";
  return null;
}

function taskExecutionIsConfigured(
  kind: string,
  payload?: {
    targetUrl?: string;
    targetBucket?: string;
    targetUrls?: string[];
    comparePreset?: string;
    businessName?: string;
    keyword?: string;
    postCount?: number;
  },
): boolean {
  if (kind === "gsc_reporting") return taskExecutionReportingIsConfigured(payload);
  if (kind === "local_dominator_export") return taskExecutionLocalDominatorIsConfigured(payload);
  if (kind === "post_creator") return taskExecutionPostCreatorIsConfigured(payload);
  return taskExecutionTargetIsConfigured(payload);
}

export function taskCanExecuteWithAgent(
  task: {
    executionKind?: string;
    executionPayload?: { targetUrl?: string; targetBucket?: string };
    assigneeIds?: number[];
    wordpressSiteId?: string;
  },
  members: Array<{ userId: number; email?: string; isBot?: boolean; displayName?: string }> = [],
  activeWordPressSiteId?: string | null,
): boolean {
  const kind = (task.executionKind ?? "").trim() || "content_optimizer";
  const recipe = taskExecutionKindToRecipe(kind);
  if (!recipe) return false;
  if (members.length > 0) {
    const pulseAssigned = task.assigneeIds?.some((userId) => {
      const member = members.find((m) => m.userId === userId);
      return (
        member &&
        (Boolean(member.isBot) ||
          member.displayName === "NEO Pulse" ||
          member.displayName === "FLO" ||
          member.email === "pulse@neodigital.ca")
      );
    });
    if (!pulseAssigned) return false;
  }
  if (!resolveTaskExecuteSiteId(task, activeWordPressSiteId)) return false;
  return taskExecutionIsConfigured(kind, task.executionPayload);
}

/** Scheduled Pulse runs: site + bucket only (assignee already filtered). */
export function scheduledPulseTaskCanExecute(
  task: {
    executionKind?: string;
    executionPayload?: { targetUrl?: string; targetBucket?: string };
    wordpressSiteId?: string;
  },
  activeWordPressSiteId?: string | null,
): boolean {
  const kind = (task.executionKind ?? "").trim() || "content_optimizer";
  if (!taskExecutionKindToRecipe(kind)) return false;
  if (!resolveTaskExecuteSiteId(task, activeWordPressSiteId)) return false;
  return taskExecutionIsConfigured(kind, task.executionPayload);
}

export function resolveTaskExecuteSiteId(
  task: { wordpressSiteId?: string | null },
  activeWordPressSiteId?: string | null,
): string {
  return task.wordpressSiteId?.trim() || activeWordPressSiteId?.trim() || "";
}
