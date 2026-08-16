import { notify } from "@/lib/app-notifications";
import { NOTIFY_COULD_NOT_SAVE_SITES_TO_LOCAL_STORAGE } from "@/lib/notify-messages";
import { loadManagerSettingsFromCloud } from "@/lib/manager-cloud-settings-api";
import { applyManagerCloudSnapshotToLocalStorage } from "@/lib/manager-cloud-settings-snapshot";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import { isOptimizationPackageTier } from "@/lib/wordpress-optimization-package";
import { wordPressSiteHostKey } from "@/lib/wordpress-site-host-key";
import type { WordPressSite } from "./types";
import { WORDPRESS_SITES_STORAGE_KEY } from "./types";

const ACTIVE_WP_SITE_STORAGE_KEY = "neo-pulse-active-wp-site-id";

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
 * Writes the same WordPress credentials the app uses (Integrations) to server/data/neo-pulse-wordpress-sites.json
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
      gbpLocationId: s.gbpLocationId,
      ga4PropertyId: s.ga4PropertyId,
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

/** Drop large sitemap payloads (urls, postMetadata) that can exceed localStorage quota. Keeps childSitemaps + endpoints. */
export function slimSiteForLocalStorage(site: WordPressSite): WordPressSite {
  if (!site.sitemaps) return site;
  const {
    urls: _urls,
    postMetadata: _postMetadata,
    ...sitemapRest
  } = site.sitemaps;
  return { ...site, sitemaps: sitemapRest };
}

/** Credentials + config only when slim payload still exceeds quota. */
export function minimalSiteForLocalStorage(site: WordPressSite): WordPressSite {
  const slim = slimSiteForLocalStorage(site);
  return {
    id: slim.id,
    name: slim.name,
    siteUrl: slim.siteUrl,
    productionSiteUrl: slim.productionSiteUrl,
    username: slim.username,
    appPassword: slim.appPassword,
    connectedAt: slim.connectedAt,
    lastTested: slim.lastTested,
    connectionStatus: slim.connectionStatus,
    capabilities: slim.capabilities,
    enabled: slim.enabled,
    entitySitemapUrl: slim.entitySitemapUrl,
    manualEndpoint: slim.manualEndpoint,
    ga4PropertyId: slim.ga4PropertyId,
    gbpLocationId: slim.gbpLocationId,
    semrushSiteAuditProjectId: slim.semrushSiteAuditProjectId,
    editorialCountsPeriodStartYmd: slim.editorialCountsPeriodStartYmd,
    optimizationPackage: slim.optimizationPackage,
    industryVertical: slim.industryVertical,
    benchmarkCustomTag: slim.benchmarkCustomTag,
    pluginAccessToken: slim.pluginAccessToken,
    slackEnabledForProperty: slim.slackEnabledForProperty,
    slackChannelId: slim.slackChannelId,
    slackChannelName: slim.slackChannelName,
    slackIncomingWebhookUrl: slim.slackIncomingWebhookUrl,
    slackMentionSnippet: slim.slackMentionSnippet,
    slackConnectionStatus: slim.slackConnectionStatus,
    slackLastTestAt: slim.slackLastTestAt,
    postBankEnabled: slim.postBankEnabled,
    wpEngineHost: slim.wpEngineHost,
    wpEnginePort: slim.wpEnginePort,
    wpEngineUsername: slim.wpEngineUsername,
    wpEnginePassword: slim.wpEnginePassword,
    wpEngineDomain: slim.wpEngineDomain,
    wpEngineIsStaging: slim.wpEngineIsStaging,
    sitemaps: slim.sitemaps
      ? {
          mainSitemapUrl: slim.sitemaps.mainSitemapUrl,
          detectedAt: slim.sitemaps.detectedAt,
          type: slim.sitemaps.type,
          disabledChildSitemapUrls: slim.sitemaps.disabledChildSitemapUrls,
          childSitemaps: slim.sitemaps.childSitemaps,
          endpoints: slim.sitemaps.endpoints,
        }
      : undefined,
    scheduledPosts: slim.scheduledPosts,
  };
}

function tryPersistSitesJson(json: string): boolean {
  try {
    localStorage.setItem(WORDPRESS_SITES_STORAGE_KEY, json);
    return true;
  } catch (e) {
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22)) {
      return false;
    }
    throw e;
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
  void syncWordPressSitesToServer(sites);
  try {
    const fullJson = JSON.stringify(sites);
    if (tryPersistSitesJson(fullJson)) return;

    const slimJson = JSON.stringify(sites.map(slimSiteForLocalStorage));
    if (tryPersistSitesJson(slimJson)) {
      console.warn(
        "[Integrations] Saved slim WordPress sites (omitted sitemap URLs/post metadata) due to localStorage quota.",
      );
      return;
    }

    const minimalJson = JSON.stringify(sites.map(minimalSiteForLocalStorage));
    if (tryPersistSitesJson(minimalJson)) {
      console.warn(
        "[Integrations] Saved minimal WordPress sites (credentials + config only) due to localStorage quota.",
      );
      return;
    }

    console.warn(
      "Failed to save WordPress sites to localStorage (quota exceeded even after slimming). Session and server sync are unchanged.",
    );
    notify.error(NOTIFY_COULD_NOT_SAVE_SITES_TO_LOCAL_STORAGE);
  } catch (e) {
    console.error("Failed to save WordPress sites:", e);
    notify.error(NOTIFY_COULD_NOT_SAVE_SITES_TO_LOCAL_STORAGE);
  }
}

/** Load property mirror from WordPress (sites.json). */
export async function fetchWordPressSitesMirror(): Promise<WordPressSite[]> {
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  const path = "/api/manager-wordpress-properties/load";
  const url = base ? `${base}${path}` : path;
  try {
    const res = await fetch(`${url}?_=${Date.now()}`, { credentials: "include", cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({}))) as { sites?: WordPressSite[] };
    return Array.isArray(data.sites) ? data.sites : [];
  } catch {
    return [];
  }
}

function findMirrorSiteRow(local: WordPressSite, serverSites: WordPressSite[]): WordPressSite | undefined {
  const byId = serverSites.find((s) => s.id === local.id);
  if (byId) return byId;
  const host = wordPressSiteHostKey(local.siteUrl);
  if (!host) return undefined;
  return serverSites.find((s) => wordPressSiteHostKey(s.siteUrl) === host);
}

/** Merge server-mirrored gbpLocationId / ga4PropertyId onto local sites when the browser copy is missing them. */
export async function mergeServerGbpLocationIdsIntoLocalSites(): Promise<boolean> {
  const serverSites = await fetchWordPressSitesMirror();
  if (serverSites.length === 0) return false;

  const local = getStoredSites();
  if (local.length === 0) return false;

  let changed = false;
  const merged = local.map((site) => {
    const row = findMirrorSiteRow(site, serverSites);
    if (!row) return site;
    let next = site;
    const gbp = row.gbpLocationId?.trim();
    const ga4 = row.ga4PropertyId?.trim();
    if (gbp && !site.gbpLocationId?.trim()) {
      next = { ...next, gbpLocationId: gbp };
      changed = true;
    }
    if (ga4 && !site.ga4PropertyId?.trim()) {
      next = { ...next, ga4PropertyId: ga4 };
      changed = true;
    }
    return next;
  });
  if (!changed) return false;
  saveSites(merged);
  return true;
}

/** Merge server-mirrored WP Engine SFTP credentials onto local sites. */
export async function mergeServerWpEngineCredentialsIntoLocalSites(): Promise<boolean> {
  const serverSites = await fetchWordPressSitesMirror();
  if (serverSites.length === 0) return false;

  const local = getStoredSites();
  if (local.length === 0) return false;

  let changed = false;
  const merged = local.map((site) => {
    const row = findMirrorSiteRow(site, serverSites);
    if (!row?.wpEngineHost?.trim()) return site;
    const patch = {
      wpEngineHost: row.wpEngineHost,
      wpEnginePort: row.wpEnginePort,
      wpEngineUsername: row.wpEngineUsername,
      wpEnginePassword: row.wpEnginePassword,
      wpEngineDomain: row.wpEngineDomain,
      wpEngineIsStaging: row.wpEngineIsStaging,
    };
    const same =
      site.wpEngineHost === patch.wpEngineHost &&
      site.wpEnginePort === patch.wpEnginePort &&
      site.wpEngineUsername === patch.wpEngineUsername &&
      site.wpEnginePassword === patch.wpEnginePassword &&
      site.wpEngineDomain === patch.wpEngineDomain &&
      site.wpEngineIsStaging === patch.wpEngineIsStaging;
    if (same) return site;
    changed = true;
    return { ...site, ...patch };
  });
  if (!changed) return false;
  saveSites(merged);
  return true;
}

export function hasUsableLocalSites(sites: WordPressSite[]): boolean {
  return sites.some((s) => Boolean(s.siteUrl?.trim() && s.username?.trim()));
}

/** Restore properties from server mirror when local is empty or stale vs server. */
export async function restoreSitesFromServerMirrorIfEmpty(): Promise<WordPressSite[]> {
  const local = getStoredSites();
  const mirror = await fetchWordPressSitesMirror();
  if (mirror.length === 0) return local;
  if (hasUsableLocalSites(local) && local.length >= mirror.length) return local;
  saveSites(mirror);
  const persisted = getStoredSites();
  return hasUsableLocalSites(persisted) ? persisted : mirror;
}

/** First visit on a new origin: pull server sites.json into localStorage when empty. */
export async function hydrateLocalSitesFromServerMirrorIfEmpty(): Promise<boolean> {
  const before = hasUsableLocalSites(getStoredSites());
  const restored = await restoreSitesFromServerMirrorIfEmpty();
  return restored.length > 0 && !before;
}

/** After sites hydrate, restore manager cloud snapshot when browser storage is fresh. Never overwrites properties. */
export async function hydrateManagerCloudSettingsIfEmpty(): Promise<boolean> {
  if (!hasUsableLocalSites(getStoredSites())) return false;
  try {
    if (localStorage.getItem(WORDPRESS_SITES_STORAGE_KEY) == null) return false;
  } catch {
    return false;
  }
  const { snapshot } = await loadManagerSettingsFromCloud();
  if (!snapshot) return false;
  const keys = { ...snapshot.keys };
  delete keys[WORDPRESS_SITES_STORAGE_KEY];
  const result = applyManagerCloudSnapshotToLocalStorage({ ...snapshot, keys });
  return result.keyCount > 0 && !result.error;
}

/** Boot hook for new domains (e.g. neodigital.ca/app). */
export async function hydrateLocalAppStateFromServerIfEmpty(): Promise<{
  sitesHydrated: boolean;
  cloudHydrated: boolean;
}> {
  await restoreSitesFromServerMirrorIfEmpty();
  const sitesHydrated = getStoredSites().length > 0;
  const cloudHydrated = sitesHydrated ? await hydrateManagerCloudSettingsIfEmpty() : false;
  return { sitesHydrated, cloudHydrated };
}

