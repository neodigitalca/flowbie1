import type { AutomationPlan } from "@/lib/automation-planner-types";
import { automationPlanToWorkflowGraph } from "@/lib/workflow/workflow-migrate-from-planner";
import type { WorkflowDefinition } from "@/lib/workflow/workflow-types";

export const GRID_TO_ENTITY_PAGES_RECIPE_KEYWORD = "grid-to-entity-pages-monthly";

export function buildGridToEntityPagesWorkflowDraft(
  teamId: number,
  siteId?: string | null,
): Omit<WorkflowDefinition, "id" | "createdAt" | "updatedAt" | "publishedAt"> {
  const plan: AutomationPlan = {
    name: "Grid to entity pages",
    description: "Export Local Dominator grid, then create scheduled entity pages from grid locations.",
    trigger: {
      keyword: "schedule-monthly",
      kind: "calendar",
      frequency: "monthly",
      startDate: new Date().toISOString().slice(0, 10),
      time: "09:00",
      targetBucket: "sap",
    },
    action: {
      keyword: "local-dominator-grid-export",
      executionKind: "local_dominator_export",
      executionPayload: {
        businessName: "",
        keyword: "auto",
        saveLocalArchive: true,
        saveToDisk: true,
      },
      title: "Export Local Dominator grid CSV",
    },
    actions: [
      {
        keyword: "local-dominator-grid-export",
        executionKind: "local_dominator_export",
        executionPayload: {
          businessName: "",
          keyword: "auto",
          saveLocalArchive: true,
          saveToDisk: true,
        },
        title: "Export Local Dominator grid CSV",
      },
      {
        keyword: "entity-page-creator-monthly",
        executionKind: "entity_page_creator",
        executionPayload: {
          locationSource: "grid",
          gridInputSource: "workflow",
          ragInputKeys: ["local_dominator_export_1"],
          entityAdGroupCount: 3,
          entityAdsPerGroup: 5,
          entityPageCount: 15,
          postCount: 15,
          focusKeyword: "",
          titleTemplate: "{keyword} Near {entity}",
          sitemapType: "entity",
          featuredImage: false,
          postDestination: "wordpress",
          scheduleTimesPerMonth: 15,
          scheduleCustomInterval: 15,
          scheduleStartDay: 1,
          scheduleStartTime: "09:00",
          scheduleStaggerOptimized: true,
          targetBucket: "sap",
          saveLocalArchive: true,
        },
        title: "Create entity pages from grid",
      },
    ],
  };

  return automationPlanToWorkflowGraph(plan, { teamId, siteId });
}
