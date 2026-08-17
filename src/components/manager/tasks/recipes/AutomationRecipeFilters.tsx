import React from "react";
import { Input } from "@/components/ui/input";
import {
  AUTOMATION_RECIPE_BUCKET_LABELS,
  AUTOMATION_RECIPE_CATEGORY_LABELS,
  AUTOMATION_RECIPE_CATEGORY_ORDER,
  AUTOMATION_RECIPE_EXECUTION_LABELS,
  AUTOMATION_RECIPE_SIGNAL_LABELS,
  AUTOMATION_RECIPE_VERTICAL_LABELS,
} from "@/lib/automation-recipes-filters";
import type {
  AutomationRecipeFilterOptions,
  AutomationRecipeListQuery,
} from "@/lib/automation-recipes-types";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_SELECT,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { cn } from "@/lib/utils";

export type AutomationRecipeFiltersProps = {
  query: AutomationRecipeListQuery;
  filterOptions: AutomationRecipeFilterOptions;
  onChange: (patch: Partial<AutomationRecipeListQuery>) => void;
  className?: string;
  searchPlaceholder?: string;
};

function FilterSelect({
  value,
  onChange,
  children,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  "aria-label": string;
}): React.ReactElement {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={`${BULK_HEADER_SELECT} h-8 shrink-0 text-base [color-scheme:dark]`}
    >
      {children}
    </select>
  );
}

export function AutomationRecipeFilters({
  query,
  filterOptions,
  onChange,
  className,
  searchPlaceholder = "Search recipes",
}: AutomationRecipeFiltersProps): React.ReactElement {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-2 bg-black", className)}>
      <Input
        value={query.q ?? ""}
        onChange={(e) => onChange({ q: e.target.value })}
        placeholder={searchPlaceholder}
        className={`${BULK_HEADER_FIELD} h-8 min-w-[10rem] flex-1 text-base sm:max-w-xs`}
      />
      <span className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />
      <FilterSelect
        aria-label="Category"
        value={query.category ?? ""}
        onChange={(category) => onChange({ category })}
      >
        <option value="">All categories</option>
        {AUTOMATION_RECIPE_CATEGORY_ORDER.filter((cat) => filterOptions.categories.includes(cat)).map(
          (cat) => (
            <option key={cat} value={cat}>
              {AUTOMATION_RECIPE_CATEGORY_LABELS[cat] ?? cat}
            </option>
          ),
        )}
      </FilterSelect>
      <FilterSelect
        aria-label="Bucket"
        value={query.bucket ?? ""}
        onChange={(bucket) => onChange({ bucket })}
      >
        <option value="">All buckets</option>
        {filterOptions.buckets.map((bucket) => (
          <option key={bucket} value={bucket}>
            {AUTOMATION_RECIPE_BUCKET_LABELS[bucket] ?? bucket}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        aria-label="Signal"
        value={query.signal ?? ""}
        onChange={(signal) => onChange({ signal })}
      >
        <option value="">All signals</option>
        {filterOptions.signals.map((signal) => (
          <option key={signal} value={signal}>
            {AUTOMATION_RECIPE_SIGNAL_LABELS[signal] ?? signal}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        aria-label="Vertical"
        value={query.vertical ?? ""}
        onChange={(vertical) => onChange({ vertical })}
      >
        <option value="">All verticals</option>
        {filterOptions.verticals.map((vertical) => (
          <option key={vertical} value={vertical}>
            {AUTOMATION_RECIPE_VERTICAL_LABELS[vertical] ?? vertical}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        aria-label="Execution"
        value={query.execution ?? ""}
        onChange={(execution) => onChange({ execution: execution as AutomationRecipeListQuery["execution"] })}
      >
        <option value="">Any execution</option>
        <option value="meta-only">{AUTOMATION_RECIPE_EXECUTION_LABELS["meta-only"]}</option>
        <option value="full-aiseo">{AUTOMATION_RECIPE_EXECUTION_LABELS["full-aiseo"]}</option>
      </FilterSelect>
    </div>
  );
}
