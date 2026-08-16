import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAutomationRecipes } from "@/lib/automation-recipes-api";
import {
  filterAutomationRecipesClient,
  mergeFilterOptions,
} from "@/lib/automation-recipes-filters";
import { setAutomationRecipeKeywords } from "@/lib/task-automation-templates";
import type {
  AutomationRecipeCatalogItem,
  AutomationRecipeFilterOptions,
  AutomationRecipeListQuery,
} from "@/lib/automation-recipes-types";
import { AutomationRecipeCard } from "@/components/manager/tasks/recipes/AutomationRecipeCard";
import { AutomationRecipeFilters } from "@/components/manager/tasks/recipes/AutomationRecipeFilters";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";

export type AutomationRecipeLibraryProps = {
  teamId: number;
  sites: WordPressSiteOption[];
  defaultSiteId?: string | null;
  onInstalled?: (projectId: number) => void;
  onRecipeClick?: (recipe: AutomationRecipeCatalogItem) => void;
  onRecipeInstall?: (recipe: AutomationRecipeCatalogItem) => void;
};

export function AutomationRecipeLibrary({
  teamId,
  onRecipeClick,
  onRecipeInstall,
}: AutomationRecipeLibraryProps): React.ReactElement {
  const [allRecipes, setAllRecipes] = useState<AutomationRecipeCatalogItem[]>([]);
  const [filterOptions, setFilterOptions] = useState<AutomationRecipeFilterOptions>({
    categories: [],
    verticals: [],
    buckets: [],
    signals: [],
  });
  const [query, setQuery] = useState<AutomationRecipeListQuery>({});
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchAutomationRecipes(teamId, { includeTasks: true }).then(({ recipes, filters }) => {
      if (cancelled) return;
      setAllRecipes(recipes);
      setFilterOptions(mergeFilterOptions(filters, recipes));
      setAutomationRecipeKeywords(recipes.map((r) => r.keyword));
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError("Could not load automation recipes.");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const filteredRecipes = useMemo(
    () => filterAutomationRecipesClient(allRecipes, query),
    [allRecipes, query],
  );

  const patchQuery = useCallback((patch: Partial<AutomationRecipeListQuery>) => {
    setQuery((current) => ({ ...current, ...patch }));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-base text-muted-foreground">Loading recipe catalog…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-base text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <AutomationRecipeFilters query={query} filterOptions={filterOptions} onChange={patchQuery} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
          {filteredRecipes.map((recipe) => (
            <AutomationRecipeCard
              key={recipe.keyword}
              recipe={recipe}
              selected={selectedKeyword === recipe.keyword}
              onSelect={() => {
                setSelectedKeyword(recipe.keyword);
                onRecipeClick?.(recipe);
              }}
              onInstall={() => onRecipeInstall?.(recipe)}
            />
          ))}
        </div>
        {filteredRecipes.length === 0 ? (
          <p className="px-2 py-8 text-base text-muted-foreground">No recipes match these filters.</p>
        ) : null}
      </div>
    </div>
  );
}
