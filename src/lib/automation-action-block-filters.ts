import type { AutomationBlockCatalogItem } from "@/lib/automation-blocks-api";
import { AUTOMATION_RECIPE_CATEGORY_ORDER } from "@/lib/automation-recipes-filters";
import type {  AutomationRecipeFilterOptions,
  AutomationRecipeListQuery,
} from "@/lib/automation-recipes-types";

export type AutomationActionBlockListQuery = Pick<
  AutomationRecipeListQuery,
  "category" | "bucket"
>;

function normalizeCategory(category: string): string {
  return category === "reactive" ? "maintenance" : category;
}

function blockMatchesCategory(block: AutomationBlockCatalogItem, category: string): boolean {
  const categories = (block.filters?.categories ?? []).map(normalizeCategory);
  return categories.includes(category);
}

export function filterAutomationActionBlocks(
  blocks: AutomationBlockCatalogItem[],
  query: AutomationActionBlockListQuery,
): AutomationBlockCatalogItem[] {
  return blocks.filter((block) => {
    const filters = block.filters ?? {};
    if (query.category && !blockMatchesCategory(block, query.category)) return false;
    if (query.bucket && !(filters.buckets ?? []).includes(query.bucket)) return false;
    return true;
  });
}

export function mergeActionBlockFilterOptions(
  blocks: AutomationBlockCatalogItem[],
): AutomationRecipeFilterOptions {
  const categories = new Set<string>(AUTOMATION_RECIPE_CATEGORY_ORDER);
  const buckets = new Set<string>();
  for (const block of blocks) {
    const filters = block.filters ?? {};
    for (const cat of filters.categories ?? []) categories.add(normalizeCategory(cat));
    for (const b of filters.buckets ?? []) buckets.add(b);
  }

  return {
    categories: AUTOMATION_RECIPE_CATEGORY_ORDER.filter((category) => categories.has(category)),
    verticals: [],
    buckets: [...buckets].sort(),
    signals: [],
  };
}
