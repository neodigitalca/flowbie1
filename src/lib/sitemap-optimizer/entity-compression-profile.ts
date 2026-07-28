import type { WordPressSite } from "@/components/integrations/types";
import { extractEndpointFromEntitySitemapUrl } from "@/lib/entity-endpoint-extractor";
import {
  blogDestinationPolicyForCollections,
  type BlogDestinationPolicy,
} from "@/lib/sitemap-optimizer/blog-destination-policy";
import type { SitemapOptimizerTrafficFilter } from "@/lib/sitemap-optimizer/enrich-sitemap-optimizer-gsc-import";
import type { SitemapOptimizerCollectionKey } from "@/lib/sitemap-optimizer/types";

export type EntityCompressionProfile = {
  active: boolean;
  entityEndpoint: string;
  entityOnly: boolean;
  trafficFilter: SitemapOptimizerTrafficFilter;
  skipCompanyPartition: boolean;
  skipQueryEnrichment: boolean;
  destinationPolicy: BlogDestinationPolicy;
};

export function entityEndpointFromSite(site: WordPressSite | null | undefined): string {
  const entityUrl = site?.entitySitemapUrl?.trim() ?? "";
  if (!entityUrl) return "";
  const ep = extractEndpointFromEntitySitemapUrl(entityUrl).trim().toLowerCase();
  if (!ep || ep === "posts" || ep === "pages" || ep === "post" || ep === "page") return "";
  return ep;
}

export function isEntityInventoryRow(
  row: { collection: string },
  entityEndpoint: string,
): boolean {
  const ep = entityEndpoint.trim().toLowerCase();
  if (!ep) return false;
  const col = row.collection.trim().toLowerCase();
  if (col === "entity") return true;
  return col === ep;
}

export function shouldSkipQueryEnrichmentForTrafficFilter(
  filter: SitemapOptimizerTrafficFilter,
): boolean {
  return filter === "zero_clicks" || filter === "no_impressions" || filter === "all";
}

export function buildEntityCompressionProfile(args: {
  site: WordPressSite | null | undefined;
  selectedCollections: ReadonlySet<SitemapOptimizerCollectionKey>;
  trafficFilter: SitemapOptimizerTrafficFilter;
  redirectMap?: boolean;
}): EntityCompressionProfile {
  const { site, selectedCollections, trafficFilter, redirectMap = false } = args;

  const entityEndpoint = entityEndpointFromSite(site);
  const active = selectedCollections.has("entity") && Boolean(entityEndpoint);
  const entityOnly =
    active &&
    !selectedCollections.has("posts") &&
    !selectedCollections.has("pages");

  return {
    active,
    entityEndpoint,
    entityOnly,
    trafficFilter,
    skipCompanyPartition: active,
    skipQueryEnrichment: shouldSkipQueryEnrichmentForTrafficFilter(trafficFilter),
    destinationPolicy: blogDestinationPolicyForCollections(selectedCollections, {
      redirectMap,
    }),
  };
}
