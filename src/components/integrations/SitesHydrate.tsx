import { useEffect } from "react";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { restoreSitesFromServerMirrorIfEmpty } from "@/components/integrations/storage";

/** Pull sites.json from server when browser storage is empty or stale after boot. */
export function SitesHydrate(): null {
  const { setSites } = useWordPressSites();

  useEffect(() => {
    let cancelled = false;
    void restoreSitesFromServerMirrorIfEmpty().then((sites) => {
      if (!cancelled && sites.length > 0) setSites(sites);
    });
    return () => {
      cancelled = true;
    };
  }, [setSites]);

  return null;
}
