import type {
  AutomationRecipeCatalogItem,
  AutomationRecipeFilterOptions,
  AutomationRecipeListQuery,
} from "@/lib/automation-recipes-types";

export const AUTOMATION_RECIPE_CATEGORY_LABELS: Record<string, string> = {
  maintenance: "Maintenance",
  "local-seo": "Local SEO",
  onboarding: "Onboarding",
  editorial: "Editorial",
  reporting: "Reporting",
  research: "Research",
};

export const AUTOMATION_RECIPE_CATEGORY_ORDER = [
  "research",
  "editorial",
  "reporting",
  "maintenance",
  "local-seo",
  "onboarding",
] as const;

export function automationRecipeSearchPlaceholder(input: {
  filteredCount: number;
  totalCount: number;
  filtersActive: boolean;
}): string {
  const noun = input.totalCount === 1 ? "agent" : "agents";
  if (input.filtersActive) {
    return `Search ${input.filteredCount} of ${input.totalCount} ${noun}`;
  }
  return `Search ${input.totalCount} ${noun}`;
}

export function automationRecipeCategoryLabel(category: string): string {
  const normalized = category === "reactive" ? "maintenance" : category;
  return AUTOMATION_RECIPE_CATEGORY_LABELS[normalized] ?? normalized;
}

export const AUTOMATION_RECIPE_VERTICAL_LABELS: Record<string, string> = {
  general: "General",
  "local-seo": "Local SEO",
  "home-services": "Home services",
  editorial: "Editorial",
  ecommerce: "Ecommerce",
};

export const AUTOMATION_RECIPE_BUCKET_LABELS: Record<string, string> = {
  pages: "Pages",
  posts: "Posts",
  sap: "SAP / Entity",
  all: "All buckets",
};

export const AUTOMATION_RECIPE_SIGNAL_LABELS: Record<string, string> = {
  position_drop: "Position dropped",
  ctr_drop: "CTR dropped",
  impressions_up_ctr_down: "Impressions up, CTR down",
  clicks_drop: "Clicks dropped",
  quick_win_slipped: "Quick win slipped",
};

export const AUTOMATION_RECIPE_EXECUTION_LABELS: Record<string, string> = {
  "meta-only": "Meta only",
  "full-aiseo": "Full AISEO",
};

export const AUTOMATION_RECIPE_PREREQUISITE_LABELS: Record<string, string> = {
  gsc: "GSC",
  wordpress: "WordPress",
  "entity-sitemap": "Entity sitemap",
};

export function filterAutomationRecipesClient(
  recipes: AutomationRecipeCatalogItem[],
  query: AutomationRecipeListQuery,
): AutomationRecipeCatalogItem[] {
  const q = (query.q ?? "").trim().toLowerCase();
  return recipes.filter((recipe) => {
    if (query.category) {
      const recipeCategory = recipe.category === "reactive" ? "maintenance" : recipe.category;
      if (recipeCategory !== query.category) return false;
    }
    if (query.vertical && !recipe.verticals.includes(query.vertical)) return false;
    if (query.bucket && !recipe.filters.targetBuckets?.includes(query.bucket as never)) return false;
    if (query.signal && !recipe.filters.triggerSignals?.includes(query.signal)) return false;
    if (query.execution === "meta-only" && !recipe.filters.executionKinds?.includes("content_optimizer_meta")) {
      return false;
    }
    if (query.execution === "full-aiseo" && !recipe.filters.executionKinds?.includes("content_optimizer")) {
      return false;
    }
    if (q) {
      const hay = `${recipe.keyword} ${recipe.name} ${recipe.description} ${recipe.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function mergeFilterOptions(
  fromApi: AutomationRecipeFilterOptions,
  recipes: AutomationRecipeCatalogItem[],
): AutomationRecipeFilterOptions {
  const categories = new Set<string>(AUTOMATION_RECIPE_CATEGORY_ORDER);
  const verticals = new Set(fromApi.verticals);
  const buckets = new Set(fromApi.buckets);
  const signals = new Set(fromApi.signals);
  for (const category of fromApi.categories) {
    categories.add(category === "reactive" ? "maintenance" : category);
  }
  for (const recipe of recipes) {
    if (recipe.category) {
      categories.add(recipe.category === "reactive" ? "maintenance" : recipe.category);
    }
    for (const v of recipe.verticals) verticals.add(v);
    for (const b of recipe.filters.targetBuckets ?? []) buckets.add(b);
    for (const s of recipe.filters.triggerSignals ?? []) signals.add(s);
  }
  return {
    categories: AUTOMATION_RECIPE_CATEGORY_ORDER.filter((category) => categories.has(category)),
    verticals: [...verticals].sort(),
    buckets: [...buckets].sort(),
    signals: [...signals].sort(),
  };
}

export function recipeActionCount(recipe: AutomationRecipeCatalogItem): number {
  return recipe.filters.actionCount ?? recipe.defaultTasks?.length ?? 1;
}
