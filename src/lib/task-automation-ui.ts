import { isAutomationProject } from "@/lib/task-automation-templates";
import type { TaskExecutionKind, TaskScheduleMode, TaskProject, TeamTask } from "@/lib/tasks-types";
import type { TeamMember } from "@/lib/teams-types";
import { ensurePostCreatorPayload, defaultPostCreatorExecutionPayloadForRecipe } from "@/lib/post-creator/post-creator-defaults";

export const EDITORIAL_POST_CREATOR_RECIPE_KEYWORDS = [
  "monthly-post-creator",
  "monthly-3-posts-editorial",
] as const;

export const EDITORIAL_POST_CREATOR_TASK_KEYWORDS = [
  "monthly-post-creator-run",
  "monthly-3-posts-run",
] as const;

export const GSC_REPORTING_RECIPE_KEYWORDS = [
  "gsc-monthly-mom-report",
  "gsc-monthly-yoy-report",
] as const;

export const GSC_REPORTING_TASK_KEYWORDS = ["gsc-mom-report", "gsc-yoy-report"] as const;

const CALENDAR_AUTOMATION_KINDS = new Set<TaskExecutionKind>(["post_creator", "gsc_reporting"]);

export function isEditorialPostCreatorProject(
  project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword"> | null,
): boolean {
  const recipeKw = (project?.sourceTemplateKeyword ?? "").trim();
  const projectKw = (project?.keyword ?? "").trim();
  return (
    EDITORIAL_POST_CREATOR_RECIPE_KEYWORDS.includes(
      recipeKw as (typeof EDITORIAL_POST_CREATOR_RECIPE_KEYWORDS)[number],
    ) ||
    EDITORIAL_POST_CREATOR_RECIPE_KEYWORDS.includes(
      projectKw as (typeof EDITORIAL_POST_CREATOR_RECIPE_KEYWORDS)[number],
    )
  );
}

export function isEditorialPostCreatorTask(
  task?: Pick<TeamTask, "keyword" | "executionKind"> | null,
  project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword"> | null,
): boolean {
  if ((task?.executionKind ?? "").trim() === "post_creator") return true;
  if (isEditorialPostCreatorProject(project)) return true;
  const taskKw = (task?.keyword ?? "").trim();
  return EDITORIAL_POST_CREATOR_TASK_KEYWORDS.includes(
    taskKw as (typeof EDITORIAL_POST_CREATOR_TASK_KEYWORDS)[number],
  );
}

export function editorialPostCreatorRecipeKeyword(
  project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword"> | null,
  task?: Pick<TeamTask, "keyword"> | null,
): (typeof EDITORIAL_POST_CREATOR_RECIPE_KEYWORDS)[number] {
  const recipeKw = (project?.sourceTemplateKeyword ?? project?.keyword ?? "").trim();
  if (recipeKw === "monthly-3-posts-editorial" || task?.keyword === "monthly-3-posts-run") {
    return "monthly-3-posts-editorial";
  }
  return "monthly-post-creator";
}

export function resolveEffectiveExecutionKind(
  task?: Pick<TeamTask, "keyword" | "executionKind"> | null,
  project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword"> | null,
): TaskExecutionKind {
  const kind = (task?.executionKind ?? "").trim();
  if (kind === "post_creator" || kind === "gsc_reporting") return kind;
  if (isEditorialPostCreatorTask(task, project)) return "post_creator";
  if (isGscReportingTask(task, project)) return "gsc_reporting";
  return (kind || "content_optimizer") as TaskExecutionKind;
}

export function isCalendarAutomationKind(kind: string | undefined | null): boolean {
  return CALENDAR_AUTOMATION_KINDS.has((kind ?? "").trim() as TaskExecutionKind);
}

export function automationUsesTriggerUi(
  kind: string | undefined | null,
  scheduleMode?: TaskScheduleMode,
  context?: {
    task?: Pick<TeamTask, "keyword" | "executionKind"> | null;
    project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword"> | null;
  },
): boolean {
  const resolvedKind = context
    ? resolveEffectiveExecutionKind(context.task, context.project)
    : (kind ?? "").trim();
  if (isCalendarAutomationKind(resolvedKind)) return false;
  if (scheduleMode === "calendar") return false;
  return true;
}

export function resolveEditorialPostCreatorTask(
  task: TeamTask,
  project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword"> | null,
): {
  executionKind: TaskExecutionKind;
  scheduleMode: TaskScheduleMode;
  recurrenceRule: TeamTask["recurrenceRule"];
  executionPayload: TeamTask["executionPayload"];
} | null {
  if (!isEditorialPostCreatorTask(task, project)) return null;

  const recipeKw = editorialPostCreatorRecipeKeyword(project, task);
  const defaults = defaultPostCreatorExecutionPayloadForRecipe(recipeKw);

  return {
    executionKind: "post_creator",
    scheduleMode: "calendar",
    recurrenceRule: task.recurrenceRule && task.recurrenceRule !== "none" ? task.recurrenceRule : "monthly",
    executionPayload: ensurePostCreatorPayload({ ...defaults, ...task.executionPayload }),
  };
}

export function isGscReportingProject(
  project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword"> | null,
): boolean {
  const recipeKw = (project?.sourceTemplateKeyword ?? "").trim();
  const projectKw = (project?.keyword ?? "").trim();
  return (
    GSC_REPORTING_RECIPE_KEYWORDS.includes(recipeKw as (typeof GSC_REPORTING_RECIPE_KEYWORDS)[number]) ||
    GSC_REPORTING_RECIPE_KEYWORDS.includes(projectKw as (typeof GSC_REPORTING_RECIPE_KEYWORDS)[number])
  );
}

export function isGscReportingTask(
  task?: Pick<TeamTask, "keyword" | "executionKind"> | null,
  project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword"> | null,
): boolean {
  if ((task?.executionKind ?? "").trim() === "gsc_reporting") return true;
  if (isGscReportingProject(project)) return true;
  const taskKw = (task?.keyword ?? "").trim();
  return GSC_REPORTING_TASK_KEYWORDS.includes(taskKw as (typeof GSC_REPORTING_TASK_KEYWORDS)[number]);
}

export function gscReportingRecipeKeyword(
  project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword"> | null,
  task?: Pick<TeamTask, "keyword"> | null,
): (typeof GSC_REPORTING_RECIPE_KEYWORDS)[number] {
  const recipeKw = (project?.sourceTemplateKeyword ?? project?.keyword ?? "").trim();
  if (recipeKw === "gsc-monthly-yoy-report" || task?.keyword === "gsc-yoy-report") {
    return "gsc-monthly-yoy-report";
  }
  return "gsc-monthly-mom-report";
}

export function resolveGscReportingTask(
  task: TeamTask,
  project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword"> | null,
): {
  executionKind: TaskExecutionKind;
  scheduleMode: TaskScheduleMode;
  recurrenceRule: TeamTask["recurrenceRule"];
  executionPayload: TeamTask["executionPayload"];
} | null {
  if (!isGscReportingTask(task, project)) return null;

  const recipeKw = gscReportingRecipeKeyword(project, task);
  const comparePreset = recipeKw === "gsc-monthly-yoy-report" ? "yoy" : "mom";

  return {
    executionKind: "gsc_reporting",
    scheduleMode: "calendar",
    recurrenceRule: task.recurrenceRule && task.recurrenceRule !== "none" ? task.recurrenceRule : "monthly",
    executionPayload: {
      comparePreset,
      saveToDisk: task.executionPayload?.saveToDisk !== false,
      ...task.executionPayload,
    },
  };
}

export function resolveTaskForAutomationExecute(
  task: TeamTask,
  project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword"> | null,
): TeamTask {
  const gscResolved = resolveGscReportingTask(task, project);
  if (gscResolved) {
    return { ...task, ...gscResolved };
  }
  const editorial = resolveEditorialPostCreatorTask(task, project);
  if (editorial) {
    return { ...task, ...editorial };
  }
  const kind = resolveEffectiveExecutionKind(task, project);
  return {
    ...task,
    executionKind: kind,
    scheduleMode:
      isCalendarAutomationKind(kind) || task.scheduleMode === "calendar" ? "calendar" : task.scheduleMode,
  };
}

export function automationExecuteUsesTriggerRun(
  task: TeamTask,
  project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword"> | null,
): boolean {
  const resolved = resolveTaskForAutomationExecute(task, project);
  return automationUsesTriggerUi(resolved.executionKind, resolved.scheduleMode, {
    task: resolved,
    project,
  });
}

export function taskSupportsManualAutomationExecute(
  task: Pick<TeamTask, "executionKind" | "keyword" | "projectId">,
  project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword" | "isAutomation"> | null,
  projectTasks?: TeamTask[],
  members?: TeamMember[],
): boolean {
  if ((task.executionKind ?? "").trim()) return true;
  if (isEditorialPostCreatorTask(task, project)) return true;
  if (isGscReportingTask(task, project)) return true;
  if (project && isAutomationProject(project, projectTasks, members)) return true;
  return false;
}
