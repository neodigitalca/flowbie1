import type { TaskProject, TaskTag, TaskTemplate, TeamTask } from "@/lib/tasks-types";

export type TasksWorkspaceCache = {
  projects: TaskProject[];
  tags: TaskTag[];
  templates: TaskTemplate[];
  myTasks: TeamTask[];
  completedToday: number;
};

const memory = new Map<number, TasksWorkspaceCache>();

function storageKey(teamId: number): string {
  return `neo-pulse-tasks-cache:${teamId}`;
}

function emptyCache(): TasksWorkspaceCache {
  return { projects: [], tags: [], templates: [], myTasks: [], completedToday: 0 };
}

export function readTasksWorkspaceCache(teamId: number): TasksWorkspaceCache | null {
  const mem = memory.get(teamId);
  if (mem) return mem;
  try {
    const raw = sessionStorage.getItem(storageKey(teamId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TasksWorkspaceCache;
    if (!parsed || !Array.isArray(parsed.myTasks)) return null;
    memory.set(teamId, { ...emptyCache(), ...parsed });
    return memory.get(teamId) ?? null;
  } catch {
    return null;
  }
}

export function writeTasksWorkspaceCache(teamId: number, data: TasksWorkspaceCache): void {
  memory.set(teamId, data);
  try {
    sessionStorage.setItem(storageKey(teamId), JSON.stringify(data));
  } catch {
    /* quota or private mode */
  }
}
