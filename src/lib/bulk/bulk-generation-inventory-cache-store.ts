import type { WordPressSite } from "@/components/integrations/types";
import type { SiteInventoryBulkRow } from "@/lib/wordpress-api/types";
import type { OverviewParallelInventoryResult } from "@/lib/overview/overview-parallel-inventory-fetch";

export type BulkGenerationWpInventory = {
  siteId: string;
  rows: SiteInventoryBulkRow[];
  fetchedAt: number;
  error?: string;
};

const cacheBySiteId = new Map<string, BulkGenerationWpInventory>();

export function getBulkGenerationWpInventoryIfReady(siteId: string): SiteInventoryBulkRow[] | null {
  const cached = cacheBySiteId.get(siteId);
  if (!cached || cached.error || !(cached.rows?.length ?? 0)) return null;
  return cached.rows;
}

export function getBulkGenerationWpInventoryEntry(siteId: string): BulkGenerationWpInventory | null {
  const cached = cacheBySiteId.get(siteId);
  return cached ?? null;
}

function inventoryRowKey(row: SiteInventoryBulkRow): string {
  const id = row.id != null && Number(row.id) > 0 ? `id:${row.id}` : "";
  const url = typeof row.url === "string" ? row.url.trim().toLowerCase() : "";
  return id || (url ? `url:${url}` : "");
}

/** Meta-only inventory must not wipe bodies already cached from an includeContent walk. */
export function seedBulkGenerationWpInventoryFromParallel(
  site: WordPressSite,
  parallel: OverviewParallelInventoryResult,
): void {
  if (!parallel.mergedRows.length && Object.keys(parallel.errors).length > 0) {
    const errText = Object.values(parallel.errors).join(" · ");
    cacheBySiteId.set(site.id, {
      siteId: site.id,
      rows: [],
      fetchedAt: Date.now(),
      error: errText || "No inventory rows returned.",
    });
    return;
  }
  const prev = cacheBySiteId.get(site.id);
  const prevByKey = new Map<string, SiteInventoryBulkRow>();
  for (const row of prev?.rows ?? []) {
    const key = inventoryRowKey(row);
    if (key) prevByKey.set(key, row);
  }
  const rows = (parallel.mergedRows as SiteInventoryBulkRow[]).map((row) => {
    const incoming = String(row.fields?.content ?? "").trim();
    if (incoming) return row;
    const key = inventoryRowKey(row);
    const old = key ? prevByKey.get(key) : undefined;
    const kept = String(old?.fields?.content ?? "").trim();
    if (!kept || !old?.fields) return row;
    return {
      ...row,
      fields: { ...old.fields, ...row.fields, content: old.fields.content },
    };
  });
  cacheBySiteId.set(site.id, {
    siteId: site.id,
    rows,
    fetchedAt: Date.now(),
  });
}

export function seedBulkGenerationWpInventoryFromBundle(
  site: WordPressSite,
  bundle: { bulkInventoryRows?: SiteInventoryBulkRow[]; fetchedAt: number; error?: string },
): void {
  if (bundle.error) {
    cacheBySiteId.set(site.id, {
      siteId: site.id,
      rows: [],
      fetchedAt: bundle.fetchedAt,
      error: bundle.error,
    });
    return;
  }
  if (!(bundle.bulkInventoryRows?.length ?? 0)) return;
  cacheBySiteId.set(site.id, {
    siteId: site.id,
    rows: bundle.bulkInventoryRows!,
    fetchedAt: bundle.fetchedAt,
  });
}

export function clearBulkGenerationWpInventoryCache(siteId?: string): void {
  if (siteId) {
    cacheBySiteId.delete(siteId);
  } else {
    cacheBySiteId.clear();
  }
}

export function setBulkGenerationWpInventoryEntry(entry: BulkGenerationWpInventory): void {
  cacheBySiteId.set(entry.siteId, entry);
}
