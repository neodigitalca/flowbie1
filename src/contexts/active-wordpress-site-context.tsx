import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { syncActiveWordPressSiteToServer, syncWordPressSitesToServer, getStoredSites } from "@/components/integrations/storage";
import {
  warmEntitySiteCache,
} from "@/lib/local-analysis/entity-site-warm-cache";

export const ACTIVE_WP_SITE_STORAGE_KEY = "neo-pulse-active-wp-site-id";

type ActiveWordPressSiteContextValue = {
  activeWordPressSiteId: string | null;
  setActiveWordPressSiteId: (id: string | null) => void;
};

const ActiveWordPressSiteContext = createContext<ActiveWordPressSiteContextValue | null>(null);

export function useActiveWordPressSite(): ActiveWordPressSiteContextValue {
  const ctx = useContext(ActiveWordPressSiteContext);
  if (!ctx) {
    throw new Error("useActiveWordPressSite must be used within ActiveWordPressSiteProvider");
  }
  return ctx;
}

/** Shared active integration site id (localStorage-backed). Lives under WordPressSitesProvider. */
export function ActiveWordPressSiteProvider({ children }: { children: ReactNode }) {
  const { sites } = useWordPressSites();
  const enabledSites = useMemo(() => sites.filter((s) => s.enabled !== false), [sites]);
  const siteIdsKey = enabledSites.map((s) => s.id).join(",");

  const [activeWordPressSiteId, setActiveWordPressSiteIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_WP_SITE_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setActiveWordPressSiteId = useCallback((id: string | null) => {
    setActiveWordPressSiteIdState(id);
    try {
      if (id) localStorage.setItem(ACTIVE_WP_SITE_STORAGE_KEY, id);
      else localStorage.removeItem(ACTIVE_WP_SITE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    void syncActiveWordPressSiteToServer(id);
  }, []);

  useEffect(() => {
    const stored = getStoredSites();
    if (stored.length === 0) return;
    void syncWordPressSitesToServer(stored);
  }, []);

  useEffect(() => {
    if (enabledSites.length === 0) {
      setActiveWordPressSiteIdState(null);
      try {
        localStorage.removeItem(ACTIVE_WP_SITE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    setActiveWordPressSiteIdState((current) => {
      const keep = current && enabledSites.some((s) => s.id === current);
      const next = keep ? current : enabledSites[0]!.id;
      if (keep) return current;
      try {
        localStorage.setItem(ACTIVE_WP_SITE_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      void syncActiveWordPressSiteToServer(next);
      return next;
    });
  }, [siteIdsKey]);

  const activeSiteForWarm = useMemo(() => {
    if (enabledSites.length === 0) return null;
    if (activeWordPressSiteId && enabledSites.some((s) => s.id === activeWordPressSiteId)) {
      return enabledSites.find((s) => s.id === activeWordPressSiteId) ?? null;
    }
    return enabledSites[0] ?? null;
  }, [enabledSites, activeWordPressSiteId]);

  useEffect(() => {
    if (!activeSiteForWarm) return;
    warmEntitySiteCache(activeSiteForWarm);
  }, [activeSiteForWarm?.id, activeSiteForWarm?.siteUrl, activeSiteForWarm?.username, activeSiteForWarm?.appPassword]);

  const value = useMemo(
    () => ({ activeWordPressSiteId, setActiveWordPressSiteId }),
    [activeWordPressSiteId, setActiveWordPressSiteId],
  );

  return (
    <ActiveWordPressSiteContext.Provider value={value}>{children}</ActiveWordPressSiteContext.Provider>
  );
}
