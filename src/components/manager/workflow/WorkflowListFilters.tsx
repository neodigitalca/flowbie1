import React from "react";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";
import { BULK_HEADER_SELECT } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { cn } from "@/lib/utils";

export type WorkflowListFiltersProps = {
  sites: WordPressSiteOption[];
  clientId: string;
  onClientChange: (clientId: string) => void;
  className?: string;
};

export function WorkflowListFilters({
  sites,
  clientId,
  onClientChange,
  className,
}: WorkflowListFiltersProps): React.ReactElement {
  return (
    <div className={cn("flex shrink-0 flex-wrap items-center gap-2 px-4 pt-4 pb-2", className)}>
      <select
        value={clientId}
        onChange={(event) => onClientChange(event.target.value)}
        aria-label="Client"
        className={`${BULK_HEADER_SELECT} h-8 min-w-[12rem] shrink-0 text-base [color-scheme:dark]`}
      >
        <option value="">All clients</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </div>
  );
}
