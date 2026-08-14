import type { AssistCardStep } from "@/lib/pulse-assist/types";

export type AgentRunStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export type AgentRunSource = "pulse_assist" | "task_manager";

export type AgentRunRecipeKey = "overview_pages_meta_batch" | "content_optimizer_bulk";

export type AgentRunStep = {
  id: number;
  stepIndex: number;
  label: string;
  status: AssistCardStep["status"];
  payload?: Record<string, unknown>;
  createdAt: string;
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
};

export type AgentRunResult = {
  updated?: number;
  skipped?: number;
  failed?: number;
  batchKey?: string;
  message?: string;
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
};

export function isAgentRunTerminal(status: AgentRunStatus): boolean {
  return status === "done" || status === "failed" || status === "cancelled";
}

export function taskExecutionKindToRecipe(kind: string): AgentRunRecipeKey | null {
  if (kind === "content_optimizer") return "content_optimizer_bulk";
  if (kind === "content_optimizer_meta") return "overview_pages_meta_batch";
  return null;
}

export function taskCanExecuteWithAgent(task: {
  executionKind?: string;
  executionPayload?: { targetUrl?: string };
  assigneeIds?: number[];
}): boolean {
  const recipe = taskExecutionKindToRecipe(task.executionKind ?? "");
  if (!recipe) return false;
  const url = task.executionPayload?.targetUrl?.trim();
  return Boolean(url);
}
