import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import type {
  TaskNote,
  TaskFile,
  TaskProject,
  TaskSection,
  TaskTag,
  TaskTemplate,
  TeamTask,
  TaskStatus,
} from "@/lib/tasks-types";

function baseUrl(): string {
  return (import.meta.env.VITE_MCP_API_BASE?.replace(/\/api\/mcp\/?$/, "") || BACKEND_API_BASE || "").replace(
    /\/$/,
    "",
  );
}

function api(path: string, options?: RequestInit): Promise<Response> {
  const p = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${baseUrl()}/api${p}`, { ...options, credentials: "include" });
}

export async function fetchTaskProjects(
  teamId: number,
  includeArchived = false,
): Promise<TaskProject[]> {
  const q = includeArchived ? "?archived=1" : "";
  const res = await api(`/teams/${teamId}/tasks/projects${q}`);
  const data = (await res.json()) as { ok?: boolean; projects?: TaskProject[] };
  return data.projects ?? [];
}

export async function createTaskProject(
  teamId: number,
  payload: {
    keyword?: string;
    title: string;
    description?: string;
    defaultTasks?: Array<{ keyword?: string; title: string; status?: TaskStatus }>;
  },
): Promise<{ ok: boolean; project?: TaskProject; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok?: boolean; project?: TaskProject; error?: string };
  return { ok: Boolean(data.ok), project: data.project, error: data.error };
}

export async function updateTaskProject(
  teamId: number,
  projectId: number,
  payload: { keyword?: string; title?: string; description?: string },
): Promise<{ ok: boolean; project?: TaskProject; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok?: boolean; project?: TaskProject; error?: string };
  return { ok: Boolean(data.ok), project: data.project, error: data.error };
}

export async function deleteTaskProject(
  teamId: number,
  projectId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/projects/${projectId}`, { method: "DELETE" });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: Boolean(data.ok), error: data.error };
}

export async function fetchProjectSections(teamId: number, projectId: number): Promise<TaskSection[]> {
  const res = await api(`/teams/${teamId}/tasks/projects/${projectId}/sections`);
  const data = (await res.json()) as { ok?: boolean; sections?: TaskSection[] };
  return data.sections ?? [];
}

export async function createProjectSection(
  teamId: number,
  projectId: number,
  payload: { keyword?: string; title: string; sortOrder?: number },
): Promise<{ ok: boolean; section?: TaskSection; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/projects/${projectId}/sections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok?: boolean; section?: TaskSection; error?: string };
  return { ok: Boolean(data.ok), section: data.section, error: data.error };
}

export async function updateProjectSection(
  teamId: number,
  projectId: number,
  sectionId: number,
  payload: { keyword?: string; title?: string; sortOrder?: number },
): Promise<{ ok: boolean; section?: TaskSection; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/projects/${projectId}/sections/${sectionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok?: boolean; section?: TaskSection; error?: string };
  return { ok: Boolean(data.ok), section: data.section, error: data.error };
}

export async function deleteProjectSection(
  teamId: number,
  projectId: number,
  sectionId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/projects/${projectId}/sections/${sectionId}`, {
    method: "DELETE",
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: Boolean(data.ok), error: data.error };
}

export async function fetchProjectTasks(teamId: number, projectId: number): Promise<TeamTask[]> {
  const res = await api(`/teams/${teamId}/tasks/projects/${projectId}/tasks`);
  const data = (await res.json()) as { ok?: boolean; tasks?: TeamTask[] };
  return data.tasks ?? [];
}

export async function fetchMyTasks(
  teamId: number,
): Promise<{ tasks: TeamTask[]; completedToday: number }> {
  const res = await api(`/teams/${teamId}/tasks/my`);
  const data = (await res.json()) as { ok?: boolean; tasks?: TeamTask[]; completedToday?: number };
  return { tasks: data.tasks ?? [], completedToday: data.completedToday ?? 0 };
}

export async function searchTasks(teamId: number, query: string): Promise<TeamTask[]> {
  const params = new URLSearchParams({ q: query });
  const res = await api(`/teams/${teamId}/tasks/search?${params.toString()}`);
  const data = (await res.json()) as { ok?: boolean; tasks?: TeamTask[] };
  return data.tasks ?? [];
}

export async function fetchTaskTags(teamId: number): Promise<TaskTag[]> {
  const res = await api(`/teams/${teamId}/tasks/tags`);
  const data = (await res.json()) as { ok?: boolean; tags?: TaskTag[] };
  return data.tags ?? [];
}

export async function createProjectTask(
  teamId: number,
  projectId: number,
  payload: {
    keyword?: string;
    title: string;
    description?: string;
    status?: TaskStatus;
    assigneeIds?: number[];
    dueDate?: string;
    sectionId?: number;
    tagIds?: string[];
    parentTaskId?: number;
  },
): Promise<{ ok: boolean; task?: TeamTask; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/projects/${projectId}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok?: boolean; task?: TeamTask; error?: string };
  return { ok: Boolean(data.ok), task: data.task, error: data.error };
}

export async function fetchTaskDetail(
  teamId: number,
  taskId: number,
): Promise<{ task: TeamTask | null; notes: TaskNote[]; files: TaskFile[]; subtasks: TeamTask[] }> {
  const res = await api(`/teams/${teamId}/tasks/tasks/${taskId}`);
  const data = (await res.json()) as {
    ok?: boolean;
    task?: TeamTask;
    notes?: TaskNote[];
    files?: TaskFile[];
    subtasks?: TeamTask[];
  };
  return {
    task: data.task ?? null,
    notes: data.notes ?? [],
    files: data.files ?? [],
    subtasks: data.subtasks ?? [],
  };
}

export async function updateTask(
  teamId: number,
  taskId: number,
  payload: {
    keyword?: string;
    title?: string;
    description?: string;
    status?: TaskStatus;
    assigneeIds?: number[];
    dueDate?: string;
    sectionId?: number;
    sortOrder?: number;
    tagIds?: string[];
  },
): Promise<{ ok: boolean; task?: TeamTask; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok?: boolean; task?: TeamTask; error?: string };
  return { ok: Boolean(data.ok), task: data.task, error: data.error };
}

export async function deleteTask(teamId: number, taskId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/tasks/${taskId}`, { method: "DELETE" });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: Boolean(data.ok), error: data.error };
}

export async function addTaskNote(
  teamId: number,
  taskId: number,
  body: string,
  mentionUserIds: number[] = [],
  keyword = "note",
): Promise<{ ok: boolean; note?: TaskNote; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/tasks/${taskId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, keyword, mentionUserIds }),
  });
  const data = (await res.json()) as { ok?: boolean; note?: TaskNote; error?: string };
  return { ok: Boolean(data.ok), note: data.note, error: data.error };
}

export async function createSubtask(
  teamId: number,
  taskId: number,
  payload: { keyword?: string; title: string; status?: TaskStatus },
): Promise<{ ok: boolean; task?: TeamTask; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/tasks/${taskId}/subtasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok?: boolean; task?: TeamTask; error?: string };
  return { ok: Boolean(data.ok), task: data.task, error: data.error };
}

export async function uploadTaskFile(
  teamId: number,
  taskId: number,
  file: File,
): Promise<{ ok: boolean; file?: TaskFile; error?: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const dataBase64 = btoa(binary);
  const res = await api(`/teams/${teamId}/tasks/tasks/${taskId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mime: file.type || "application/octet-stream",
      dataBase64,
    }),
  });
  const data = (await res.json()) as { ok?: boolean; file?: TaskFile; error?: string };
  return { ok: Boolean(data.ok), file: data.file, error: data.error };
}

export function taskFileDownloadUrl(teamId: number, taskId: number, assetId: number, inline = false): string {
  const base = `${baseUrl()}/api/teams/${teamId}/tasks/tasks/${taskId}/files/${assetId}`;
  return inline ? `${base}?inline=1` : base;
}

export async function fetchProjectFiles(teamId: number, projectId: number): Promise<TaskFile[]> {
  const res = await api(`/teams/${teamId}/tasks/projects/${projectId}/files`);
  const data = (await res.json()) as { ok?: boolean; files?: TaskFile[] };
  return data.files ?? [];
}

export async function fetchTaskTemplates(teamId: number): Promise<TaskTemplate[]> {
  const res = await api(`/teams/${teamId}/tasks/templates`);
  const data = (await res.json()) as { ok?: boolean; templates?: TaskTemplate[] };
  return data.templates ?? [];
}

export async function createTaskProjectFromTemplate(
  teamId: number,
  payload: Parameters<typeof createTaskProject>[1],
): Promise<{ ok: boolean; project?: TaskProject; error?: string }> {
  return createTaskProject(teamId, payload);
}
