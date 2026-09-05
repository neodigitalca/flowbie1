import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import { readSapEntityFromInventory } from "@/hooks/content-optimization/continue-optimization-entity-helpers";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";

export type ResolveOverviewPlaceEntityParams = {
  row: OverviewRow;
  site: WordPressSite;
  sitemapSource?: OverviewSitemapSource;
  urlEntities?: Record<string, string>;
  apiKey?: string;
};

/** SAP entity pages only; Posts/Pages return undefined. Entity from inventory row only. */
export async function resolveOverviewPlaceEntityForRow(
  params: ResolveOverviewPlaceEntityParams,
): Promise<string | undefined> {
  const { row, site, sitemapSource, urlEntities } = params;
  if (sitemapSource !== "sap") return undefined;

  const url = row.url?.trim();
  if (!url) return undefined;

  const entity = readSapEntityFromInventory(site, url, undefined, undefined, urlEntities);
  if (entity) return entity;

  const fromRow = (row.focusKeyword || row.title || "").trim();
  return fromRow || undefined;
}
