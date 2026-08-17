import { tasksApi } from "@/lib/tasks-api";

export type AutomationActionBlockFilters = {
  categories?: string[];
  verticals?: string[];
  buckets?: string[];
  execution?: string[];
};

export type AutomationBlockCatalogItem = {
  keyword: string;
  name: string;
  description?: string;
  kind?: string;
  executionKind?: string;
  defaults?: Record<string, unknown>;
  filters?: AutomationActionBlockFilters;
};

export async function fetchAutomationTriggerBlocks(
  teamId: number,
): Promise<AutomationBlockCatalogItem[]> {
  const res = await tasksApi(`/teams/${teamId}/tasks/automation-blocks/triggers`);
  const data = (await res.json()) as { ok?: boolean; blocks?: AutomationBlockCatalogItem[] };
  return data.blocks ?? [];
}

export async function fetchAutomationActionBlocks(
  teamId: number,
): Promise<AutomationBlockCatalogItem[]> {
  const res = await tasksApi(`/teams/${teamId}/tasks/automation-blocks/actions`);
  const data = (await res.json()) as { ok?: boolean; blocks?: AutomationBlockCatalogItem[] };
  return data.blocks ?? [];
}
