import { cn } from "@/lib/utils";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_SELECT,
  BULK_HEADER_TOOL_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  FORGE_RECIPE_CARD_TILE_CLASS,
  recipeCardClassName,
  recipeCategoryFrameClass,
  recipeCategoryLabelClass,
} from "@/components/manager/pulse-forge/forge-recipe-styles";
import {
  FORGE_CLIENT_TILE_ACCENT_WIDTH_CLASS,
  forgeClientColorUnique,
} from "@/lib/pulse-forge/forge-client-colors";
import { findClientNode, findTriggerNode } from "@/lib/workflow/workflow-graph-utils";
import type { WorkflowDefinition, WorkflowStatus } from "@/lib/workflow/workflow-types";
import { workflowTriggerLabel } from "@/lib/workflow/workflow-types";
import {
  getPropertyListRowBlackIconButtonClass,
  getPropertyListRowIconButtonHoverGlowClass,
} from "@/components/integrations/wordpress/cyberpunk-theme";
import type { WorkflowNodeKind } from "@/lib/workflow/workflow-types";
import { isWorkflowTriggerKind } from "@/lib/workflow/workflow-types";

export const WORKFLOW_HEADER_BAND_CLASS =
  "flex h-11 w-full shrink-0 items-center gap-1.5 bg-black px-3 sm:px-3.5";

export const WORKFLOW_HEADER_NAME_CLASS = cn(
  BULK_HEADER_FIELD,
  "h-8 min-h-8 min-w-0 flex-1 px-2 font-normal",
);

export const WORKFLOW_HEADER_TOOL_BTN = BULK_HEADER_TOOL_BTN;

export const WORKFLOW_HEADER_RUN_BTN = BULK_HEADER_RUN_BTN;

export const WORKFLOW_HEADER_SELECT_CLASS = cn(
  BULK_HEADER_SELECT,
  "h-8 min-w-[12rem] shrink-0 [color-scheme:dark]",
);

export const WORKFLOW_BUILDER_CANVAS_CLASS = "h-full min-h-0 flex-1 overflow-y-auto bg-black";
export const WORKFLOW_COLUMN_CLASS = "mx-auto flex w-full max-w-[480px] flex-col items-center py-8";
export const WORKFLOW_CONNECTOR_CLASS = "h-8 w-px bg-primary/40";
export const WORKFLOW_RIGHT_RAIL_CLASS =
  "flex w-[min(540px,34vw)] min-w-[480px] shrink-0 flex-col border-l border-white/10 bg-black shadow-tile";

export const WORKFLOW_INSERT_BTN_CLASS = cn(
  getPropertyListRowBlackIconButtonClass(true),
  getPropertyListRowIconButtonHoverGlowClass("powerOn"),
  "h-10 w-10 shrink-0",
);

export function workflowStepCardClass(options: {
  kind: WorkflowNodeKind;
  selected?: boolean;
  recipeCategory?: string;
  clientSiteId?: string;
}): string {
  const { kind, selected, recipeCategory, clientSiteId } = options;
  const accent =
    recipeCategory != null
      ? recipeCategoryFrameClass(recipeCategory)
      : kind === "workflow_client"
        ? cn(
            FORGE_CLIENT_TILE_ACCENT_WIDTH_CLASS,
            forgeClientColorUnique(clientSiteId).borderClass,
          )
        : isWorkflowTriggerKind(kind)
          ? "border-l-[length:var(--tile-accent-width)] border-l-[hsl(var(--semantic-warning))]"
          : kind === "path_rules"
            ? "border-l-[length:var(--tile-accent-width)] border-l-[hsl(280_65%_58%)]"
            : kind === "rag_archive"
              ? "border-l-[length:var(--tile-accent-width)] border-l-[hsl(var(--semantic-data))]"
              : "border-l-[length:var(--tile-accent-width)] border-l-primary";

  return cn(
    FORGE_RECIPE_CARD_TILE_CLASS,
    "w-full cursor-pointer p-4 text-left transition-shadow",
    accent,
    selected && "ring-1 ring-primary shadow-tile-pop",
  );
}

export function workflowKindBadgeClass(kind: WorkflowNodeKind, clientSiteId?: string): string {
  if (kind === "workflow_client") return forgeClientColorUnique(clientSiteId).textClass;
  if (isWorkflowTriggerKind(kind)) return "text-[hsl(var(--semantic-warning-foreground))]";
  if (kind === "rag_archive") return "text-[hsl(var(--semantic-data-foreground))]";
  if (kind === "path_rules") return "text-[hsl(280_65%_72%)]";
  return "text-primary";
}

export const WORKFLOW_RAIL_TAB_CLASS =
  "flex-1 bg-zinc-900/50 px-6 py-4 text-base font-normal text-muted-foreground hover:text-white data-[active=true]:bg-zinc-800/60 data-[active=true]:text-primary";

export const WORKFLOW_INSPECTOR_TILE_CLASS =
  "flex h-full flex-col gap-6 overflow-y-auto bg-black px-6 py-6 pb-10";
export const WORKFLOW_INSPECTOR_GROUP_CLASS =
  "flex flex-col gap-4 rounded-none bg-zinc-900/50 p-5";
export const WORKFLOW_INSPECTOR_GROUP_TITLE_CLASS = "text-base font-normal text-white";
export const WORKFLOW_INSPECTOR_FIELD_GRID_CLASS = "grid grid-cols-1 gap-4";
export const WORKFLOW_INSPECTOR_FIELD_CELL_CLASS =
  "flex min-h-12 min-w-0 flex-col justify-center rounded-none bg-zinc-800/40 px-4 py-3";
export const WORKFLOW_INSPECTOR_TITLE_INPUT_CLASS = cn(
  BULK_HEADER_FIELD,
  "h-8 min-h-8 w-full px-2 font-normal",
);
export const WORKFLOW_INSPECTOR_INFIELD_CLASS =
  "flex min-h-12 w-full items-center rounded-none bg-zinc-800/40 px-4 py-3 text-base font-normal";
export const WORKFLOW_INSPECTOR_KIND_HEADER_CLASS = "flex flex-col gap-4 pb-2";
export const WORKFLOW_INSPECTOR_KIND_LABEL_CLASS = "text-base font-normal tracking-wide";

export const WORKFLOW_FORM_FLAT_CONTROL_CLASS =
  "h-8 min-h-8 w-full min-w-0 rounded-none border-0 bg-transparent p-0 text-base font-normal text-white shadow-none outline-none ring-0 focus-visible:ring-0";

export const WORKFLOW_FORM_SELECT_TRIGGER_CLASS =
  "h-8 min-h-8 rounded-none border-0 bg-transparent p-0 text-base font-normal text-white shadow-none focus:ring-0 focus:ring-offset-0";

export const WORKFLOW_FORM_SELECT_ITEM_CLASS =
  "text-base font-normal text-white focus:bg-[#09090B] focus:text-white";

export const WORKFLOW_FORM_SELECT_CONTENT_CLASS =
  "border-0 bg-[#000] text-base text-white shadow-lg";

function workflowAccentCategory(status: WorkflowStatus): string {
  return status === "published" ? "editorial" : "research";
}

export function workflowStatusLabel(status: WorkflowStatus): string {
  return status === "published" ? "Published" : "Draft";
}

export function workflowCardClassName(status: WorkflowStatus, selected = false): string {
  return recipeCardClassName(workflowAccentCategory(status), selected);
}

export function workflowStatusLabelClass(status: WorkflowStatus): string {
  return recipeCategoryLabelClass(workflowAccentCategory(status));
}

export function workflowCardSummary(workflow: Pick<WorkflowDefinition, "description" | "nodes">): string {
  const description = workflow.description?.trim();
  if (description) return description;
  const stepCount = workflow.nodes.length;
  if (stepCount === 0) {
    return "No steps yet. Open to add triggers, agents, and actions.";
  }
  return `${stepCount} step${stepCount === 1 ? "" : "s"}`;
}

export function workflowClientSiteIds(workflow: Pick<WorkflowDefinition, "nodes" | "wordpressSiteId">): string[] {
  const client = findClientNode(workflow);
  if (client) {
    const siteIds = (client.config as { siteIds?: string[] }).siteIds;
    if (siteIds?.length) return siteIds;
  }
  return workflow.wordpressSiteId ? [workflow.wordpressSiteId] : [];
}

export function workflowMatchesClientFilter(
  workflow: Pick<WorkflowDefinition, "nodes" | "wordpressSiteId">,
  clientId: string,
): boolean {
  if (!clientId) return true;
  const siteIds = workflowClientSiteIds(workflow);
  return siteIds.includes(clientId) || workflow.wordpressSiteId === clientId;
}

export function workflowCardTags(workflow: WorkflowDefinition): string[] {
  const tags = ["Workflow", workflowStatusLabel(workflow.status)];
  const stepCount = workflow.nodes.length;
  tags.push(`${stepCount} step${stepCount === 1 ? "" : "s"}`);
  const trigger = findTriggerNode(workflow);
  if (trigger) tags.push(workflowTriggerLabel(trigger.kind));
  return tags;
}

export type WorkflowListSection = {
  status: WorkflowStatus;
  label: string;
  workflows: WorkflowDefinition[];
};

export function groupWorkflowsByStatus(workflows: WorkflowDefinition[]): WorkflowListSection[] {
  const draft = workflows.filter((workflow) => workflow.status !== "published");
  const published = workflows.filter((workflow) => workflow.status === "published");
  const sections: WorkflowListSection[] = [];
  if (draft.length > 0) {
    sections.push({ status: "draft", label: "Draft", workflows: draft });
  }
  if (published.length > 0) {
    sections.push({ status: "published", label: "Published", workflows: published });
  }
  return sections;
}
