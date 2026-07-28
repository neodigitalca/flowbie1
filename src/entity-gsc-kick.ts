/** First client operation: mirror active site to server and fire GSC before React loads. */
const ACTIVE_WP_SITE_STORAGE_KEY = "flowbie-active-wp-site-id";
const WORDPRESS_SITES_STORAGE_KEY = "wordpress_sites";
const ENTITY_SITE_WARM_GSC_ROW_LIMIT = 100;

function defaultGscDateRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() - 3);
  const startDate = new Date(endDate);
  startDate.setMonth(endDate.getMonth() - 3);
  return {
    startDate: startDate.toISOString().split("T")[0]!,
    endDate: endDate.toISOString().split("T")[0]!,
  };
}

type StoredSite = {
  id?: string;
  name?: string;
  siteUrl?: string;
  username?: string;
  appPassword?: string;
  enabled?: boolean;
  optimizationPackage?: string;
  editorialCountsPeriodStartYmd?: string;
  entitySitemapUrl?: string;
  manualEndpoint?: string;
};

function resolveActiveSite(): { siteUrl: string | null; activeId: string | null; sites: StoredSite[] } {
  try {
    const raw = localStorage.getItem(WORDPRESS_SITES_STORAGE_KEY);
    if (!raw) return { siteUrl: null, activeId: null, sites: [] };
    const sites = JSON.parse(raw) as StoredSite[];
    if (!Array.isArray(sites) || sites.length === 0) return { siteUrl: null, activeId: null, sites: [] };
    const enabled = sites.filter((s) => s.enabled !== false);
    const pool = enabled.length > 0 ? enabled : sites;
    const activeId = localStorage.getItem(ACTIVE_WP_SITE_STORAGE_KEY);
    const site =
      (activeId ? pool.find((s) => s.id === activeId) : undefined) ?? pool[0];
    const url = site?.siteUrl?.trim();
    return {
      siteUrl: url || null,
      activeId: activeId ?? site?.id ?? null,
      sites,
    };
  } catch {
    return { siteUrl: null, activeId: null, sites: [] };
  }
}

function backendBase(): string {
  const fromEnv = import.meta.env.VITE_MCP_API_BASE?.replace("/api/mcp", "");
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://127.0.0.1:3001";
  return "";
}

function syncDashboardMirrorToServer(activeId: string | null, sites: StoredSite[]) {
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

  const base = backendBase();
  const syncUrl = base
    ? `${base}/api/integrations/sync-wordpress-sites`
    : "/api/integrations/sync-wordpress-sites";

  void fetch(syncUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ sites: minimal, activeSiteId: activeId }),
  }).catch(() => {});
}

const { siteUrl, activeId, sites } = resolveActiveSite();

if (activeId && sites.length > 0) {
  syncDashboardMirrorToServer(activeId, sites);
}

if (siteUrl) {
  const { startDate, endDate } = defaultGscDateRange();
  const base = backendBase();
  const url = base ? `${base}/api/gsc/fetch-queries` : "/api/gsc/fetch-queries";
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      siteUrl,
      startDate,
      endDate,
      rowLimit: ENTITY_SITE_WARM_GSC_ROW_LIMIT,
    }),
  }).catch(() => {});
}
