import { tasksApi } from "@/lib/tasks-api";

export type AutomationBlockCatalogItem = {
  keyword: string;
  name: string;
  description?: string;
  kind?: string;
  executionKind?: string;
  defaults?: Record<string, unknown>;
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
