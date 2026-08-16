import React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_RECIPE_BUCKET_LABELS,
  AUTOMATION_RECIPE_CATEGORY_LABELS,
  AUTOMATION_RECIPE_PREREQUISITE_LABELS,
  recipeActionCount,
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
  const actionCount = recipeActionCount(recipe);

  return (
    <article
      className={cn(
        "flex flex-col gap-2 bg-zinc-950 p-4",
        selected && "ring-1 ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <button type="button" className="min-w-0 text-left" onClick={onSelect}>
            <h3 className="text-base font-semibold text-white">{recipe.name}</h3>
          </button>
          {onInstall ? (
            <button
              type="button"
              aria-label={`Install ${recipe.name}`}
              className="shrink-0 p-0.5 text-green-400 hover:bg-green-500/15 hover:text-green-300"
              onClick={onInstall}
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <span className="shrink-0 text-base text-muted-foreground">
          {actionCount} action{actionCount === 1 ? "" : "s"}
        </span>
      </div>
      <button type="button" className="text-left" onClick={onSelect}>
        <p className="text-base text-muted-foreground">{recipe.description}</p>
      </button>
      <div className="flex flex-wrap gap-2">
        <span className="bg-zinc-900 px-2 py-1 text-base text-white">
          {AUTOMATION_RECIPE_CATEGORY_LABELS[recipe.category] ?? recipe.category}
        </span>
        {buckets.map((bucket) => (
          <span key={bucket} className="bg-zinc-900 px-2 py-1 text-base text-muted-foreground">
            {AUTOMATION_RECIPE_BUCKET_LABELS[bucket] ?? bucket}
          </span>
        ))}
        {recipe.prerequisites.map((req) => (
          <span key={req} className="bg-zinc-900 px-2 py-1 text-base text-muted-foreground">
            {AUTOMATION_RECIPE_PREREQUISITE_LABELS[req] ?? req}
          </span>
        ))}
      </div>
    </article>
  );
}
