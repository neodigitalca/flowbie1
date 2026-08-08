import { useCallback, useEffect, useState } from "react";
import { CloudUpload, CloudDownload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/app-notifications";
import {
  NOTIFY_CONFIGURE_SUPABASE_ON_THE_API_SERVER_FIR,
  NOTIFY_SIGN_IN_TO_LOAD_SETTINGS_FROM_THE_CLOUD,
  NOTIFY_SIGN_IN_TO_SAVE_SETTINGS_TO_THE_CLOUD,
  notifyRestoredXKeysFromCloudReloading,
} from "@/lib/notify-messages";
import { useAuth } from "@/contexts/AuthContext";
import { DASHBOARD_SETTINGS_GROUP_CLASS } from "@/components/manager/dashboard/dashboard-panel-styles";
import {
  collectManagerCloudSettingsSnapshot,
  applyManagerCloudSnapshotToLocalStorage,
} from "@/lib/manager-cloud-settings-snapshot";
import {
  getManagerCloudSettingsStatus,
  loadManagerSettingsFromCloud,
  saveManagerSettingsToCloud,
} from "@/lib/manager-cloud-settings-api";

export type ManagerCloudSettingsCardProps = {
  apiKey: string;
  dataForSEOApiKey: string;
  agentMailApiKey: string;
  selectedModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
};

export function ManagerCloudSettingsCard({
  apiKey,
  dataForSEOApiKey,
  agentMailApiKey,
  selectedModel,
  temperature,
  maxTokens,
  topP,
}: ManagerCloudSettingsCardProps) {
  const { user, activeTeam } = useAuth();
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getManagerCloudSettingsStatus>> | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const s = await getManagerCloudSettingsStatus();
    setStatus(s);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSaveToCloud = useCallback(async () => {
    if (!user) {
      notify.error(NOTIFY_SIGN_IN_TO_SAVE_SETTINGS_TO_THE_CLOUD);
      return;
    }
    if (!status?.supabaseConfigured) {
      notify.error(NOTIFY_CONFIGURE_SUPABASE_ON_THE_API_SERVER_FIR);
      return;
    }
    setSaving(true);
    try {
      const snapshot = collectManagerCloudSettingsSnapshot(
        {
          "openrouter-api-key": apiKey,
          "dataforseo-api-key": dataForSEOApiKey,
          "agentmail-api-key": agentMailApiKey,
        },
        { selectedModel, temperature, maxTokens, topP },
      );
      const r = await saveManagerSettingsToCloud(snapshot, activeTeam?.id);
      if (!r.ok) {
        notify.error(r.error || "Cloud save failed");
        return;
      }
      notify.success(
        r.updatedAt
          ? `Settings saved to cloud (${new Date(r.updatedAt).toLocaleString()})`
          : "Settings saved to cloud",
      );
    } finally {
      setSaving(false);
    }
  }, [
    user,
    status?.supabaseConfigured,
    apiKey,
    dataForSEOApiKey,
    agentMailApiKey,
    selectedModel,
    temperature,
    maxTokens,
    topP,
  ]);

  const handleLoadFromCloud = useCallback(async () => {
    if (!user) {
      notify.error(NOTIFY_SIGN_IN_TO_LOAD_SETTINGS_FROM_THE_CLOUD);
      return;
    }
    if (!status?.supabaseConfigured) {
      notify.error(NOTIFY_CONFIGURE_SUPABASE_ON_THE_API_SERVER_FIR);
      return;
    }
    if (!window.confirm("Replace local settings with the last cloud backup? The page will reload.")) {
      return;
    }
    setLoading(true);
    try {
      const r = await loadManagerSettingsFromCloud(activeTeam?.id);
      if (!r.ok || !r.snapshot) {
        notify.error(r.error || "No cloud backup found");
        return;
      }
      const applied = applyManagerCloudSnapshotToLocalStorage(r.snapshot);
      if (applied.error) {
        notify.error(applied.error);
        return;
      }
      notify.success(notifyRestoredXKeysFromCloudReloading(applied.keyCount));
      window.setTimeout(() => window.location.reload(), 400);
    } finally {
      setLoading(false);
    }
  }, [user, status?.supabaseConfigured]);

  const disabled = !user || !status?.supabaseConfigured;
  const host = status?.urlHost;

  return (
    <div className={DASHBOARD_SETTINGS_GROUP_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="font-semibold text-white">Cloud backup</p>
          <p className="text-base text-white">
            Back up API keys, properties, model defaults, and master rules to Supabase
            {host ? (
              <>
                {" "}
                (<span className="font-mono">{host}</span>)
              </>
            ) : null}
            .
          </p>
          {!user ? (
            <p className="text-base text-amber-200">Sign in to use cloud backup.</p>
          ) : !status?.supabaseConfigured ? (
            <p className="text-base text-amber-200">Connect Supabase under Post Bank first.</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 gap-1.5 text-base"
            disabled={disabled || saving}
            onClick={() => void handleSaveToCloud()}
          >
            <CloudUpload className="h-4 w-4" aria-hidden />
            {saving ? "Saving…" : "Save to cloud"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 gap-1.5 text-base"
            disabled={disabled || loading}
            onClick={() => void handleLoadFromCloud()}
          >
            <CloudDownload className="h-4 w-4" aria-hidden />
            {loading ? "Loading…" : "Load from cloud"}
          </Button>
        </div>
      </div>
    </div>
  );
}
