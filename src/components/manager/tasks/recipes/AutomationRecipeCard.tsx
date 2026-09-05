import React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getPropertyListRowBlackIconButtonClass,
  getPropertyListRowIconButtonHoverGlowClass,
} from "@/components/integrations/wordpress/cyberpunk-theme";
import {
  recipeCardClassName,
  recipeCategoryLabelClass,
} from "@/components/manager/pulse-forge/forge-recipe-styles";
import {
  AUTOMATION_RECIPE_BUCKET_LABELS,
  AUTOMATION_RECIPE_CATEGORY_LABELS,
  AUTOMATION_RECIPE_PREREQUISITE_LABELS,
  automationRecipeCategoryLabel,
} from "@/lib/automation-recipes-filters";
import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";

export type AutomationRecipeCardProps = {
  recipe: AutomationRecipeCatalogItem;
  selected?: boolean;
  onSelect?: () => void;
  onInstall?: () => void;
};

export function AutomationRecipeCard({
  recipe,
  selected = false,
  onSelect,
  onInstall,
}: AutomationRecipeCardProps): React.ReactElement {
  const buckets = recipe.filters.targetBuckets ?? [];
  const categoryLabel = automationRecipeCategoryLabel(recipe.category);
  const normalizedCategory = recipe.category === "reactive" ? "maintenance" : recipe.category;
  const install = onInstall ?? onSelect;

  const body = (
    <>
      <div className="flex min-w-0 flex-col gap-1">
        <span className={cn("text-lg font-semibold", recipeCategoryLabelClass(recipe.category))}>
          {categoryLabel}
        </span>
        <div className="flex min-w-0 items-center gap-1">
          <h3 className="min-w-0 text-lg font-semibold text-white">{recipe.name}</h3>
          {onInstall ? (
            <span
              aria-hidden
              className={cn(
                getPropertyListRowBlackIconButtonClass(true),
                getPropertyListRowIconButtonHoverGlowClass("powerOn"),
                "pointer-events-none",
              )}
            >
              <Plus className="h-4 w-4" />
            </span>
          ) : null}
        </div>
      </div>
      <p className="text-lg text-muted-foreground">{recipe.description}</p>
      <div className="flex flex-wrap gap-2">
        <span className="bg-black px-2 py-1 text-lg text-white">
          {AUTOMATION_RECIPE_CATEGORY_LABELS[normalizedCategory] ?? recipe.category}
        </span>
        {buckets.map((bucket) => (
          <span key={bucket} className="bg-black px-2 py-1 text-lg text-muted-foreground">
            {AUTOMATION_RECIPE_BUCKET_LABELS[bucket] ?? bucket}
          </span>
        ))}
        {recipe.prerequisites.map((req) => (
          <span key={req} className="bg-black px-2 py-1 text-lg text-muted-foreground">
            {AUTOMATION_RECIPE_PREREQUISITE_LABELS[req] ?? req}
          </span>
        ))}
      </div>
    </>
  );

  if (install) {
    return (
      <button
        type="button"
        className={cn(
          recipeCardClassName(recipe.category, selected),
          "flex w-full flex-col gap-3 p-4 text-left",
        )}
        onClick={install}
      >
        {body}
      </button>
    );
  }

  return (
    <article className={cn(recipeCardClassName(recipe.category, selected), "flex flex-col gap-3 p-4")}>
      <div className="flex min-w-0 flex-col gap-1">
        <span className={cn("text-lg font-semibold", recipeCategoryLabelClass(recipe.category))}>
          {categoryLabel}
        </span>
        <button type="button" className="min-w-0 text-left" onClick={onSelect}>
          <h3 className="text-lg font-semibold text-white">{recipe.name}</h3>
        </button>
      </div>
      <button type="button" className="text-left" onClick={onSelect}>
        <p className="text-lg text-muted-foreground">{recipe.description}</p>
      </button>
      <div className="flex flex-wrap gap-2">
        <span className="bg-black px-2 py-1 text-lg text-white">
          {AUTOMATION_RECIPE_CATEGORY_LABELS[normalizedCategory] ?? recipe.category}
        </span>
        {buckets.map((bucket) => (
          <span key={bucket} className="bg-black px-2 py-1 text-lg text-muted-foreground">
            {AUTOMATION_RECIPE_BUCKET_LABELS[bucket] ?? bucket}
          </span>
        ))}
        {recipe.prerequisites.map((req) => (
          <span key={req} className="bg-black px-2 py-1 text-lg text-muted-foreground">
            {AUTOMATION_RECIPE_PREREQUISITE_LABELS[req] ?? req}
          </span>
        ))}
      </div>
    </article>
  );
}
