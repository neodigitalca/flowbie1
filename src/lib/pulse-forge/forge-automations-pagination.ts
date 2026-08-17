export const FORGE_AUTOMATIONS_GRID_COLUMNS = 3;
export const FORGE_AUTOMATIONS_GRID_ROWS = 8;
export const FORGE_AUTOMATIONS_PAGE_SIZE =
  FORGE_AUTOMATIONS_GRID_COLUMNS * FORGE_AUTOMATIONS_GRID_ROWS;

export function forgeAutomationsPageCount(totalCount: number): number {
  if (totalCount <= 0) return 1;
  return Math.ceil(totalCount / FORGE_AUTOMATIONS_PAGE_SIZE);
}

export function clampForgeAutomationsPageIndex(pageIndex: number, totalCount: number): number {
  const pageCount = forgeAutomationsPageCount(totalCount);
  return Math.min(Math.max(0, pageIndex), pageCount - 1);
}

export function sliceForgeAutomationsPage<T>(items: T[], pageIndex: number): T[] {
  if (items.length === 0) return items;
  const safePageIndex = clampForgeAutomationsPageIndex(pageIndex, items.length);
  const start = safePageIndex * FORGE_AUTOMATIONS_PAGE_SIZE;
  return items.slice(start, start + FORGE_AUTOMATIONS_PAGE_SIZE);
}
