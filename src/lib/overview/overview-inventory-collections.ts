import { extractEndpointFromEntitySitemapUrl } from "@/lib/entity-endpoint-extractor";

const GENERIC_WP_COLLECTIONS = new Set(["posts", "post", "pages", "page"]);

function isGenericWpCollection(endpoint: string): boolean {
  return GENERIC_WP_COLLECTIONS.has(endpoint.toLowerCase().trim());
}

/**
 * Which REST collections to prefetch for Overview inventory, inferred from the sitemap URL
 * the user loaded (Yoast / WordPress defaults) and optional site entity sitemap config.
 *
 * Returns wp/v2 collection segments: `posts`, `pages`, or a custom CPT (e.g. `service-area`).
 */
export function overviewInventoryCollectionsFromSitemapUrl(
  sitemapUrl: string,
  site?: { entitySitemapUrl?: string } | null,
): string[] {
  const u = (sitemapUrl || "").toLowerCase();

  if (
    u.includes("post-sitemap") ||
    u.includes("posts-sitemap") ||
    u.includes("news-sitemap") ||
    u.includes("article-sitemap")
  ) {
    return ["posts"];
  }
  if (u.includes("page-sitemap") || u.includes("pages-sitemap")) {
    return ["pages"];
  }

  const leaf = u.split("/").filter(Boolean).pop() ?? "";
  if (leaf === "sitemap.xml" || leaf === "sitemap_index.xml") {
    return ["posts", "pages"];
  }

  const fromLoaded = extractEndpointFromEntitySitemapUrl(sitemapUrl.trim());
  if (fromLoaded && !isGenericWpCollection(fromLoaded)) {
    return [fromLoaded];
  }

  const configured = site?.entitySitemapUrl?.trim();
  if (configured) {
    const normLoaded = sitemapUrl.trim().replace(/\/+$/, "").toLowerCase();
    const normConfigured = configured.replace(/\/+$/, "").toLowerCase();
    if (normLoaded === normConfigured || normLoaded.endsWith(normConfigured.split("/").pop() || "")) {
      const fromSite = extractEndpointFromEntitySitemapUrl(configured);
      if (fromSite && !isGenericWpCollection(fromSite)) {
        return [fromSite];
      }
    }
  }

  if (u.includes("sitemap")) {
    const ep = extractEndpointFromEntitySitemapUrl(sitemapUrl.trim());
    if (ep && !isGenericWpCollection(ep)) {
      return [ep];
    }
  }

  return ["posts", "pages"];
}
