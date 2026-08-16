import { taskHasPulseAssignee } from "@/lib/tasks-filter";
import type { TaskProject, TaskTemplate, TeamTask } from "@/lib/tasks-types";
import type { TeamMember } from "@/lib/teams-types";

let automationRecipeKeywords = new Set<string>();

export function setAutomationRecipeKeywords(keywords: string[]): void {
  automationRecipeKeywords = new Set(keywords.map((k) => k.trim()).filter(Boolean));
}

export function getAutomationRecipeKeywords(): ReadonlySet<string> {
  return automationRecipeKeywords;
}

function templateLooksLikeAutomation(template: Pick<TaskTemplate, "defaultTasks">): boolean {
  const tasks = template.defaultTasks ?? [];
  if (tasks.length === 0) return false;
  return tasks.every((t) => t.scheduleMode === "trigger");
}

export function isAutomationTemplate(
  keyword: string | undefined | null,
  template?: Pick<TaskTemplate, "defaultTasks">,
): boolean {
  const kw = (keyword ?? "").trim();
  if (kw && automationRecipeKeywords.has(kw)) return true;
  if (template && templateLooksLikeAutomation(template)) return true;
  return false;
}

export function filterAutomationTemplates(templates: TaskTemplate[]): TaskTemplate[] {
  return templates.filter((tpl) => isAutomationTemplate(tpl.keyword, tpl));
}

export function filterRegularProjectTemplates(templates: TaskTemplate[]): TaskTemplate[] {
  return templates.filter((tpl) => !isAutomationTemplate(tpl.keyword, tpl));
}

export function filterHumanProjects(projects: TaskProject[]): TaskProject[] {
  return projects.filter(
    (p) =>
      !p.isAutomation &&
      !isAutomationTemplate(p.keyword) &&
      !isAutomationTemplate(p.sourceTemplateKeyword),
  );
}

export function isAutomationProject(
  project: Pick<TaskProject, "keyword" | "isAutomation" | "sourceTemplateKeyword">,
  tasks?: Pick<TeamTask, "scheduleMode" | "assigneeIds" | "parentTaskId">[],
  members?: TeamMember[],
): boolean {
  if (project.isAutomation) return true;
  if (isAutomationTemplate(project.keyword)) return true;
  if (isAutomationTemplate(project.sourceTemplateKeyword)) return true;
  if (tasks?.length && members?.length) {
    const roots = tasks.filter((t) => t.parentTaskId === 0);
    if (roots.length === 0) return false;
    return roots.every((t) => t.scheduleMode === "trigger" && taskHasPulseAssignee(t, members));
  }
  return false;
}

export function isProjectBundleNavMode(navMode: string): boolean {
  return navMode === "project";
}
