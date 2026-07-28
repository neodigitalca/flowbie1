/**
 * Entity Endpoint Extractor
 * Extracts WordPress REST API endpoint directly from entity sitemap URL
 * NO normalization, NO sanitization - uses exactly as extracted
 */

import { isChildSitemapExcludedFromProperty } from "@/lib/wordpress-property-sitemaps";

/**
 * Extracts endpoint from entity sitemap URL
 * Example: "service-areas-sitemap.xml" → "service-areas"
 * Example: "posts-sitemap.xml" → "posts"
 * 
 * @param entitySitemapUrl - The entity sitemap URL (e.g., "https://site.com/service-areas-sitemap.xml")
 * @returns The endpoint string exactly as extracted, or "posts" as default fallback
 */
export function extractEndpointFromEntitySitemapUrl(entitySitemapUrl: string): string {
  if (!entitySitemapUrl || !entitySitemapUrl.trim()) {
    return 'posts'; // Default fallback only
  }

  // Extract filename from URL
  const sitemapFilename = entitySitemapUrl.split('/').pop() || '';
  
  // Remove sitemap suffix (e.g., "-sitemap.xml" or "_sitemap.xml")
  const endpoint = sitemapFilename.replace(/[-_]sitemap\.xml$/i, '');
  
  // Return exactly as extracted - NO normalization
  return endpoint || 'posts'; // Fallback only if extraction fails
}

const GENERIC_WP_REST_COLLECTIONS = new Set(["posts", "post", "pages", "page"]);

/**
 * True when the property's selected entity sitemap URL is excluded in the
 * Sitemaps tab (`site.sitemaps.disabledChildSitemapUrls`). Use this to grey the entity
 * count and skip entity REST fetches even though a `manualEndpoint` may still be configured.
 */
export function isEntitySitemapDisabled(
  site:
    | { entitySitemapUrl?: string; sitemaps?: { disabledChildSitemapUrls?: string[] } }
    | null
    | undefined,
): boolean {
  const url = site?.entitySitemapUrl?.trim();
  if (!url) return false;
  return isChildSitemapExcludedFromProperty(site, url);
}

/**
 * True when the post lives in the same REST collection as the site's configured entity sitemap
 * (e.g. service-areas-sitemap.xml → wp/v2/service-areas). Blog `posts` / `pages` never match,
 * so bulk runs over post sitemaps do not get entity prompts just because a property has an entity sitemap.
 */
export function restCollectionMatchesEntitySitemap(
  site: { entitySitemapUrl?: string } | null | undefined,
  postTypeEndpoint: string | undefined | null,
): boolean {
  const entUrl = site?.entitySitemapUrl?.trim();
  if (!entUrl) return false;
  const entityEp = extractEndpointFromEntitySitemapUrl(entUrl).toLowerCase().trim();
  if (!entityEp || GENERIC_WP_REST_COLLECTIONS.has(entityEp)) return false;
  const ep = String(postTypeEndpoint ?? "").toLowerCase().trim();
  if (!ep) return false;
  return ep === entityEp;
}/**
 * Maps user "has entity" / auto to a value safe for this URL's post type.
 * Non-entity CPT URLs always get false so location/entity prompts are not applied site-wide in bulk.
 */
export function effectiveHasEntityForContentOptimizer(
  site: { entitySitemapUrl?: string } | null | undefined,
  postTypeEndpoint: string | undefined | null,
  userPreference: boolean | undefined,
): boolean | undefined {
  const matches = restCollectionMatchesEntitySitemap(site, postTypeEndpoint);
  if (userPreference === false) return false;
  if (!matches) return false;
  if (userPreference === true) return true;
  return undefined;
}
