import type { AgentRun } from "@/lib/agent-runs-types";
import type { PostCreatorExecutionPayload } from "@/lib/tasks-types";

export const POST_CREATOR_MAX_POST_COUNT = 31;

export const POST_CREATOR_INVENTORY_BUCKET_LIMIT = 100;

export function clampPostCreatorPostCount(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("postCount is required.");
  }
  return Math.min(POST_CREATOR_MAX_POST_COUNT, n);
}

export function resolvePostCreatorPostCount(
  payload?: PostCreatorExecutionPayload | { postCount?: number } | null,
  run?: AgentRun | null,
): number {
  const fromPayload = payload?.postCount;
  if (fromPayload != null && Number(fromPayload) >= 1) {
    return clampPostCreatorPostCount(fromPayload);
  }

  if (run) {
    const fromResult = run.result?.postCount;
    if (typeof fromResult === "number" && fromResult >= 1) {
      return clampPostCreatorPostCount(fromResult);
    }

    const contract = run.plan?.clientRunContract as { postCount?: number } | undefined;
    if (contract?.postCount != null && Number(contract.postCount) >= 1) {
      return clampPostCreatorPostCount(contract.postCount);
    }

    const executionPayload = run.plan?.executionPayload as { postCount?: number } | undefined;
    if (executionPayload?.postCount != null && Number(executionPayload.postCount) >= 1) {
      return clampPostCreatorPostCount(executionPayload.postCount);
    }

    const fromPlan = Number(run.plan?.postCount ?? 0);
    if (fromPlan >= 1) {
      return clampPostCreatorPostCount(fromPlan);
    }

    const titleMatch = run.title?.match(/Create\s+(\d+)\s+scheduled/i);
    if (titleMatch) {
      return clampPostCreatorPostCount(titleMatch[1]);
    }
  }

  throw new Error("postCount is required.");
}
