import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Server } from "lucide-react";
import { notify } from "@/lib/app-notifications";
import { getStoredSites } from "@/components/integrations/storage";
import type { WordPressSite } from "@/components/integrations/types";
import {
  DASHBOARD_SETTINGS_GROUP_CLASS,
  DASHBOARD_SETTINGS_PANEL_CLASS,
} from "@/components/manager/dashboard/dashboard-panel-styles";
import { siteHasWpEngineCredentials } from "@/lib/wpengine-site-match";
import { deployNeoPulseWpPlugin, fetchWpEngineCatalogStatus } from "@/lib/wpengine-api";

type RowDeployState = "idle" | "deploying" | "ok" | "error";

export function WpEngineSettingsContent() {
  const [sites, setSites] = useState<WordPressSite[]>(() => getStoredSites());
  const [catalogStatus, setCatalogStatus] = useState<Awaited<ReturnType<typeof fetchWpEngineCatalogStatus>>>(null);
  const [batchDeploying, setBatchDeploying] = useState(false);
  const [rowState, setRowState] = useState<Record<string, RowDeployState>>({});

  const refreshCatalog = useCallback(async () => {
    setCatalogStatus(await fetchWpEngineCatalogStatus());
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const credentialedSites = sites.filter((s) => siteHasWpEngineCredentials(s));

  const handleDeployOne = useCallback(async (site: WordPressSite) => {
    setRowState((prev) => ({ ...prev, [site.id]: "deploying" }));
    const result = await deployNeoPulseWpPlugin(site);
    setRowState((prev) => ({
      ...prev,
      [site.id]: result.ok ? "ok" : "error",
    }));
    if (!result.ok) {
      notify.error(result.error || `Upload failed for ${site.name}`);
    }
  }, []);

  const handleDeployAll = useCallback(async () => {
    if (sites.length === 0) return;
    setBatchDeploying(true);
    setRowState({});
    try {
      for (const site of sites) {
        await handleDeployOne(site);
      }
    } finally {
      setBatchDeploying(false);
    }
  }, [handleDeployOne, sites]);

  return (
    <div className={`${DASHBOARD_SETTINGS_PANEL_CLASS} space-y-4`} aria-labelledby="wp-engine-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-white" aria-hidden />
          <h2 id="wp-engine-heading" className="text-base font-semibold text-white">
            WP Engine
          </h2>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10 border-0 bg-black text-base text-white hover:bg-black hover:text-white"
          onClick={() => void handleDeployAll()}
        >
          {batchDeploying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Upload to all
        </Button>
      </div>

      <div className={DASHBOARD_SETTINGS_GROUP_CLASS}>
        <p className="text-base text-white">
          {credentialedSites.length} properties with SFTP credentials
          {catalogStatus?.pluginStaged ? " · neo-pulse-wp staged on server" : " · run neodigital deploy to stage plugin"}
        </p>
      </div>

      <div className={`${DASHBOARD_SETTINGS_GROUP_CLASS} overflow-x-auto`}>
        <table className="w-full min-w-[720px] border-collapse text-base text-white">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Property</th>
              <th className="pb-2 pr-4 font-medium">SFTP host</th>
              <th className="pb-2 pr-4 font-medium">Username</th>
              <th className="pb-2 pr-4 font-medium">Password</th>
              <th className="pb-2 font-medium">Upload</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => {
              const state = rowState[site.id] ?? "idle";
              return (
                <tr key={site.id} className="border-t border-white/10">
                  <td className="py-2 pr-4">{site.name}</td>
                  <td className="py-2 pr-4 font-mono">{site.wpEngineHost ?? "—"}</td>
                  <td className="py-2 pr-4 font-mono">{site.wpEngineUsername ?? "—"}</td>
                  <td className="py-2 pr-4 font-mono">{site.wpEnginePassword ?? "—"}</td>
                  <td className="py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 text-base text-white hover:bg-white/10"
                      onClick={() => void handleDeployOne(site)}
                    >
                      {state === "deploying" ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : state === "ok" ? (
                        "Done"
                      ) : state === "error" ? (
                        "Retry"
                      ) : (
                        "Upload"
                      )}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
