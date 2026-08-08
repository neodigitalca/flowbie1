export type TaskStatus = "todo" | "in_progress" | "done";

export type TaskPayloadKind = "project" | "task" | "note" | "file" | "template" | "section" | "tag";

export type TasksViewMode = "list" | "board" | "calendar" | "files";

export type TasksNavMode = "my" | "project";

export type TasksFilterMode = "incomplete" | "all" | "completed";

export type TasksSortMode = "dueDate" | "created" | "title";

export type TaskTemplateTaskDef = {
  keyword: string;
  title: string;
  status?: TaskStatus;
};

export type TaskTemplate = {
  keyword: string;
  kind: "template";
  name: string;
  defaultTasks: TaskTemplateTaskDef[];
};

export type TaskTag = {
  keyword: string;
  kind: "tag";
  name: string;
  color: string;
};

export type TaskSection = {
  id: number;
  teamId: number;
  projectId: number;
  sortOrder: number;
  createdAt: string;
  payload: Record<string, unknown>;
  keyword: string;
  title: string;
};

export type TaskProject = {
  id: number;
  teamId: number;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  payload: Record<string, unknown>;
  keyword: string;
  title: string;
  description: string;
};

export type TeamTask = {
  id: number;
  teamId: number;
  projectId: number;
  sectionId: number;
  parentTaskId: number;
  status: TaskStatus;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  payload: Record<string, unknown>;
  keyword: string;
  title: string;
  description: string;
  dueDate: string;
  assigneeIds: number[];
  tagIds: string[];
  projectTitle: string;
};

export type TaskNote = {
  id: number;
  teamId: number;
  taskId: number;
  createdAt: string;
  payload: Record<string, unknown>;
  body: string;
  authorId: number;
  keyword: string;
  mentionUserIds: number[];
};

export type TaskFile = {
  id: number;
  teamId: number;
  taskId: number;
  storagePath: string;
  createdAt: string;
  payload: Record<string, unknown>;
  fileName: string;
  mime: string;
  uploadedBy: number;
  keyword: string;
  taskTitle?: string;
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];
