import { tasksApi } from "@/lib/tasks-api";
import type {
  AutomationRecipeCatalogItem,
  AutomationRecipeFilterOptions,
  AutomationRecipeListQuery,
} from "@/lib/automation-recipes-types";

function queryString(query: AutomationRecipeListQuery): string {
  const params = new URLSearchParams();
  if (query.category?.trim()) params.set("category", query.category.trim());
  if (query.bucket?.trim()) params.set("bucket", query.bucket.trim());
  if (query.execution?.trim()) params.set("execution", query.execution.trim());
  if (query.signal?.trim()) params.set("signal", query.signal.trim());
  if (query.vertical?.trim()) params.set("vertical", query.vertical.trim());
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.includeTasks) params.set("includeTasks", "1");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchAutomationRecipes(
  teamId: number,
  query: AutomationRecipeListQuery = {},
): Promise<{ recipes: AutomationRecipeCatalogItem[]; filters: AutomationRecipeFilterOptions }> {
  const res = await tasksApi(`/teams/${teamId}/tasks/automation-recipes${queryString(query)}`);
  const data = (await res.json()) as {
    ok?: boolean;
    recipes?: AutomationRecipeCatalogItem[];
    filters?: AutomationRecipeFilterOptions;
    error?: string;
  };
  return {
    recipes: data.recipes ?? [],
    filters: data.filters ?? { categories: [], verticals: [], buckets: [], signals: [] },
  };
}

export async function fetchAutomationRecipe(
  teamId: number,
  keyword: string,
): Promise<AutomationRecipeCatalogItem | null> {
  const kw = keyword.trim();
  if (!kw) return null;
  const res = await tasksApi(`/teams/${teamId}/tasks/automation-recipes/${encodeURIComponent(kw)}`);
  const data = (await res.json()) as { ok?: boolean; recipe?: AutomationRecipeCatalogItem };
  return data.recipe ?? null;
}
