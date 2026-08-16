import { useEffect } from "react";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { hydrateLocalAppStateFromServerIfEmpty } from "@/components/integrations/storage";

/** Pull wordpress_sites from neodigital.ca server mirror when mobile localStorage is empty. */
export function MobileSitesHydrate(): null {
  const { reloadSitesFromStorage } = useWordPressSites();

  useEffect(() => {
    let cancelled = false;
    void hydrateLocalAppStateFromServerIfEmpty().then(() => {
      if (!cancelled) reloadSitesFromStorage();
    });
    return () => {
      cancelled = true;
    };
  }, [reloadSitesFromStorage]);

  return null;
}
