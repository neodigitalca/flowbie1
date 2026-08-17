import React, { useMemo } from "react";
import { Copy, MoreHorizontal, Trash2, Users, Zap } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";
import {
  workflowKindBadgeClass,
  workflowStepCardClass,
} from "@/components/manager/workflow/forge-workflow-styles";
import { forgeClientColorUnique } from "@/lib/pulse-forge/forge-client-colors";
import { defaultNodeLabel } from "@/lib/workflow/workflow-graph-utils";
import type { WorkflowClientConfig, WorkflowNode } from "@/lib/workflow/workflow-types";
import { isWorkflowClientKind, isWorkflowTriggerKind, workflowTriggerLabel } from "@/lib/workflow/workflow-types";

export type WorkflowStepCardProps = {
  node: WorkflowNode;
  stepNumber: number;
  selected?: boolean;
  sites?: WordPressSiteOption[];
  onSelect: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
};

export function WorkflowStepCard({
  node,
  stepNumber,
  selected = false,
  sites = [],
  onSelect,
  onDelete,
  onDuplicate,
}: WorkflowStepCardProps): React.ReactElement {
  const recipeCategory = (node.config as { recipeCategory?: string }).recipeCategory;
  const executionKind = (node.config as { executionKind?: string }).executionKind;
  const clientConfig = node.config as WorkflowClientConfig;
  const primaryClientSiteId = clientConfig.siteIds?.[0];
  const kindLabel = isWorkflowTriggerKind(node.kind)
    ? workflowTriggerLabel(node.kind)
    : isWorkflowClientKind(node.kind)
      ? workflowTriggerLabel(node.kind)
      : defaultNodeLabel(node.kind);

  const clientSiteSummary = useMemo(() => {
    if (!isWorkflowClientKind(node.kind)) return null;
    const siteIds = clientConfig.siteIds ?? [];
    if (siteIds.length === 0) return "No sites selected";
    if (siteIds.length === 1) {
      const site = sites.find((item) => item.id === siteIds[0]);
      return site?.name ?? "1 site";
    }
    return `${siteIds.length} sites`;
  }, [clientConfig.siteIds, node.kind, sites]);

  const primaryTitle = useMemo(() => {
    if (isWorkflowClientKind(node.kind)) {
      const label = node.label.trim();
      if (label && label !== kindLabel) return label;
      return clientSiteSummary ?? kindLabel;
    }
    return node.label;
  }, [clientSiteSummary, kindLabel, node.kind, node.label]);

  const secondaryLine = useMemo(() => {
    if (!isWorkflowClientKind(node.kind)) return executionKind ?? null;
    const label = node.label.trim();
    if (label && label !== kindLabel && clientSiteSummary && clientSiteSummary !== label) {
      return clientSiteSummary;
    }
    return null;
  }, [clientSiteSummary, executionKind, kindLabel, node.kind, node.label]);

  return (
    <div
      className={workflowStepCardClass({
        kind: node.kind,
        selected,
        recipeCategory,
        clientSiteId: primaryClientSiteId,
      })}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-start gap-2">
        {onDelete ? (
          <button
            type="button"
            className="mt-0.5 shrink-0 bg-black p-2 text-muted-foreground hover:text-red-400"
            aria-label={`Delete ${node.label}`}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          <div className="mt-0.5 w-10 shrink-0" aria-hidden />
        )}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center bg-black shadow-tile">
            {isWorkflowClientKind(node.kind) ? (
              <Users className={cnIcon(node.kind, primaryClientSiteId)} aria-hidden />
            ) : (
              <Zap className={cnIcon(node.kind)} aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-base text-muted-foreground">Step {stepNumber}</span>
              <span className={workflowKindBadgeClass(node.kind, primaryClientSiteId)}>{kindLabel}</span>
            </div>
            <p className="text-base font-semibold text-white">{primaryTitle}</p>
            {secondaryLine ? (
              <p className="mt-1 truncate text-base text-muted-foreground">{secondaryLine}</p>
            ) : null}
          </div>
        </div>
        {onDuplicate ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="shrink-0 bg-black p-2 text-muted-foreground hover:text-white"
                aria-label="Step menu"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-950 text-base">
              <DropdownMenuItem className="text-base" onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

function cnIcon(kind: WorkflowNode["kind"], clientSiteId?: string): string {
  if (isWorkflowClientKind(kind)) {
    return `h-4 w-4 ${forgeClientColorUnique(clientSiteId).textClass}`;
  }
  if (isWorkflowTriggerKind(kind)) return "h-4 w-4 text-[hsl(var(--semantic-warning))]";
  if (kind === "rag_archive") return "h-4 w-4 text-[hsl(var(--semantic-data))]";
  return "h-4 w-4 text-primary";
}
