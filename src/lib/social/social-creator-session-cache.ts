import type { SocialCreatorRow } from "@/lib/social/social-creator-types";

function cacheKey(siteId: string): string {
  return `neo-pulse-social-creator-v2:${siteId}`;
}

const memoryBySiteId = new Map<string, SocialCreatorRow[]>();

function normalizeStoredRow(row: SocialCreatorRow): SocialCreatorRow {
  return {
    ...row,
    status: row.status === "generating" ? "idle" : row.status,
  };
}

export function getSocialCreatorSessionCache(siteId: string): SocialCreatorRow[] | null {
  const mem = memoryBySiteId.get(siteId);
  if (mem?.length) return mem.map(normalizeStoredRow);

  try {
    const raw = sessionStorage.getItem(cacheKey(siteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SocialCreatorRow[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const rows = parsed.filter((row) => row?.id?.trim()).map(normalizeStoredRow);
    if (rows.length) memoryBySiteId.set(siteId, rows);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

export function setSocialCreatorSessionCache(siteId: string, rows: SocialCreatorRow[]): void {
  const snapshot = rows.map(normalizeStoredRow);
  memoryBySiteId.set(siteId, snapshot);
  try {
    sessionStorage.setItem(cacheKey(siteId), JSON.stringify(snapshot));
  } catch {
    // quota or private mode
  }
}

export function clearSocialCreatorSessionCache(siteId: string): void {
  memoryBySiteId.delete(siteId);
  try {
    sessionStorage.removeItem(cacheKey(siteId));
  } catch {
    // ignore
  }
}
