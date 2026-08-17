import React, { useMemo, useState } from "react";
import { ChevronDown, ListFilter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_SELECT,
  BULK_HEADER_SELECT_TRIGGER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type {
  ForgeAutomationCategory,
  ForgeAutomationFilterOptions,
  ForgeAutomationsListQuery,
  ForgeAutomationsSort,
} from "@/lib/pulse-forge/forge-automations-filters";
import {
  FORGE_AUTOMATION_SORT_OPTIONS,
  FORGE_AUTOMATION_STATUS_FILTER_OPTIONS,
  forgeAutomationCategoryLabel,
  forgeAutomationExecutionKindLabel,
  toggleForgeAutomationQueryValue,
} from "@/lib/pulse-forge/forge-automations-filters";
import {
  FORGE_CLIENT_TILE_ACCENT_WIDTH_CLASS,
  forgeClientColorUnique,
} from "@/lib/pulse-forge/forge-client-colors";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";
import { FORGE_AUTOMATION_TH_CLASS } from "@/lib/pulse-forge/forge-automation-row-meta";
import {
  FORGE_FILTER_MENU_CONTENT_CLASS,
  FORGE_FILTER_MENU_ITEM_CLASS,
  FORGE_TABLE_HEADER_BORDER_CLASS,
  forgeFilterMenuStripeClass,
} from "@/components/manager/pulse-forge/forge-dashboard-styles";
import { cn } from "@/lib/utils";

export type ForgeAutomationsTableHeaderRowProps = {
  query: ForgeAutomationsListQuery;
  filterOptions: ForgeAutomationFilterOptions;
  sites: WordPressSiteOption[];
  onChange: (patch: Partial<ForgeAutomationsListQuery>) => void;
};

const FILTER_BTN_CLASS =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/50 bg-black/30 text-muted-foreground transition-colors hover:border-zinc-500 hover:text-white";

function formatScheduleLabel(schedule: string): string {
  if (!schedule) return schedule;
  return schedule.charAt(0).toUpperCase() + schedule.slice(1);
}

const FORGE_FILTER_TRIGGER_CLASS = cn(
  BULK_HEADER_SELECT_TRIGGER,
  "inline-flex h-8 w-[8.75rem] shrink-0 items-center justify-between gap-1.5 px-2",
);

function ForgeGreyFilterMenu({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(FORGE_FILTER_TRIGGER_CLASS, active && "text-white")}
        >
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={FORGE_FILTER_MENU_CONTENT_CLASS}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ForgeFilterSelect({
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
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      className={`${BULK_HEADER_SELECT} h-8 w-[8.75rem] shrink-0 text-base [color-scheme:dark]`}
    >
      {children}
    </select>
  );
}

function FilterableHeaderCell({
  label,
  active,
  className,
  children,
  menuLabel,
  variant = "header",
}: {
  label: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
  menuLabel: string;
  variant?: "header" | "bar";
}): React.ReactElement {
  const filterButton = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(FILTER_BTN_CLASS, active && "border-zinc-500 text-white")}
          title={`Filter ${label.toLowerCase()}`}
          aria-label={`Filter ${label.toLowerCase()}`}
        >
          <ListFilter className="h-3.5 w-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={FORGE_FILTER_MENU_CONTENT_CLASS}>
        <DropdownMenuLabel className="bg-zinc-950 px-2 py-1.5 text-base font-semibold text-white">
          {menuLabel}
        </DropdownMenuLabel>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (variant === "bar") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <span className="text-base text-white">{label}</span>
        {filterButton}
      </div>
    );
  }

  return (
    <th className={cn(FORGE_AUTOMATION_TH_CLASS, className)}>
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {filterButton}
      </div>
    </th>
  );
}

function SheetValueCheckboxList({
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  stripeOffset = 0,
  accentByValue,
}: {
  options: { value: string; label: string }[];
  selected: Set<string>;
  onToggle: (value: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
  stripeOffset?: number;
  accentByValue?: (value: string) => string | undefined;
}): React.ReactElement {
  return (
    <>
      {options.map((option, index) => {
        const accentClass = accentByValue?.(option.value);
        return (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.has(option.value)}
            onCheckedChange={(checked) => onToggle(option.value, checked === true)}
            onSelect={(event) => event.preventDefault()}
            className={cn(
              FORGE_FILTER_MENU_ITEM_CLASS,
              forgeFilterMenuStripeClass(stripeOffset + index),
              accentClass && FORGE_CLIENT_TILE_ACCENT_WIDTH_CLASS,
              accentClass,
            )}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        );
      })}
      <DropdownMenuSeparator className="bg-white/10" />
      <DropdownMenuItem
        className={cn(FORGE_FILTER_MENU_ITEM_CLASS, forgeFilterMenuStripeClass(stripeOffset + options.length))}
        onSelect={onSelectAll}
      >
        Select all
      </DropdownMenuItem>
      <DropdownMenuItem
        className={cn(
          FORGE_FILTER_MENU_ITEM_CLASS,
          forgeFilterMenuStripeClass(stripeOffset + options.length + 1),
        )}
        onSelect={onClear}
      >
        Clear
      </DropdownMenuItem>
    </>
  );
}

function AutomationColumnFilter({
  query,
  filterOptions,
  onChange,
  variant = "bar",
}: {
  query: ForgeAutomationsListQuery;
  filterOptions: ForgeAutomationFilterOptions;
  onChange: (patch: Partial<ForgeAutomationsListQuery>) => void;
  variant?: "header" | "bar";
}): React.ReactElement {
  const [search, setSearch] = useState("");
  const selectedTitles = useMemo(() => new Set(query.titles ?? []), [query.titles]);
  const selectedKinds = useMemo(() => new Set(query.executionKinds ?? []), [query.executionKinds]);
  const filteredTitles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filterOptions.titles;
    return filterOptions.titles.filter((title) => title.toLowerCase().includes(q));
  }, [filterOptions.titles, search]);

  const titleOptions = filteredTitles.map((title) => ({ value: title, label: title }));
  const kindOptions = filterOptions.executionKinds.map((kind) => ({
    value: kind,
    label: forgeAutomationExecutionKindLabel(kind),
  }));
  const active = Boolean(query.titles?.length || query.executionKinds?.length);

  const menuBody = (
    <>
      <DropdownMenuLabel className="bg-zinc-950 px-2 py-1.5 text-base font-semibold text-white">
        Filter automation
      </DropdownMenuLabel>
      <div className="px-2 pb-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search names"
          aria-label="Search automation names"
          className={cn(BULK_HEADER_FIELD, "h-8 w-full text-base")}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </div>
      <DropdownMenuLabel className="bg-zinc-950 px-2 py-1 text-base text-muted-foreground">Name</DropdownMenuLabel>
      <SheetValueCheckboxList
        options={titleOptions}
        selected={selectedTitles}
        stripeOffset={0}
        onToggle={(value, checked) =>
          onChange({ titles: toggleForgeAutomationQueryValue(query.titles, value, checked) })
        }
        onSelectAll={() => onChange({ titles: [...filterOptions.titles] })}
        onClear={() => onChange({ titles: undefined })}
      />
      {kindOptions.length > 0 ? (
        <>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuLabel className="bg-zinc-950 px-2 py-1 text-base text-muted-foreground">Type</DropdownMenuLabel>
          <SheetValueCheckboxList
            options={kindOptions}
            selected={selectedKinds}
            stripeOffset={titleOptions.length + 2}
            onToggle={(value, checked) =>
              onChange({
                executionKinds: toggleForgeAutomationQueryValue(query.executionKinds, value, checked),
              })
            }
            onSelectAll={() => onChange({ executionKinds: [...filterOptions.executionKinds] })}
            onClear={() => onChange({ executionKinds: undefined })}
          />
        </>
      ) : null}
    </>
  );

  if (variant === "header") {
    return (
      <FilterableHeaderCell
        label="Automation"
        className="w-[14rem]"
        menuLabel="Filter automation"
        active={active}
      >
        {menuBody}
      </FilterableHeaderCell>
    );
  }

  return (
    <ForgeGreyFilterMenu label="Automation" active={active}>
      {menuBody}
    </ForgeGreyFilterMenu>
  );
}

export function ForgeAutomationsFilterBar({
  query,
  filterOptions,
  sites,
  onChange,
  className,
}: ForgeAutomationsTableHeaderRowProps & { className?: string }): React.ReactElement {
  const siteNameById = useMemo(() => new Map(sites.map((site) => [site.id, site.name])), [sites]);
  const selectedCategories = useMemo(() => new Set(query.categories ?? []), [query.categories]);
  const selectedSites = useMemo(() => new Set(query.siteIds ?? []), [query.siteIds]);
  const selectedSchedules = useMemo(() => new Set(query.schedules ?? []), [query.schedules]);
  const selectedStatuses = useMemo(() => new Set(query.statuses ?? []), [query.statuses]);

  const categoryOptions = filterOptions.categories.map((category) => ({
    value: category,
    label: forgeAutomationCategoryLabel(category),
  }));
  const siteOptions = filterOptions.siteIds.map((siteId) => ({
    value: siteId,
    label: siteNameById.get(siteId) ?? siteId,
  }));
  const scheduleOptions = filterOptions.schedules.map((schedule) => ({
    value: schedule,
    label: formatScheduleLabel(schedule),
  }));
  const sortValue = query.sort ?? "recent";

  return (
    <div className={cn("flex shrink-0 flex-nowrap items-center gap-3 bg-black", className)}>
      <ForgeGreyFilterMenu label="Category" active={Boolean(query.categories?.length)}>
        <DropdownMenuLabel className="bg-zinc-950 px-2 py-1.5 text-base font-semibold text-white">
          Filter category
        </DropdownMenuLabel>
        <SheetValueCheckboxList
          options={categoryOptions}
          selected={selectedCategories}
          onToggle={(value, checked) =>
            onChange({
              categories: toggleForgeAutomationQueryValue(query.categories, value as ForgeAutomationCategory, checked),
            })
          }
          onSelectAll={() => onChange({ categories: [...filterOptions.categories] })}
          onClear={() => onChange({ categories: undefined })}
        />
      </ForgeGreyFilterMenu>
      <ForgeGreyFilterMenu label="Site name" active={Boolean(query.siteIds?.length)}>
        <DropdownMenuLabel className="bg-zinc-950 px-2 py-1.5 text-base font-semibold text-white">
          Filter site name
        </DropdownMenuLabel>
        <SheetValueCheckboxList
          options={siteOptions}
          selected={selectedSites}
          accentByValue={(siteId) =>
            forgeClientColorUnique(siteId, siteNameById.get(siteId)).borderClass
          }
          onToggle={(value, checked) =>
            onChange({ siteIds: toggleForgeAutomationQueryValue(query.siteIds, value, checked) })
          }
          onSelectAll={() => onChange({ siteIds: [...filterOptions.siteIds] })}
          onClear={() => onChange({ siteIds: undefined })}
        />
      </ForgeGreyFilterMenu>
      <ForgeGreyFilterMenu label="Schedule" active={Boolean(query.schedules?.length)}>
        <DropdownMenuLabel className="bg-zinc-950 px-2 py-1.5 text-base font-semibold text-white">
          Filter schedule
        </DropdownMenuLabel>
        <SheetValueCheckboxList
          options={scheduleOptions}
          selected={selectedSchedules}
          onToggle={(value, checked) =>
            onChange({ schedules: toggleForgeAutomationQueryValue(query.schedules, value, checked) })
          }
          onSelectAll={() => onChange({ schedules: [...filterOptions.schedules] })}
          onClear={() => onChange({ schedules: undefined })}
        />
      </ForgeGreyFilterMenu>
      <ForgeGreyFilterMenu label="Status" active={Boolean(query.statuses?.length)}>
        <DropdownMenuLabel className="bg-zinc-950 px-2 py-1.5 text-base font-semibold text-white">
          Filter status
        </DropdownMenuLabel>
        <SheetValueCheckboxList
          options={[...FORGE_AUTOMATION_STATUS_FILTER_OPTIONS]}
          selected={selectedStatuses}
          onToggle={(value, checked) =>
            onChange({ statuses: toggleForgeAutomationQueryValue(query.statuses, value, checked) })
          }
          onSelectAll={() =>
            onChange({ statuses: FORGE_AUTOMATION_STATUS_FILTER_OPTIONS.map((option) => option.value) })
          }
          onClear={() => onChange({ statuses: undefined })}
        />
      </ForgeGreyFilterMenu>
      <ForgeFilterSelect
        aria-label="Sort automations"
        value={sortValue}
        onChange={(value) =>
          onChange({ sort: (value as ForgeAutomationsSort) || undefined })
        }
      >
        {FORGE_AUTOMATION_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </ForgeFilterSelect>
    </div>
  );
}

export function ForgeAutomationsTableHeaderRow({
  query,
  filterOptions,
  sites,
  onChange,
}: ForgeAutomationsTableHeaderRowProps): React.ReactElement {
  const siteNameById = new Map(sites.map((site) => [site.id, site.name]));
  const selectedSites = useMemo(() => new Set(query.siteIds ?? []), [query.siteIds]);
  const selectedSchedules = useMemo(() => new Set(query.schedules ?? []), [query.schedules]);
  const selectedStatuses = useMemo(() => new Set(query.statuses ?? []), [query.statuses]);

  const siteOptions = filterOptions.siteIds.map((siteId) => ({
    value: siteId,
    label: siteNameById.get(siteId) ?? siteId,
  }));
  const scheduleOptions = filterOptions.schedules.map((schedule) => ({
    value: schedule,
    label: formatScheduleLabel(schedule),
  }));

  return (
    <tr className={FORGE_TABLE_HEADER_BORDER_CLASS}>
      <th className={cn(FORGE_AUTOMATION_TH_CLASS, "w-10")}>#</th>
      <th className={cn(FORGE_AUTOMATION_TH_CLASS, "w-6")}>
        <span className="sr-only">Active</span>
      </th>
      <AutomationColumnFilter
        query={query}
        filterOptions={filterOptions}
        onChange={onChange}
        variant="header"
      />
      <FilterableHeaderCell
        label="Site"
        className="w-[9rem]"
        menuLabel="Filter site"
        active={Boolean(query.siteIds?.length)}
      >
        <SheetValueCheckboxList
          options={siteOptions}
          selected={selectedSites}
          accentByValue={(siteId) =>
            forgeClientColorUnique(siteId, siteNameById.get(siteId)).borderClass
          }
          onToggle={(value, checked) =>
            onChange({ siteIds: toggleForgeAutomationQueryValue(query.siteIds, value, checked) })
          }
          onSelectAll={() => onChange({ siteIds: [...filterOptions.siteIds] })}
          onClear={() => onChange({ siteIds: undefined })}
        />
      </FilterableHeaderCell>
      <FilterableHeaderCell
        label="Schedule"
        className="w-[6.5rem]"
        menuLabel="Filter schedule"
        active={Boolean(query.schedules?.length)}
      >
        <SheetValueCheckboxList
          options={scheduleOptions}
          selected={selectedSchedules}
          onToggle={(value, checked) =>
            onChange({ schedules: toggleForgeAutomationQueryValue(query.schedules, value, checked) })
          }
          onSelectAll={() => onChange({ schedules: [...filterOptions.schedules] })}
          onClear={() => onChange({ schedules: undefined })}
        />
      </FilterableHeaderCell>
      <th className={cn(FORGE_AUTOMATION_TH_CLASS, "w-[5rem]")}>Compare</th>
      <th className={cn(FORGE_AUTOMATION_TH_CLASS, "w-[6.5rem]")}>Exec time</th>
      <th className={cn(FORGE_AUTOMATION_TH_CLASS, "w-[5.5rem]")} title="Time (Edmonton)">
        TDE
      </th>
      <FilterableHeaderCell
        label="Status"
        className="w-[5rem]"
        menuLabel="Filter status"
        active={Boolean(query.statuses?.length)}
      >
        <SheetValueCheckboxList
          options={[...FORGE_AUTOMATION_STATUS_FILTER_OPTIONS]}
          selected={selectedStatuses}
          onToggle={(value, checked) =>
            onChange({ statuses: toggleForgeAutomationQueryValue(query.statuses, value, checked) })
          }
          onSelectAll={() =>
            onChange({ statuses: FORGE_AUTOMATION_STATUS_FILTER_OPTIONS.map((option) => option.value) })
          }
          onClear={() => onChange({ statuses: undefined })}
        />
      </FilterableHeaderCell>
      <th className={cn(FORGE_AUTOMATION_TH_CLASS, "w-[5rem]")}>Runs</th>
      <th className={cn(FORGE_AUTOMATION_TH_CLASS, "w-[7.5rem]")}>
        <span className="sr-only">Actions</span>
      </th>
    </tr>
  );
}
