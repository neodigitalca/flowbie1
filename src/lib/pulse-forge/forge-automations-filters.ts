import type { TaskProjectBundle } from "@/contexts/TeamContext";
import type { AgentRun } from "@/lib/agent-runs-types";
import { activeRunForProject } from "@/lib/pulse-forge/forge-dashboard-runs";
import { formatAutomationScheduleLabel } from "@/lib/pulse-forge/forge-automation-row-meta";
import type { ForgeAutomationDemoRow } from "@/lib/pulse-forge/forge-automations-demo-data";
import { automationRecipeCategoryLabel } from "@/lib/automation-recipes-filters";
import { resolveEffectiveExecutionKind } from "@/lib/task-automation-ui";
import type { TaskExecutionKind, TaskProject, TeamTask } from "@/lib/tasks-types";

export type ForgeAutomationCategory =
  | "maintenance"
  | "editorial"
  | "reporting"
  | "research"
  | "local-seo"
  | "onboarding";

export type ForgeAutomationsSort =
  | "recent"
  | "title-asc"
  | "title-desc"
  | "site-asc"
  | "site-desc";

export type ForgeAutomationsListQuery = {
  titles?: string[];
  siteIds?: string[];
  categories?: ForgeAutomationCategory[];
  executionKinds?: string[];
  statuses?: string[];
  schedules?: string[];
  sort?: ForgeAutomationsSort;
};

export type ForgeAutomationFilterOptions = {
  titles: string[];
  siteIds: string[];
  categories: ForgeAutomationCategory[];
  executionKinds: TaskExecutionKind[];
  schedules: string[];
};

export const FORGE_AUTOMATION_CATEGORY_ORDER: ForgeAutomationCategory[] = [
  "research",
  "editorial",
  "reporting",
  "maintenance",
  "local-seo",
  "onboarding",
];

export const FORGE_AUTOMATION_SORT_OPTIONS: { value: ForgeAutomationsSort; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "title-asc", label: "Title A-Z" },
  { value: "title-desc", label: "Title Z-A" },
  { value: "site-asc", label: "Site A-Z" },
  { value: "site-desc", label: "Site Z-A" },
];

export const FORGE_AUTOMATION_EXECUTION_KIND_LABELS: Record<string, string> = {
  post_creator: "Post creator",
  gsc_reporting: "GSC reporting",
  local_dominator_export: "Research export",
  content_optimizer: "Content optimizer",
  content_optimizer_meta: "Meta optimizer",
};

export const FORGE_AUTOMATION_STATUS_FILTER_OPTIONS = [
  { value: "running", label: "Running" },
  { value: "idle", label: "Idle" },
] as const;

export function forgeAutomationCategoryLabel(category: ForgeAutomationCategory): string {
  return automationRecipeCategoryLabel(category);
}

export function forgeAutomationExecutionKindLabel(kind: string | undefined | null): string {
  const key = (kind ?? "").trim();
  if (!key) return "Other";
  return FORGE_AUTOMATION_EXECUTION_KIND_LABELS[key] ?? key.replace(/_/g, " ");
}

function normalizeQuery(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function matchesMultiFilter(selected: string[] | undefined, value: string): boolean {
  if (!selected?.length) return true;
  return selected.includes(value);
}

function inferDemoExecutionKind(title: string): TaskExecutionKind {
  const t = title.toLowerCase();
  if (t.includes("gsc")) return "gsc_reporting";
  if (t.includes("post creator") || t.includes("posts editorial")) return "post_creator";
  if (t.includes("meta")) return "content_optimizer_meta";
  return "content_optimizer";
}

function inferDemoCategory(title: string): ForgeAutomationCategory {
  const t = title.toLowerCase();
  if (t.includes("gsc") || t.includes("report")) return "reporting";
  if (t.includes("post creator") || t.includes("editorial")) return "editorial";
  if (t.includes("local seo") || t.includes("local seo pages")) return "local-seo";
  if (t.includes("onboard")) return "onboarding";
  return inferCategoryFromExecutionKind(inferDemoExecutionKind(title));
}

function inferCategoryFromExecutionKind(kind: TaskExecutionKind): ForgeAutomationCategory {
  if (kind === "gsc_reporting") return "reporting";
  if (kind === "post_creator") return "editorial";
  if (kind === "local_dominator_export") return "research";
  return "maintenance";
}

function inferCategoryFromTitle(title: string, kind: TaskExecutionKind): ForgeAutomationCategory {
  const t = title.toLowerCase();
  if (t.includes("local seo")) return "local-seo";
  if (t.includes("onboard")) return "onboarding";
  return inferCategoryFromExecutionKind(kind);
}

function resolveProjectCategory(
  project: TaskProject,
  task: TeamTask | undefined,
): ForgeAutomationCategory {
  const kind = resolveProjectExecutionKind(project, task);
  return inferCategoryFromTitle(project.title?.trim() ?? "", kind);
}

function resolveProjectExecutionKind(
  project: TaskProject,
  task: TeamTask | undefined,
): TaskExecutionKind {
  return resolveEffectiveExecutionKind(task, project);
}

function resolveProjectScheduleKey(task: TeamTask | undefined): string {
  return normalizeQuery(formatAutomationScheduleLabel(task));
}

function matchesStatusFilter(
  statuses: string[] | undefined,
  isRunning: boolean,
): boolean {
  if (!statuses?.length) return true;
  const status = isRunning ? "running" : "idle";
  return statuses.includes(status);
}

export function buildForgeAutomationFilterOptions(
  automationProjects: TaskProject[],
  projectBundles: Record<number, TaskProjectBundle>,
  sites: { id: string; name: string }[],
  demoRows?: ForgeAutomationDemoRow[],
): ForgeAutomationFilterOptions {
  const titles = new Set<string>();
  const siteIds = new Set<string>();
  const categories = new Set<ForgeAutomationCategory>();
  const executionKinds = new Set<TaskExecutionKind>();
  const schedules = new Set<string>();
  const siteNameToId = new Map(sites.map((site) => [site.name, site.id]));

  for (const project of automationProjects) {
    const title = project.title?.trim();
    if (title) titles.add(title);
    const siteId = project.wordpressSiteId?.trim();
    if (siteId) siteIds.add(siteId);
    const task = projectBundles[project.id]?.tasks[0];
    const kind = resolveProjectExecutionKind(project, task);
    if (kind) executionKinds.add(kind);
    categories.add(resolveProjectCategory(project, task));
    const schedule = resolveProjectScheduleKey(task);
    if (schedule && schedule !== "—") schedules.add(schedule);
  }

  for (const row of demoRows ?? []) {
    const title = row.title?.trim();
    if (title) titles.add(title);
    const demoSiteId = siteNameToId.get(row.siteName);
    if (demoSiteId) siteIds.add(demoSiteId);
    const schedule = normalizeQuery(row.scheduleLabel);
    if (schedule && schedule !== "—") schedules.add(schedule);
    executionKinds.add(inferDemoExecutionKind(row.title));
    categories.add(inferDemoCategory(row.title));
  }

  const kindOrder: TaskExecutionKind[] = [
    "post_creator",
    "gsc_reporting",
    "content_optimizer",
    "content_optimizer_meta",
  ];

  return {
    titles: [...titles].sort((a, b) => a.localeCompare(b)),
    siteIds: [...siteIds].sort((a, b) => a.localeCompare(b)),
    categories: FORGE_AUTOMATION_CATEGORY_ORDER.filter((category) => categories.has(category)),
    executionKinds: kindOrder.filter((k) => executionKinds.has(k)),
    schedules: [...schedules].sort((a, b) => a.localeCompare(b)),
  };
}

export function filterForgeAutomationProjects(
  automationProjects: TaskProject[],
  projectBundles: Record<number, TaskProjectBundle>,
  runs: AgentRun[],
  query: ForgeAutomationsListQuery,
): TaskProject[] {
  return automationProjects.filter((project) => {
    const siteKey = project.wordpressSiteId?.trim() ?? "";
    if (!matchesMultiFilter(query.siteIds, siteKey)) return false;
    if (!matchesMultiFilter(query.titles, project.title?.trim() ?? "")) return false;

    const bundle = projectBundles[project.id];
    const task = bundle?.tasks[0];
    const kind = resolveProjectExecutionKind(project, task);
    if (!matchesMultiFilter(query.executionKinds, kind)) return false;
    if (!matchesMultiFilter(query.categories, resolveProjectCategory(project, task))) return false;

    const schedule = resolveProjectScheduleKey(task);
    if (!matchesMultiFilter(query.schedules, schedule)) return false;

    const isRunning = activeRunForProject(runs, project.id, projectBundles) != null;
    return matchesStatusFilter(query.statuses, isRunning);
  });
}

export function filterForgeAutomationDemoRows(
  rows: ForgeAutomationDemoRow[],
  sites: { id: string; name: string }[],
  query: ForgeAutomationsListQuery,
): ForgeAutomationDemoRow[] {
  const siteNameById = new Map(sites.map((s) => [s.id, s.name]));

  return rows.filter((row) => {
    const matchedSiteId =
      sites.find((s) => s.name === row.siteName)?.id ??
      [...siteNameById.entries()].find(([, name]) => name === row.siteName)?.[0] ??
      "";
    if (!matchesMultiFilter(query.siteIds, matchedSiteId)) return false;
    if (!matchesMultiFilter(query.titles, row.title?.trim() ?? "")) return false;
    if (!matchesMultiFilter(query.executionKinds, inferDemoExecutionKind(row.title))) return false;
    if (!matchesMultiFilter(query.categories, inferDemoCategory(row.title))) return false;
    if (!matchesMultiFilter(query.schedules, normalizeQuery(row.scheduleLabel))) return false;
    const isRunning = row.statusLabel === "Running";
    return matchesStatusFilter(query.statuses, isRunning);
  });
}

export function sortForgeAutomationProjects(
  projects: TaskProject[],
  sort: ForgeAutomationsSort | undefined,
  siteNameById: Map<string, string>,
): TaskProject[] {
  const sorted = [...projects];
  const resolveSiteName = (project: TaskProject): string => {
    const siteId = project.wordpressSiteId?.trim() ?? "";
    return siteNameById.get(siteId) ?? siteId;
  };

  switch (sort ?? "recent") {
    case "title-asc":
      return sorted.sort((left, right) => left.title.localeCompare(right.title));
    case "title-desc":
      return sorted.sort((left, right) => right.title.localeCompare(left.title));
    case "site-asc":
      return sorted.sort((left, right) =>
        resolveSiteName(left).localeCompare(resolveSiteName(right)),
      );
    case "site-desc":
      return sorted.sort((left, right) =>
        resolveSiteName(right).localeCompare(resolveSiteName(left)),
      );
    case "recent":
    default:
      return sorted.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
}

export function sortForgeAutomationDemoRows(
  rows: ForgeAutomationDemoRow[],
  sort: ForgeAutomationsSort | undefined,
): ForgeAutomationDemoRow[] {
  const sorted = [...rows];
  switch (sort ?? "recent") {
    case "title-asc":
      return sorted.sort((left, right) => left.title.localeCompare(right.title));
    case "title-desc":
      return sorted.sort((left, right) => right.title.localeCompare(left.title));
    case "site-asc":
      return sorted.sort((left, right) => left.siteName.localeCompare(right.siteName));
    case "site-desc":
      return sorted.sort((left, right) => right.siteName.localeCompare(left.siteName));
    case "recent":
    default:
      return sorted;
  }
}

export function forgeAutomationStatsForProjects(
  projects: TaskProject[],
  projectBundles: Record<number, TaskProjectBundle>,
  runs: AgentRun[],
): { total: number; running: number; idle: number } {
  let running = 0;
  for (const project of projects) {
    if (activeRunForProject(runs, project.id, projectBundles)) running += 1;
  }
  const total = projects.length;
  return { total, running, idle: Math.max(0, total - running) };
}

export function forgeAutomationStatsForDemoRows(
  rows: ForgeAutomationDemoRow[],
): { total: number; running: number; idle: number } {
  let running = 0;
  for (const row of rows) {
    if (row.statusLabel === "Running") running += 1;
  }
  const total = rows.length;
  return { total, running, idle: Math.max(0, total - running) };
}

export function hasActiveForgeAutomationFilters(query: ForgeAutomationsListQuery): boolean {
  return Boolean(
    query.titles?.length ||
      query.siteIds?.length ||
      query.categories?.length ||
      query.executionKinds?.length ||
      query.statuses?.length ||
      query.schedules?.length,
  );
}

export function toggleForgeAutomationQueryValue<T extends string>(
  current: T[] | undefined,
  value: T,
  checked: boolean,
): T[] | undefined {
  const next = new Set(current ?? []);
  if (checked) next.add(value);
  else next.delete(value);
  return next.size ? [...next] : undefined;
}
