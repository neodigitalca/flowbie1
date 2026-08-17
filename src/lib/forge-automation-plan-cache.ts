import type { TaskExecutionPayload } from "@/lib/tasks-types";

const CACHE_PREFIX = "forge-automation-payload:";

function cacheKey(projectId: number): string {
  return `${CACHE_PREFIX}${projectId}`;
}

export function readCachedExecutionPayload(projectId: number): TaskExecutionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TaskExecutionPayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCachedExecutionPayload(
  projectId: number,
  payload: TaskExecutionPayload | null | undefined,
): void {
  if (typeof window === "undefined" || !payload) return;
  try {
    window.sessionStorage.setItem(cacheKey(projectId), JSON.stringify(payload));
  } catch {
    /* ignore quota errors */
  }
}
