import {
  normalizeMatch,
  type BulkOptimizerInventorySnapshot,
  type InventoryLookupMaps,
} from "@/lib/wordpress-api/inventory-match";
import { isOverviewUtilityPage } from "@/lib/overview/overview-utility-page-filter";

export type ExtraTextInventoryLinkRow = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  link: string;
  date_gmt: string;
  postType: "post" | "page";
};

function rowsFromInventoryMaps(
  maps: InventoryLookupMaps | undefined,
  postType: "post" | "page",
): ExtraTextInventoryLinkRow[] {
  if (!maps) return [];
  const out: ExtraTextInventoryLinkRow[] = [];
  for (const row of maps.byLink.values()) {
    const link = String(row.url ?? "").trim();
    if (!link) continue;
    const title = String(row.fields?.title ?? "").trim();
    if (
      postType === "page" &&
      isOverviewUtilityPage({ url: link, slug: row.slug, title })
    ) {
      continue;
    }
    out.push({
      id: Number(row.id) || 0,
      slug: String(row.slug ?? ""),
      title: title || String(row.slug ?? ""),
      excerpt: String(row.fields?.excerpt ?? ""),
      link,
      date_gmt: String(row.date_gmt ?? ""),
      postType,
    });
  }
  return out;
}

/** Posts + pages (+ optional CPT maps) from bulk optimizer inventory snapshot. */
export function buildWordPressPostsForLinkingFromInventory(
  snapshot: BulkOptimizerInventorySnapshot,
  siteUrl: string,
  options?: { postsPagesOnly?: boolean },
): ExtraTextInventoryLinkRow[] {
  const byNorm = new Map<string, ExtraTextInventoryLinkRow>();
  const add = (row: ExtraTextInventoryLinkRow) => {
    const key = normalizeMatch(siteUrl, row.link);
    if (!key) return;
    if (!byNorm.has(key)) byNorm.set(key, row);
  };
  for (const row of rowsFromInventoryMaps(snapshot.postsMaps, "post")) add(row);
  for (const row of rowsFromInventoryMaps(snapshot.pagesMaps, "page")) add(row);
  if (!options?.postsPagesOnly) {
    for (const maps of Object.values(snapshot.customMapsByCollection ?? {})) {
      for (const row of rowsFromInventoryMaps(maps, "page")) add(row);
    }
  }
  return [...byNorm.values()];
}

/** Pages bucket only (for entity What We Offer table links). */
export function buildWordPressPagesForLinkingFromInventory(
  snapshot: BulkOptimizerInventorySnapshot,
  siteUrl: string,
): ExtraTextInventoryLinkRow[] {
  const byNorm = new Map<string, ExtraTextInventoryLinkRow>();
  for (const row of rowsFromInventoryMaps(snapshot.pagesMaps, "page")) {
    const key = normalizeMatch(siteUrl, row.link);
    if (key && !byNorm.has(key)) byNorm.set(key, row);
  }
  return [...byNorm.values()];
}
