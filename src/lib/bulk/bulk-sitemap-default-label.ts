import type { BulkRowSitemapType, BulkSitemapMode } from "@/lib/bulk/bulk-sitemap-mode";

export function bulkSitemapDefaultLabel(sitemapType: BulkRowSitemapType): string {
  return sitemapType === "entity" ? "Entity" : "Posts";
}

export function bulkSitemapModeLabel(mode: BulkSitemapMode): string {
  if (mode === "custom") return "Custom";
  return bulkSitemapDefaultLabel(mode);
}

export function resolveBulkSitemapDefaultLabel(args: {
  siteConfigs: Record<string, { sitemapType: BulkSitemapMode }>;
  selectedWordPressSites: ReadonlySet<string>;
  entitySitemapAvailable?: boolean;
}): string {
  const siteId = Array.from(args.selectedWordPressSites)[0];
  const configured = siteId ? args.siteConfigs[siteId]?.sitemapType : undefined;
  const type: BulkSitemapMode =
    configured ??
    (args.entitySitemapAvailable ? "entity" : "post");
  return bulkSitemapModeLabel(type);
}
