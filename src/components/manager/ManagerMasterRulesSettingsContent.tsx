import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { MasterInstructionsSection } from "@/components/integrations/wordpress/MasterInstructionsSection";
import { useAuth } from "@/contexts/AuthContext";
import { WORDPRESS_SITES_STORAGE_KEY, type WordPressSite } from "@/components/integrations/types";
import { NEO_PULSE_MASTER_RULES_PRESET_SITE_ID_KEY } from "@/lib/open-master-rules-settings";
import { DASHBOARD_SETTINGS_PANEL_CLASS } from "@/components/manager/dashboard/dashboard-panel-styles";

function readSitesFromStorage(): WordPressSite[] {
  try {
    const raw = localStorage.getItem(WORDPRESS_SITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as WordPressSite[]) : [];
  } catch {
    return [];
  }
}

export function ManagerMasterRulesSettingsContent() {
  const { user } = useAuth();
  const [sites, setSites] = useState<WordPressSite[]>(() => readSitesFromStorage());
  const [presetSiteId, setPresetSiteId] = useState("");

  const refreshSites = useCallback(() => {
    setSites(readSitesFromStorage());
  }, []);

  useEffect(() => {
    refreshSites();
    const onStorage = (e: StorageEvent) => {
      if (e.key === WORDPRESS_SITES_STORAGE_KEY || e.key === null) refreshSites();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshSites]);

  useEffect(() => {
    let preset = "";
    try {
      preset = sessionStorage.getItem(NEO_PULSE_MASTER_RULES_PRESET_SITE_ID_KEY) ?? "";
    } catch {
      preset = "";
    }
    if (preset) {
      try {
        sessionStorage.removeItem(NEO_PULSE_MASTER_RULES_PRESET_SITE_ID_KEY);
      } catch {
        /* ignore */
      }
      setPresetSiteId(preset);
    }
  }, []);

  const activeSite = useMemo(() => {
    if (presetSiteId) {
      const preset = sites.find((s) => s.id === presetSiteId);
      if (preset) return preset;
    }
    return sites.find((s) => s.enabled !== false) ?? sites[0] ?? null;
  }, [sites, presetSiteId]);

  return (
    <div className={`${DASHBOARD_SETTINGS_PANEL_CLASS} space-y-4 text-white`} aria-labelledby="master-rules-heading">
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-white" aria-hidden />
        <h2 id="master-rules-heading" className="text-base font-semibold text-white">
          Master Rules
        </h2>
      </div>

      {!user ? (
        <p className="text-base text-white">Sign in to load and save master rules.</p>
      ) : sites.length === 0 ? (
        <p className="text-base text-white">Add a property under Properties first.</p>
      ) : activeSite ? (
        <MasterInstructionsSection
          siteId={activeSite.id}
          disabled={activeSite.enabled === false}
        />
      ) : null}
    </div>
  );
}
