import { notify } from "@/lib/app-notifications";
import { NOTIFY_COULD_NOT_SAVE_SITES_TO_LOCAL_STORAGE } from "@/lib/notify-messages";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import { isOptimizationPackageTier } from "@/lib/wordpress-optimization-package";
import { WORDPRESS_SITES_STORAGE_KEY, type WordPressSite } from "./types";

const ACTIVE_WP_SITE_STORAGE_KEY = "flowbie-active-wp-site-id";

/** Shallow-sorted copy for cloud backup; preserves each site `id` and does not mutate the live list order. */
export function sortWordPressSitesByName(sites: WordPressSite[]): WordPressSite[] {
  return [...sites].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }),
  );
}

function readActiveSiteIdFromStorage(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WP_SITE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Writes the same WordPress credentials the app uses (Integrations) to server/data/flowbie-wordpress-sites.json
 * so the Flo email worker can use them without a manual file or CLI.
 */
export async function syncWordPressSitesToServer(sites: WordPressSite[]): Promise<void> {
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  const path = "/api/integrations/sync-wordpress-sites";
  const url = base ? `${base}${path}` : path;
  const minimal = sites
    .map((s) => ({
      id: s.id,
      name: s.name,
      siteUrl: s.siteUrl,
      username: s.username,
      appPassword: s.appPassword,
      optimizationPackage: s.optimizationPackage,
      editorialCountsPeriodStartYmd: s.editorialCountsPeriodStartYmd,
      entitySitemapUrl: s.entitySitemapUrl,
      manualEndpoint: s.manualEndpoint,
    }))
    .filter((s) => s.siteUrl?.trim() && s.username?.trim() && s.appPassword?.trim());
  const activeSiteId = readActiveSiteIdFromStorage();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sites: minimal, activeSiteId }),
    });
    if (!res.ok) {
      console.warn("[Integrations] Server sync failed:", res.status);
    }
  } catch (e) {
    console.warn("[Integrations] Server sync error:", e);
  }
}

/** Mirror dashboard active site id to server so boot warm targets the correct property. */
export async function syncActiveWordPressSiteToServer(activeSiteId: string | null): Promise<void> {
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  const path = "/api/integrations/sync-active-wp-site";
  const url = base ? `${base}${path}` : path;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ activeSiteId }),
    });
    if (!res.ok) {
      console.warn("[Integrations] Active site sync failed:", res.status);
    }
  } catch (e) {
    console.warn("[Integrations] Active site sync error:", e);
  }
}

export function getStoredSites(): WordPressSite[] {
  try {
    const stored = localStorage.getItem(WORDPRESS_SITES_STORAGE_KEY);
    if (stored) {
      const sites = JSON.parse(stored) as WordPressSite[];
      // Migrate wp-sitemap.xml URLs to sitemap_index.xml
      const migrated = sites.map(site => {
        const migratedSite = {
          ...site,
          enabled: site.enabled !== undefined ? site.enabled : true
        };
        
        // Convert wp-sitemap.xml to sitemap_index.xml if it exists
        if (migratedSite.sitemaps?.mainSitemapUrl?.includes('/wp-sitemap.xml')) {
          console.log(`[Migration] Converting wp-sitemap.xml to sitemap_index.xml for site: ${site.name}`);
          migratedSite.sitemaps.mainSitemapUrl = migratedSite.sitemaps.mainSitemapUrl.replace('/wp-sitemap.xml', '/sitemap_index.xml');
        }

        const rawPkg = migratedSite.optimizationPackage?.trim();
        if (rawPkg && isOptimizationPackageTier(rawPkg)) {
          migratedSite.optimizationPackage = rawPkg;
        } else {
          delete migratedSite.optimizationPackage;
        }

        return migratedSite;
      });
      
      // Save migrated sites back to localStorage if any changes were made
      if (JSON.stringify(migrated) !== JSON.stringify(sites)) {
        localStorage.setItem(WORDPRESS_SITES_STORAGE_KEY, JSON.stringify(migrated));
      }
      
      return migrated;
    }
  } catch (e) {
    console.error("Failed to parse stored WordPress sites:", e);
  }
  return [];
}

export function saveSites(sites: WordPressSite[]): void {
  try {
    localStorage.setItem(WORDPRESS_SITES_STORAGE_KEY, JSON.stringify(sites));
    void syncWordPressSitesToServer(sites);
  } catch (e) {
    console.error("Failed to save WordPress sites:", e);
    notify.error(NOTIFY_COULD_NOT_SAVE_SITES_TO_LOCAL_STORAGE);
  }
}

