import {
  normalizeContentCalendarRow,
  type ContentCalendarRow,
} from "@/lib/social/content-creator-types";

function cacheKey(siteId: string): string {
  return `neo-pulse-content-creator-v3:${siteId}`;
}

const memoryBySiteId = new Map<string, ContentCalendarRow[]>();

function normalizeStoredRow(row: ContentCalendarRow): ContentCalendarRow {
  const normalized = normalizeContentCalendarRow({
    ...row,
    status: row.status === "generating" ? "idle" : row.status,
  });
  if (
    normalized.status === "error" &&
    normalized.errorMessage === "e.trim is not a function"
  ) {
    return { ...normalized, status: "idle", errorMessage: undefined };
  }
  return normalized;
}

export function getContentCreatorSessionCache(siteId: string): ContentCalendarRow[] | null {
  const mem = memoryBySiteId.get(siteId);
  if (mem?.length) return mem.map(normalizeStoredRow);

  try {
    const raw = sessionStorage.getItem(cacheKey(siteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContentCalendarRow[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const rows = parsed
      .filter((row) => typeof row?.id === "string" && row.id.length > 0)
      .map(normalizeStoredRow);
    if (rows.length) memoryBySiteId.set(siteId, rows);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

export function setContentCreatorSessionCache(siteId: string, rows: ContentCalendarRow[]): void {
  const snapshot = rows.map(normalizeStoredRow);
  memoryBySiteId.set(siteId, snapshot);
  try {
    sessionStorage.setItem(cacheKey(siteId), JSON.stringify(snapshot));
  } catch {
    // quota or private mode
  }
}

export function clearContentCreatorSessionCache(siteId: string): void {
  memoryBySiteId.delete(siteId);
  try {
    sessionStorage.removeItem(cacheKey(siteId));
  } catch {
    // ignore
  }
}
