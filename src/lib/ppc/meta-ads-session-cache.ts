import type { MetaAdRow } from "@/lib/ppc/meta-ads-types";

function cacheKey(siteId: string): string {
  return `neo-pulse-ppc-meta-ads-v3:${siteId}`;
}

const memoryBySiteId = new Map<string, MetaAdRow[]>();

function normalizeStoredRow(row: MetaAdRow): MetaAdRow {
  return {
    ...row,
    status: row.status === "generating" ? "idle" : row.status,
  };
}

export function getPpcMetaAdsSessionCache(siteId: string): MetaAdRow[] | null {
  const mem = memoryBySiteId.get(siteId);
  if (mem?.length) return mem.map(normalizeStoredRow);

  try {
    const raw = sessionStorage.getItem(cacheKey(siteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MetaAdRow[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const rows = parsed.filter((row) => row?.id?.trim()).map(normalizeStoredRow);
    if (rows.length) memoryBySiteId.set(siteId, rows);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

export function setPpcMetaAdsSessionCache(siteId: string, rows: MetaAdRow[]): void {
  const snapshot = rows.map(normalizeStoredRow);
  memoryBySiteId.set(siteId, snapshot);
  try {
    sessionStorage.setItem(cacheKey(siteId), JSON.stringify(snapshot));
  } catch {
    // quota or private mode
  }
}

export function clearPpcMetaAdsSessionCache(siteId: string): void {
  memoryBySiteId.delete(siteId);
  try {
    sessionStorage.removeItem(cacheKey(siteId));
  } catch {
    // ignore
  }
}
