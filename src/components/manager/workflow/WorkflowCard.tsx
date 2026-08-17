import React, { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";
import {
  getPropertyListRowBlackIconButtonClass,
  getPropertyListRowIconButtonHoverGlowClass,
} from "@/components/integrations/wordpress/cyberpunk-theme";
import {
  workflowCardClassName,
  workflowCardSummary,
  workflowCardTags,
  workflowClientSiteIds,
  workflowStatusLabel,
  workflowStatusLabelClass,
} from "@/components/manager/workflow/forge-workflow-styles";
import type { WorkflowDefinition } from "@/lib/workflow/workflow-types";

export type WorkflowCardProps = {
  workflow: WorkflowDefinition;
  sites?: WordPressSiteOption[];
  selected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
};

export function WorkflowCard({
  workflow,
  sites = [],
  selected = false,
  onSelect,
  onDelete,
}: WorkflowCardProps): React.ReactElement {
  const statusLabel = workflowStatusLabel(workflow.status);
  const tags = workflowCardTags(workflow);
  const clientLabels = useMemo(() => {
    const siteIds = workflowClientSiteIds(workflow);
    if (siteIds.length === 0) return [];
    return siteIds.map((siteId) => sites.find((site) => site.id === siteId)?.name ?? siteId);
  }, [sites, workflow]);

  return (
    <article className={cn(workflowCardClassName(workflow.status, selected), "flex flex-col gap-3 p-4")}>
      <div className="flex min-w-0 flex-col gap-1">
        <span className={cn("text-base font-medium", workflowStatusLabelClass(workflow.status))}>
          {statusLabel}
        </span>
        <div className="flex min-w-0 items-center gap-1">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
            <h3 className="text-base font-semibold text-white">{workflow.name}</h3>
          </button>
          {onDelete ? (
            <button
              type="button"
              aria-label={`Delete ${workflow.name}`}
              className={cn(
                getPropertyListRowBlackIconButtonClass(true),
                "text-muted-foreground hover:text-red-400",
              )}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <button type="button" className="text-left" onClick={onSelect}>
        <p className="text-base text-muted-foreground">{workflowCardSummary(workflow)}</p>
      </button>
      <div className="flex flex-wrap gap-2">
        {clientLabels.map((label) => (
          <span key={label} className="bg-black px-2 py-1 text-base text-primary">
            {label}
          </span>
        ))}
        {tags.map((tag, index) => (
          <span
            key={tag}
            className={cn(
              "bg-black px-2 py-1 text-base",
              index === 0 ? "text-white" : "text-muted-foreground",
            )}
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}
