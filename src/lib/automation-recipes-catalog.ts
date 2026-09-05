import bundled from "@/lib/automation-recipes-catalog.bundle.json";
import type {
  AutomationRecipeCatalogItem,
  AutomationRecipeFilterOptions,
} from "@/lib/automation-recipes-types";

export const bundledAutomationRecipes = bundled as AutomationRecipeCatalogItem[];

export function mergeAutomationRecipeCatalog(
  fromApi: AutomationRecipeCatalogItem[],
): AutomationRecipeCatalogItem[] {
  const byKeyword = new Map<string, AutomationRecipeCatalogItem>();
  for (const recipe of fromApi) {
    byKeyword.set(recipe.keyword, recipe);
  }
  for (const recipe of bundledAutomationRecipes) {
    byKeyword.set(recipe.keyword, recipe);
  }
  return [...byKeyword.values()].sort((left, right) => left.keyword.localeCompare(right.keyword));
}

export function bundledAutomationRecipe(keyword: string): AutomationRecipeCatalogItem | null {
  const kw = keyword.trim();
  if (!kw) return null;
  return bundledAutomationRecipes.find((recipe) => recipe.keyword === kw) ?? null;
}

export function mergeAutomationRecipeFilterOptions(
  fromApi: AutomationRecipeFilterOptions,
  recipes: AutomationRecipeCatalogItem[],
): AutomationRecipeFilterOptions {
  const categories = new Set(fromApi.categories);
  const verticals = new Set(fromApi.verticals);
  const buckets = new Set(fromApi.buckets);
  const signals = new Set(fromApi.signals);
  for (const recipe of recipes) {
    if (recipe.category) categories.add(recipe.category === "reactive" ? "maintenance" : recipe.category);
    for (const vertical of recipe.verticals) verticals.add(vertical);
    for (const bucket of recipe.filters.targetBuckets ?? []) buckets.add(bucket);
    for (const signal of recipe.filters.triggerSignals ?? []) signals.add(signal);
  }
  return {
    categories: [...categories].sort(),
    verticals: [...verticals].sort(),
    buckets: [...buckets].sort(),
    signals: [...signals].sort(),
  };
}
