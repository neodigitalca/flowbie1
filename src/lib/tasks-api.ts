import { backendApiUrl } from "@/lib/wordpress-api/connection";
import type { TeamContextPulseTask } from "@/lib/pulse-assist/types";
import type {
  TaskNote,
  TaskFile,
  TaskProject,
  TaskSection,
  TaskTag,
  TaskTemplate,
  TeamTask,
  TaskStatus,
  TaskRecurrenceRule,
  TaskExecution,
  TaskExecutionKind,
  TaskExecutionPayload,
  DefaultTaskCreatePayload,
  TaskScheduleMode,
  TaskTriggerConfig,
} from "@/lib/tasks-types";
import type { TaskTriggerEvaluateResult, TaskTriggerPendingDispatch } from "@/lib/task-trigger-types";

export function tasksApi(path: string, options?: RequestInit): Promise<Response> {
  const p = path.startsWith("/") ? path : `/${path}`;
  return fetch(backendApiUrl(p), { ...options, credentials: "include", cache: "no-store" });
}

function api(path: string, options?: RequestInit): Promise<Response> {
  return tasksApi(path, options);
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
    wordpressSiteId?: string | null;
    templateKeyword?: string;
    taskClients?: Array<{ taskKeyword?: string; keyword?: string; clientSiteId?: string }>;
    wordpressSites?: Array<{ id: string; name: string }>;
    defaultTasks?: DefaultTaskCreatePayload[];
    isAutomation?: boolean;
    sourceTemplateKeyword?: string;
    automationVisibility?: "public" | "private";
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
  payload: { keyword?: string; title?: string; description?: string; wordpressSiteId?: string | null; automationVisibility?: "public" | "private" },
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

export async function fetchPulseAssignedTasks(teamId: number): Promise<TeamContextPulseTask[]> {
  const res = await api(`/teams/${teamId}/tasks/pulse-assigned`);
  const data = (await res.json()) as { ok?: boolean; tasks?: TeamContextPulseTask[] };
  return data.tasks ?? [];
}

export async function fetchCalendarAutomationTasks(teamId: number): Promise<TeamContextPulseTask[]> {
  const res = await api(`/teams/${teamId}/tasks/calendar-automations`);
  const data = (await res.json()) as { ok?: boolean; tasks?: TeamContextPulseTask[] };
  return data.tasks ?? [];
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
    dueTime?: string;
    sectionId?: number;
    tagIds?: string[];
    parentTaskId?: number;
    wordpressSiteId?: string | null;
    recurrenceRule?: TaskRecurrenceRule;
    scheduleMode?: TaskScheduleMode;
    triggerConfig?: TaskTriggerConfig;
    executionKind?: TaskExecutionKind;
    executionPayload?: TaskExecutionPayload;
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
    dueTime?: string;
    sectionId?: number;
    sortOrder?: number;
    tagIds?: string[];
    wordpressSiteId?: string | null;
    recurrenceRule?: TaskRecurrenceRule;
    scheduleMode?: TaskScheduleMode;
    triggerConfig?: TaskTriggerConfig;
    executionKind?: TaskExecutionKind;
    executionPayload?: TaskExecutionPayload;
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

export async function uploadTaskFileContent(
  teamId: number,
  taskId: number,
  input: { fileName: string; mime: string; content: string },
): Promise<{ ok: boolean; file?: TaskFile; error?: string }> {
  const bytes = new TextEncoder().encode(input.content);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const res = await api(`/teams/${teamId}/tasks/tasks/${taskId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: input.fileName,
      mime: input.mime || "application/octet-stream",
      dataBase64: btoa(binary),
      source: "execution_archive",
    }),
  });
  const data = (await res.json()) as { ok?: boolean; file?: TaskFile; error?: string };
  return { ok: Boolean(data.ok), file: data.file, error: data.error };
}

export function taskFileDownloadUrl(teamId: number, taskId: number, assetId: number, inline = false): string {
  const base = backendApiUrl(`/teams/${teamId}/tasks/tasks/${taskId}/files/${assetId}`);
  return inline ? `${base}?inline=1` : base;
}

export async function fetchTaskFileText(
  teamId: number,
  taskId: number,
  assetId: number,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const res = await api(`/teams/${teamId}/tasks/tasks/${taskId}/files/${assetId}?inline=1`);
    if (!res.ok) {
      return { ok: false, error: "Could not load archive file." };
    }
    return { ok: true, text: await res.text() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed" };
  }
}

export async function deleteTaskFile(
  teamId: number,
  taskId: number,
  assetId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/tasks/${taskId}/files/${assetId}`, {
    method: "DELETE",
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: Boolean(data.ok), error: data.error };
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

export async function saveTaskTemplate(
  teamId: number,
  template: TaskTemplate,
): Promise<{ ok: boolean; template?: TaskTemplate; templates?: TaskTemplate[]; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/templates/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    template?: TaskTemplate;
    templates?: TaskTemplate[];
    error?: string;
  };
  return { ok: Boolean(data.ok), template: data.template, templates: data.templates, error: data.error };
}

export async function deleteTaskTemplate(
  teamId: number,
  keyword: string,
): Promise<{ ok: boolean; templates?: TaskTemplate[]; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/templates/${encodeURIComponent(keyword)}`, {
    method: "DELETE",
  });
  const data = (await res.json()) as { ok?: boolean; templates?: TaskTemplate[]; error?: string };
  return { ok: Boolean(data.ok), templates: data.templates, error: data.error };
}

export async function saveTemplateFromProject(
  teamId: number,
  payload: { projectId: number; name: string; keyword?: string },
): Promise<{ ok: boolean; template?: TaskTemplate; templates?: TaskTemplate[]; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/templates/from-project`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    template?: TaskTemplate;
    templates?: TaskTemplate[];
    error?: string;
  };
  return { ok: Boolean(data.ok), template: data.template, templates: data.templates, error: data.error };
}

export async function createTaskProjectFromTemplate(
  teamId: number,
  payload: Parameters<typeof createTaskProject>[1],
): Promise<{ ok: boolean; project?: TaskProject; error?: string }> {
  return createTaskProject(teamId, payload);
}

export async function startTaskExecution(
  teamId: number,
  taskId: number,
  payload?: {
    executionKind?: TaskExecutionKind;
    executionPayload?: TaskExecutionPayload;
    wordpressSiteId?: string;
  },
): Promise<{ ok: boolean; execution?: TaskExecution; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/tasks/${taskId}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
  const data = (await res.json()) as { ok?: boolean; execution?: TaskExecution; error?: string };
  return { ok: Boolean(data.ok), execution: data.execution, error: data.error };
}

export async function fetchTaskExecution(
  teamId: number,
  executionId: number,
): Promise<{ ok: boolean; execution?: TaskExecution; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/executions/${executionId}`);
  const data = (await res.json()) as { ok?: boolean; execution?: TaskExecution; error?: string };
  return { ok: Boolean(data.ok), execution: data.execution, error: data.error };
}

export async function listTaskExecutions(
  teamId: number,
  taskId: number,
): Promise<{ ok: boolean; executions?: TaskExecution[]; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/tasks/${taskId}/executions`);
  const data = (await res.json()) as { ok?: boolean; executions?: TaskExecution[]; error?: string };
  return { ok: Boolean(data.ok), executions: data.executions, error: data.error };
}

export async function patchTaskExecutionProgress(
  teamId: number,
  executionId: number,
  patch: {
    stepId?: string;
    subProgress?: number;
    progress?: number;
    message?: string;
    error?: string;
  },
): Promise<{ ok: boolean; execution?: TaskExecution; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/executions/${executionId}/progress`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as { ok?: boolean; execution?: TaskExecution; error?: string };
  return { ok: Boolean(data.ok), execution: data.execution, error: data.error };
}

export type TaskExecutionCompletePayload = {
  ok: boolean;
  result?: unknown;
  error?: string;
  agentRunId?: number;
  archiveFiles?: Array<{ fileName: string; mime: string; dataBase64: string }>;
};

export async function completeTaskExecution(
  teamId: number,
  executionId: number,
  payload: TaskExecutionCompletePayload,
): Promise<{ ok: boolean; execution?: TaskExecution; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/executions/${executionId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok?: boolean; execution?: TaskExecution; error?: string };
  return { ok: Boolean(data.ok), execution: data.execution, error: data.error };
}

export async function cancelTaskExecution(
  teamId: number,
  executionId: number,
): Promise<{ ok: boolean; execution?: TaskExecution; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/executions/${executionId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await res.json()) as { ok?: boolean; execution?: TaskExecution; error?: string };
  return { ok: Boolean(data.ok), execution: data.execution, error: data.error };
}

export async function reopenTaskExecutionForResume(
  teamId: number,
  executionId: number,
): Promise<{ ok: boolean; execution?: TaskExecution; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/executions/${executionId}/reopen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await res.json()) as { ok?: boolean; execution?: TaskExecution; error?: string };
  return { ok: Boolean(data.ok), execution: data.execution, error: data.error };
}

export async function evaluateTaskTrigger(
  teamId: number,
  taskId: number,
  options?: { simulate?: boolean },
): Promise<TaskTriggerEvaluateResult> {
  const res = await api(`/teams/${teamId}/tasks/tasks/${taskId}/trigger/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ simulate: Boolean(options?.simulate) }),
  });
  return (await res.json()) as TaskTriggerEvaluateResult;
}

export async function testFireTaskTrigger(
  teamId: number,
  taskId: number,
): Promise<TaskTriggerEvaluateResult & { queued?: boolean }> {
  const res = await api(`/teams/${teamId}/tasks/tasks/${taskId}/trigger/test-fire`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return (await res.json()) as TaskTriggerEvaluateResult & { queued?: boolean };
}

/** Manual run for a saved automation task; queues Pulse even when trigger conditions are not met. */
export async function executeAutomationTaskTrigger(
  teamId: number,
  taskId: number,
): Promise<TaskTriggerEvaluateResult & { queued?: boolean }> {
  return testFireTaskTrigger(teamId, taskId);
}

export async function fetchPendingTaskTriggers(
  teamId: number,
): Promise<{ ok: boolean; pending?: TaskTriggerPendingDispatch[]; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/trigger-pending`);
  const data = (await res.json()) as {
    ok?: boolean;
    pending?: TaskTriggerPendingDispatch[];
    error?: string;
  };
  return { ok: Boolean(data.ok), pending: data.pending ?? [], error: data.error };
}

export async function ackPendingTaskTrigger(
  teamId: number,
  taskId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await api(`/teams/${teamId}/tasks/trigger-pending/${taskId}/ack`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: Boolean(data.ok), error: data.error };
}
