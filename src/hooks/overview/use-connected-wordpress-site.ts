import { useMemo } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import { getStoredSites } from "@/components/integrations/storage";

/**
 * Returns the currently \"connected\" WordPress site for the Overview tab.
 * - Prefers the site with enabled === true
 * - Falls back to the first stored site if none are explicitly enabled
 */
export function useConnectedWordPressSite(): WordPressSite | null {
  const site = useMemo(() => {
    try {
      const sites = getStoredSites();
      if (!sites.length) return null;

      const enabled = sites.find((s) => s.enabled !== false);
      return enabled ?? sites[0];
    } catch {
      return null;
    }
  }, []);

  return site ?? null;
}

