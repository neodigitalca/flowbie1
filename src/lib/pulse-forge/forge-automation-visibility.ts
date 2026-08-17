import type { TaskProject } from "@/lib/tasks-types";

export type ForgeAutomationVisibility = "public" | "private";

export function resolveAutomationVisibility(
  project: Pick<TaskProject, "automationVisibility">,
): ForgeAutomationVisibility {
  return project.automationVisibility === "private" ? "private" : "public";
}

export function automationVisibilityLabel(visibility: ForgeAutomationVisibility): string {
  return visibility === "private" ? "Private" : "Public";
}

export function canViewAutomationProject(
  project: Pick<TaskProject, "isAutomation" | "automationVisibility" | "createdBy">,
  viewerUserId: number | null | undefined,
): boolean {
  if (!project.isAutomation) return true;
  if (resolveAutomationVisibility(project) === "public") return true;
  const ownerId = project.createdBy ?? 0;
  if (ownerId <= 0) return true;
  if (viewerUserId == null || viewerUserId <= 0) return true;
  return ownerId === viewerUserId;
}

export function filterVisibleAutomationProjects(
  projects: TaskProject[],
  viewerUserId: number | null | undefined,
): TaskProject[] {
  return projects.filter((project) => canViewAutomationProject(project, viewerUserId));
}
