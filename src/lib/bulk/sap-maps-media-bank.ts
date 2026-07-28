import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { entityAdGroupKey } from "@/lib/local-analysis/sap-entity-ad-groups";

/** Run-scoped WordPress media IDs for Google Maps featured images (one upload per site + entity). */
export type SapMapsMediaBank = {
  mediaIdBySiteEntity: Map<string, number>;
};

export function createSapMapsMediaBank(): SapMapsMediaBank {
  return { mediaIdBySiteEntity: new Map() };
}

export function sapMapsSiteEntityKey(siteId: string, entity: string): string {
  return `${siteId}::${entityAdGroupKey(entity)}`;
}

export function getSapMapsMediaId(
  bank: SapMapsMediaBank,
  siteId: string,
  entity: string,
): number | undefined {
  return bank.mediaIdBySiteEntity.get(sapMapsSiteEntityKey(siteId, entity));
}

export function setSapMapsMediaId(
  bank: SapMapsMediaBank,
  siteId: string,
  entity: string,
  mediaId: number,
): void {
  bank.mediaIdBySiteEntity.set(sapMapsSiteEntityKey(siteId, entity), mediaId);
}

/** Count CSV rows that share each location entity (ad-group key). */
export function countSapMapsRowsByEntity(rows: CSVRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const entity = (row.entity ?? "").trim();
    if (!entity || entity === "N/A") continue;
    const key = entityAdGroupKey(entity);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function sapMapsMediaTitleAlt(entity: string): string {
  return `google maps image of ${entity.trim()}`;
}

/** Deterministic filename for Maps featured images (no OpenRouter). */
export function sapMapsImageFileName(entity: string, extension: "jpg" | "png" = "jpg"): string {
  const slug = entity
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const base = slug || "entity";
  return `${base}-google-maps.${extension}`;
}

export function sapMapsReuseProgressLabel(
  entity: string,
  rowCountForEntity: number | undefined,
  reused: boolean,
): string {
  const pages = rowCountForEntity != null && rowCountForEntity > 0 ? rowCountForEntity : 1;
  if (reused) {
    return `Reusing Google Maps image for ${entity.trim()} (${pages} SAP pages share this location)`;
  }
  return `Google Maps for ${entity.trim()} (1 upload, ${pages} SAP pages)`;
}
