import type { TaskExecutionPayload } from "@/lib/tasks-types";
import type { AutomationPlan } from "@/lib/automation-planner-types";

const CACHE_PREFIX = "forge-automation-payload:";
const RECIPE_PLAN_CACHE_PREFIX = "forge-recipe-plan:";
const RECIPE_CLIENTS_CACHE_PREFIX = "forge-recipe-clients:";

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

function recipePlanCacheKey(teamId: number, recipeKeyword: string): string {
  return `${RECIPE_PLAN_CACHE_PREFIX}${teamId}:${recipeKeyword}`;
}

export function readCachedRecipePlan(teamId: number, recipeKeyword: string): AutomationPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(recipePlanCacheKey(teamId, recipeKeyword));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AutomationPlan;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCachedRecipePlan(
  teamId: number,
  recipeKeyword: string,
  plan: AutomationPlan,
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(recipePlanCacheKey(teamId, recipeKeyword), JSON.stringify(plan));
  } catch {
    /* ignore quota errors */
  }
}

function recipeClientsCacheKey(teamId: number, recipeKeyword: string): string {
  return `${RECIPE_CLIENTS_CACHE_PREFIX}${teamId}:${recipeKeyword}`;
}

export function readCachedRecipeClientIds(teamId: number, recipeKeyword: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(recipeClientsCacheKey(teamId, recipeKeyword));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  } catch {
    return [];
  }
}

export function writeCachedRecipeClientIds(
  teamId: number,
  recipeKeyword: string,
  clientIds: string[],
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      recipeClientsCacheKey(teamId, recipeKeyword),
      JSON.stringify(clientIds),
    );
  } catch {
    /* ignore quota errors */
  }
}
