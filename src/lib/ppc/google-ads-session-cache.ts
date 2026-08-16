import type { PpcCampaignRow } from "@/lib/ppc/google-ads-types";

function cacheKey(siteId: string): string {
  return `neo-pulse-ppc-google-campaigns-v1:${siteId}`;
}

const memoryBySiteId = new Map<string, PpcCampaignRow[]>();

function normalizeStoredRow(row: PpcCampaignRow): PpcCampaignRow {
  return {
    ...row,
    status: row.status === "generating" ? "idle" : row.status,
  };
}

export function getPpcGoogleCampaignsSessionCache(siteId: string): PpcCampaignRow[] | null {
  const mem = memoryBySiteId.get(siteId);
  if (mem?.length) return mem.map(normalizeStoredRow);

  try {
    const raw = sessionStorage.getItem(cacheKey(siteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PpcCampaignRow[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const rows = parsed.filter((r) => r?.id?.trim()).map(normalizeStoredRow);
    if (rows.length) memoryBySiteId.set(siteId, rows);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

export function setPpcGoogleCampaignsSessionCache(siteId: string, rows: PpcCampaignRow[]): void {
  const snapshot = rows.map(normalizeStoredRow);
  memoryBySiteId.set(siteId, snapshot);
  try {
    sessionStorage.setItem(cacheKey(siteId), JSON.stringify(snapshot));
  } catch {
    // quota or private mode
  }
}

export function clearPpcGoogleCampaignsSessionCache(siteId: string): void {
  memoryBySiteId.delete(siteId);
  try {
    sessionStorage.removeItem(cacheKey(siteId));
  } catch {
    // ignore
  }
}
