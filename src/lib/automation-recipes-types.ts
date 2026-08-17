import type { TaskTemplateTaskDef } from "@/lib/tasks-types";
import type {
  AutomationActionBlock,
  AutomationTriggerBlock,
} from "@/lib/automation-planner-types";

export type AutomationRecipeCategory = "reactive" | "maintenance" | "local-seo" | "onboarding" | "research";

export type AutomationRecipeExecutionFilter = "meta-only" | "full-aiseo";

export type AutomationRecipeBucket = "pages" | "posts" | "sap" | "all";

export type AutomationRecipePrerequisite = "gsc" | "wordpress" | "entity-sitemap";

export type AutomationRecipeFiltersMeta = {
  executionKinds?: string[];
  targetBuckets?: AutomationRecipeBucket[];
  triggerSignals?: string[];
  actionCount?: number;
};

export type AutomationRecipeCatalogItem = {
  keyword: string;
  name: string;
  description: string;
  notes?: string[];
  isAutomation: true;
  category: AutomationRecipeCategory | string;
  verticals: string[];
  tags: string[];
  prerequisites: AutomationRecipePrerequisite[];
  filters: AutomationRecipeFiltersMeta;
  triggerBlock?: AutomationTriggerBlock;
  actionBlock?: AutomationActionBlock;
  actionBlocks?: AutomationActionBlock[];
  defaultTasks?: TaskTemplateTaskDef[];
};

export type AutomationRecipeFilterOptions = {
  categories: string[];
  verticals: string[];
  buckets: string[];
  signals: string[];
};

export type AutomationRecipeListQuery = {
  category?: string;
  bucket?: string;
  execution?: AutomationRecipeExecutionFilter | "";
  signal?: string;
  vertical?: string;
  q?: string;
  includeTasks?: boolean;
};

export type AutomationRecipeListResponse = {
  ok?: boolean;
  recipes?: AutomationRecipeCatalogItem[];
  filters?: AutomationRecipeFilterOptions;
  error?: string;
};
