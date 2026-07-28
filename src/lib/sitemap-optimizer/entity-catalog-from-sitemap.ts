import type { WordPressSite } from "@/components/integrations/types";
import { parseSitemap } from "@/lib/wordpress-api";
import {
  postIdFromInventoryRow,
  urlPathTail,
} from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import { entityEndpointFromSite } from "@/lib/sitemap-optimizer/entity-compression-profile";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function titleFromEntityUrl(url: string): string {
  const slug = urlPathTail(url);
  if (!slug) return url.trim();
  try {
    const decoded = decodeURIComponent(slug).trim();
    return decoded.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  } catch {
    return slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }
}

export type FetchEntityCatalogFromSitemapResult =
  | { ok: true; rows: SitemapOptimizerPostRow[] }
  | { ok: false; error: string };

/**
 * Entity inventory from a single entity sitemap XML request (no per-post REST pagination).
 */
export async function fetchEntityCatalogFromSitemap(
  site: WordPressSite,
  restCollection: string,
): Promise<FetchEntityCatalogFromSitemapResult> {
  const entityUrl = site.entitySitemapUrl?.trim();
  if (!entityUrl) {
    return {
      ok: false,
      error: "Entity sitemap URL is required. Set it in Integrations for this site.",
    };
  }

  const user = site.username?.trim();
  const pass = site.appPassword?.trim();

  try {
    const result = await parseSitemap(
      site.siteUrl,
      entityUrl,
      user || undefined,
      pass || undefined,
    );
    const urls = Array.isArray(result?.urls)
      ? [
          ...new Set(
            result.urls.map((u) => String(u || "").trim()).filter((u) => u.length > 0),
          ),
        ]
      : [];

    if (!urls.length) {
      return { ok: false, error: "No URLs found in entity sitemap." };
    }

    const collection = restCollection.trim() || entityEndpointFromSite(site) || "entity";
    const rows: SitemapOptimizerPostRow[] = urls.map((url) => {
      const slug = urlPathTail(url);
      const title = titleFromEntityUrl(url);
      return {
        postId: postIdFromInventoryRow({ url, slug }),
        url,
        slug,
        collection,
        title,
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscQueries: [],
        gscFetched: false,
      };
    });

    return { ok: true, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "Failed to parse entity sitemap." };
  }
}
