import type { TaskScheduleMode, TaskTriggerConfig, TaskTriggerMeta } from "@/lib/task-trigger-types";

export type { TaskScheduleMode, TaskTriggerConfig, TaskTriggerMeta };

export type TaskRecurrenceRule = "none" | "daily" | "weekly" | "monthly" | "yearly";

export const TASK_RECURRENCE_LABELS: Record<TaskRecurrenceRule, string> = {
  none: "None",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export const TASK_RECURRENCE_RULES: TaskRecurrenceRule[] = ["none", "daily", "weekly", "monthly", "yearly"];

export type TaskScheduleMeta = {
  lastRunKey?: string;
  lastRunAt?: string;
};

export type TaskStatus = "todo" | "in_progress" | "done";

export type TaskExecutionKind =
  | "content_optimizer"
  | "content_optimizer_meta"
  | "gsc_reporting"
  | "post_creator"
  | "";

export type GscReportingComparePreset = "mom" | "yoy";

export type PostCreatorKeywordSource = "prompt" | "gsc" | "manual";

export type PostCreatorEntityMode = "auto" | "manual" | "blank";

export type PostCreatorSitemapType = "post" | "entity";

export type PostCreatorPostDestination = "wordpress" | "bank" | "draft";

export type PostCreatorExecutionPayload = {
  postCount?: number;
  keywordSource?: PostCreatorKeywordSource;
  optionalPrompt?: string;
  entityMode?: PostCreatorEntityMode;
  entityValue?: string;
  keywordValue?: string;
  titleTemplate?: string;
  featuredImage?: boolean;
  sitemapType?: PostCreatorSitemapType;
  postDestination?: PostCreatorPostDestination;
  scheduleTimesPerMonth?: number;
  scheduleStartDay?: number;
  scheduleStartTime?: string;
  scheduleStaggerOptimized?: boolean;
};

export type TaskExecutionTargetBucket = "pages" | "posts" | "sap" | "all";

export type TaskExecutionPayload = {
  targetUrl?: string;
  targetBucket?: TaskExecutionTargetBucket;
  /** Set by trigger evaluator; only these URLs are optimized in trigger mode. */
  targetUrls?: string[];
  postId?: number | null;
  updateMode?: "update" | "draft";
  comparePreset?: GscReportingComparePreset;
  saveToDisk?: boolean;
  postCount?: number;
  keywordSource?: PostCreatorKeywordSource;
  optionalPrompt?: string;
  entityMode?: PostCreatorEntityMode;
  entityValue?: string;
  keywordValue?: string;
  titleTemplate?: string;
  featuredImage?: boolean;
  sitemapType?: PostCreatorSitemapType;
  postDestination?: PostCreatorPostDestination;
  scheduleTimesPerMonth?: number;
  scheduleStartDay?: number;
  scheduleStartTime?: string;
  scheduleStaggerOptimized?: boolean;
  optimizationOptions?: {
    optimizeTitle?: boolean;
    optimizeMeta?: boolean;
    optimizeExcerpt?: boolean;
    optimizeContent?: boolean;
    optimizeFeaturedImage?: boolean;
    useAcfKeyword?: boolean;
    manualKeyword?: string;
    testMode?: boolean;
    autoOptimize?: boolean;
  };
};

export type TaskExecutionStatus =
  | "queued"
  | "preflight"
  | "awaiting_client"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskExecutionProgress = {
  status?: string;
  stepId?: string;
  subProgress?: number;
  progress?: number;
  message?: string;
  microLog?: Array<{ stepId: string; message?: string }>;
  error?: string;
  startTime?: number;
  lastUpdate?: number;
  endTime?: number;
};

export type TaskExecutionClientRunContract = {
  executionId: number;
  siteId: string;
  url?: string;
  scope?: "single" | "all";
  targetBucket?: TaskExecutionTargetBucket;
  targetUrls?: string[];
  updateMode?: "update" | "draft";
  optimizationOptions?: NonNullable<TaskExecutionPayload["optimizationOptions"]>;
  comparePreset?: GscReportingComparePreset;
  saveToDisk?: boolean;
  postCount?: number;
  keywordSource?: PostCreatorKeywordSource;
  optionalPrompt?: string;
  entityMode?: PostCreatorEntityMode;
  entityValue?: string;
  keywordValue?: string;
  titleTemplate?: string;
  featuredImage?: boolean;
  sitemapType?: PostCreatorSitemapType;
  postDestination?: PostCreatorPostDestination;
  scheduleTimesPerMonth?: number;
  scheduleStartDay?: number;
  scheduleStartTime?: string;
  scheduleStaggerOptimized?: boolean;
  resolvedPost?: {
    id: number;
    subtype: string;
    link?: string;
    slug?: string;
    endpoint?: string;
  } | null;
};

export type TaskExecution = {
  id: number;
  teamId: number;
  taskId: number;
  executionKind: TaskExecutionKind;
  status: TaskExecutionStatus;
  startedBy: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  clientRunContract?: TaskExecutionClientRunContract | null;
  executionMode?: "client" | "server" | null;
  result?: unknown;
  error?: string;
  progress?: TaskExecutionProgress | null;
};

export type TaskPayloadKind = "project" | "task" | "note" | "file" | "template" | "section" | "tag";

export type TasksViewMode = "list" | "board" | "calendar" | "files";

export type TasksNavMode = "my" | "project";

export type TasksFilterMode = "incomplete" | "all" | "completed";

export type TasksSortMode = "dueDate" | "created" | "title";

export type TaskTemplateTaskDef = {
  keyword: string;
  title: string;
  status?: TaskStatus;
  clientSiteId?: string | null;
  assignPulse?: boolean;
  scheduleMode?: TaskScheduleMode;
  triggerConfig?: TaskTriggerConfig;
  recurrenceRule?: TaskRecurrenceRule;
  dueDate?: string;
  dueTime?: string;
  assigneeIds?: number[];
  tagIds?: string[];
  executionKind?: TaskExecutionKind;
  executionPayload?: TaskExecutionPayload;
};

export type DefaultTaskCreatePayload = {
  keyword?: string;
  title: string;
  status?: TaskStatus;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  recurrenceRule?: TaskRecurrenceRule;
  scheduleMode?: TaskScheduleMode;
  triggerConfig?: TaskTriggerConfig;
  assignPulse?: boolean;
  assigneeIds?: number[];
  tagIds?: string[];
  executionKind?: TaskExecutionKind;
  executionPayload?: TaskExecutionPayload;
  clientSiteId?: string | null;
};

export type TaskTemplate = {
  keyword: string;
  kind: "template";
  name: string;
  defaultTasks: TaskTemplateTaskDef[];
  defaultClientSiteId?: string | null;
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
  wordpressSiteId?: string;
  isAutomation?: boolean;
  sourceTemplateKeyword?: string;
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
  /** HH:mm in America/Edmonton */
  dueTime?: string;
  assigneeIds: number[];
  tagIds: string[];
  projectTitle: string;
  wordpressSiteId?: string;
  recurrenceRule?: TaskRecurrenceRule;
  scheduleMode?: TaskScheduleMode;
  triggerConfig?: TaskTriggerConfig;
  triggerMeta?: TaskTriggerMeta;
  scheduleMeta?: TaskScheduleMeta;
  executionKind?: TaskExecutionKind;
  executionPayload?: TaskExecutionPayload;
  lastExecutionId?: number | null;
  lastExecutionStatus?: TaskExecutionStatus | string | null;
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
