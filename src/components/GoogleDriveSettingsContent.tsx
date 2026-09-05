import { useEffect, useState } from "react";
import { CheckCircle, ExternalLink, FolderOpen, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify, notifyHeaderError } from "@/lib/app-notifications";
import { NOTIFY_CLIENT_ID_SHOULD_BE_THE_FULL_VALUE_FROM_, NOTIFY_REDIRECT_URI_COPIED } from "@/lib/notify-messages";
import { backendApiUrl } from "@/lib/wordpress-api/connection";
import {
  BUILTIN_ADVANCED_BLINDS_PRESET,
  listGoogleDriveFolderPresets,
  loadUserGoogleDriveFolderPresets,
  parseGoogleDriveFolderId,
  saveUserGoogleDriveFolderPresets,
  type GoogleDriveFolderPreset,
} from "@/lib/google-drive/google-drive-folder-presets";
import {
  defaultGoogleDriveTeamSettings,
  DEFAULT_TEAM_SHARED_DRIVE_FOLDER_ID,
  type GoogleDriveFolderAlias,
  type GoogleDriveTeamSettings,
} from "@/lib/google-drive/google-drive-folder-hierarchy";
import {
  fetchGoogleDriveTeamSettings,
  readCachedGoogleDriveTeamSettings,
  saveGoogleDriveTeamSettings,
} from "@/lib/google-drive/drive-folder-api";
import {
  openGoogleDriveAuthorize,
  useGoogleDriveConnectionStatus,
} from "@/hooks/use-google-drive-connection-status";

type DriveTestResult = {
  webViewLink?: string;
  folderLink?: string;
  fileName?: string;
};

export function GoogleDriveSettingsContent() {
  const { connected, loading, configured, email, redirectUri, connectionError, refresh } =
    useGoogleDriveConnectionStatus();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [presetLabel, setPresetLabel] = useState("");
  const [presetFolder, setPresetFolder] = useState("");
  const [testResult, setTestResult] = useState<DriveTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [userPresets, setUserPresets] = useState<GoogleDriveFolderPreset[]>(() =>
    loadUserGoogleDriveFolderPresets(),
  );
  const [teamSettings, setTeamSettings] = useState<GoogleDriveTeamSettings>(() =>
    defaultGoogleDriveTeamSettings(),
  );
  const [teamRootInput, setTeamRootInput] = useState("");
  const [teamSettingsLoading, setTeamSettingsLoading] = useState(true);
  const [teamSettingsSaving, setTeamSettingsSaving] = useState(false);
  const folderPresets = listGoogleDriveFolderPresets();

  useEffect(() => {
    let cancelled = false;
    setTeamSettingsLoading(true);
    fetchGoogleDriveTeamSettings()
      .then((settings) => {
        if (cancelled) return;
        setTeamSettings(settings);
        setTeamRootInput(
          settings.teamRootFolderId
            ? `https://drive.google.com/drive/folders/${settings.teamRootFolderId}`
            : "",
        );
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = readCachedGoogleDriveTeamSettings() ?? defaultGoogleDriveTeamSettings();
          setTeamSettings(fallback);
          setTeamRootInput(
            fallback.teamRootFolderId
              ? `https://drive.google.com/drive/folders/${fallback.teamRootFolderId}`
              : "",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setTeamSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clientIdTrimmed = clientId.trim();
  const clientIdLooksValid =
    clientIdTrimmed.length >= 20 && clientIdTrimmed.includes(".apps.googleusercontent.com");

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clientIdTrimmed && !clientIdLooksValid) {
      notify.error(NOTIFY_CLIENT_ID_SHOULD_BE_THE_FULL_VALUE_FROM_);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(backendApiUrl("/google-mcp/test-and-save"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setClientSecret("");
        refresh();
      } else {
        notify.error(data?.error ?? response.statusText ?? "Test and save failed");
      }
    } catch (err) {
      notifyHeaderError("Google Drive credentials save failed", err);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const response = await fetch(backendApiUrl("/google-mcp/test"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: BUILTIN_ADVANCED_BLINDS_PRESET.folderId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.success) {
        setTestResult({
          webViewLink: typeof data.webViewLink === "string" ? data.webViewLink : undefined,
          folderLink: typeof data.folderLink === "string" ? data.folderLink : undefined,
          fileName: typeof data.fileName === "string" ? data.fileName : undefined,
        });
        refresh();
      } else {
        const message = data?.error ?? response.statusText ?? "Test failed";
        setTestError(message);
        notify.error(message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google Drive test failed";
      setTestError(message);
      notifyHeaderError("Google Drive test failed", err);
    } finally {
      setTesting(false);
    }
  };

  const copyRedirectUri = () => {
    if (!redirectUri) return;
    navigator.clipboard.writeText(redirectUri);
    notify.success(NOTIFY_REDIRECT_URI_COPIED);
  };

  const addFolderPreset = () => {
    const label = presetLabel.trim();
    const folderId = parseGoogleDriveFolderId(presetFolder);
    if (!label || !folderId) return;
    const next = [...userPresets, { id: `user-${Date.now()}`, label, folderId }];
    saveUserGoogleDriveFolderPresets(next);
    setUserPresets(next);
    setPresetLabel("");
    setPresetFolder("");
  };

  const removeFolderPreset = (id: string) => {
    const next = userPresets.filter((preset) => preset.id !== id);
    saveUserGoogleDriveFolderPresets(next);
    setUserPresets(next);
  };

  const updateTeamAlias = (key: GoogleDriveFolderAlias["key"], folderName: string) => {
    setTeamSettings((current) => ({
      ...current,
      folderAliases: current.folderAliases.map((alias) =>
        alias.key === key ? { ...alias, folderName: folderName.trim() || alias.folderName } : alias,
      ),
    }));
  };

  const handleSaveTeamSettings = async () => {
    const teamRootFolderId = parseGoogleDriveFolderId(teamRootInput);
    setTeamSettingsSaving(true);
    try {
      const saved = await saveGoogleDriveTeamSettings({
        ...teamSettings,
        teamRootFolderId,
      });
      setTeamSettings(saved);
      setTeamRootInput(
        saved.teamRootFolderId
          ? `https://drive.google.com/drive/folders/${saved.teamRootFolderId}`
          : "",
      );
    } catch (err) {
      notifyHeaderError("Google Drive team settings save failed", err);
    } finally {
      setTeamSettingsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-primary" aria-hidden />
        <h3 id="drive-heading" className="text-base font-semibold text-white">
          Google Drive
        </h3>
      </div>
      <p className="text-base text-white">
        Connect your Google account to save workflow reports as Google Docs and share links with your team.
      </p>

      {!loading && !configured ? (
        <form onSubmit={handleTestAndSave} className="space-y-3 rounded-md bg-muted/50 p-4">
          <p className="text-base font-medium text-white">OAuth client (Google Cloud)</p>
          <div className="space-y-2">
            <Label htmlFor="drive-client-id" className="text-base text-muted-foreground">
              Client ID
            </Label>
            <Input
              id="drive-client-id"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="xxxxx.apps.googleusercontent.com"
              className="border-border bg-background text-base"
              required
            />
            {clientIdTrimmed && !clientIdLooksValid ? (
              <p className="text-base text-amber-500">
                Use the full Client ID from Google Cloud (ends in .apps.googleusercontent.com).
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="drive-client-secret" className="text-base text-muted-foreground">
              Client Secret
            </Label>
            <Input
              id="drive-client-secret"
              type="password"
              autoComplete="off"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="GOCSPX-..."
              className="border-border bg-background text-base"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={saving || (!!clientIdTrimmed && !clientIdLooksValid)}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {saving ? "Saving…" : "Test and save"}
          </Button>
        </form>
      ) : null}

      {!loading && configured && !connected ? (
        <form onSubmit={handleTestAndSave} className="space-y-3 rounded-md bg-muted/50 p-4">
          <p className="text-base font-medium text-white">Update OAuth client secret</p>
          <p className="text-base text-amber-500">
            Connect is failing because the saved Google client secret is invalid or expired. Copy a fresh secret
            from Google Cloud Console, then Test and save before Connect.
          </p>
          <div className="space-y-2">
            <Label htmlFor="drive-client-id-update" className="text-base text-muted-foreground">
              Client ID
            </Label>
            <Input
              id="drive-client-id-update"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="xxxxx.apps.googleusercontent.com"
              className="border-border bg-background text-base"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="drive-client-secret-update" className="text-base text-muted-foreground">
              Client Secret
            </Label>
            <Input
              id="drive-client-secret-update"
              type="password"
              autoComplete="off"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="GOCSPX-..."
              className="border-border bg-background text-base"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={saving || (!!clientIdTrimmed && !clientIdLooksValid)}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {saving ? "Validating…" : "Test and save"}
          </Button>
        </form>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-base text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Checking…
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {connected ? (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-none bg-zinc-900 px-3 text-base font-medium text-green-400">
                <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
                Connected{email ? ` (${email})` : ""}
              </span>
            ) : (
              <Button
                type="button"
                className="h-9 rounded-none bg-black px-3 text-base font-medium text-white hover:bg-zinc-950"
                onClick={openGoogleDriveAuthorize}
              >
                Connect Google Drive
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-none"
              disabled={testing || !configured}
              onClick={handleTest}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {testing ? "Uploading test file…" : "Test connection"}
            </Button>
          </div>

          {!connected && configured ? (
            <p className="text-base text-amber-500">
              OAuth client is saved but Google Drive is not connected yet. Fix the client secret above if needed,
              then click Connect Google Drive and finish the Google sign-in popup.
            </p>
          ) : null}

          {connectionError ? (
            <p className="text-base text-red-400">{connectionError}</p>
          ) : null}

          {testError ? <p className="text-base text-red-400">{testError}</p> : null}

          {testResult?.webViewLink ? (
            <div className="space-y-2 rounded-md bg-muted/50 p-3">
              <p className="text-base font-medium text-white">Test upload succeeded</p>
              {testResult.fileName ? (
                <p className="text-base text-muted-foreground">File: {testResult.fileName}</p>
              ) : null}
              <a
                href={testResult.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-base text-primary underline"
              >
                Open test file in Google Drive
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              </a>
              {testResult.folderLink ? (
                <a
                  href={testResult.folderLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-base text-primary underline"
                >
                  Open Flowbie Connection Tests folder
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {redirectUri ? (
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-base font-medium text-white">Redirect URI (add this in Google Cloud)</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 text-base text-foreground">
              {redirectUri}
            </code>
            <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={copyRedirectUri}>
              Copy
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-md bg-muted/50 p-4">
        <p className="text-base font-medium text-white">Team folder hierarchy</p>
        <p className="text-base text-muted-foreground">
          Shared drive root for client auto-find. Flowbie creates a NEO Pulse workspace folder there, then client and
          purpose folders underneath it.
        </p>
        <div className="space-y-2">
          <Label htmlFor="drive-team-root-folder" className="text-base text-muted-foreground">
            Team root folder
          </Label>
          <Input
            id="drive-team-root-folder"
            value={teamRootInput}
            disabled={teamSettingsLoading || teamSettingsSaving}
            onChange={(event) => setTeamRootInput(event.target.value)}
            placeholder={`https://drive.google.com/drive/folders/${DEFAULT_TEAM_SHARED_DRIVE_FOLDER_ID}`}
            className="border-border bg-background text-base"
          />
        </div>
        <div className="grid gap-2">
          {teamSettings.folderAliases.map((alias) => (
            <div key={alias.key} className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
              <span className="text-base capitalize text-white">{alias.key}</span>
              <Input
                value={alias.folderName}
                disabled={teamSettingsLoading || teamSettingsSaving}
                onChange={(event) => updateTeamAlias(alias.key, event.target.value)}
                className="border-border bg-background text-base"
              />
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={teamSettingsLoading || teamSettingsSaving}
          onClick={handleSaveTeamSettings}
        >
          {teamSettingsSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {teamSettingsSaving ? "Saving…" : "Save team hierarchy"}
        </Button>
      </div>

      <div className="space-y-3 rounded-md bg-muted/50 p-4">
        <p className="text-base font-medium text-white">Folder presets</p>
        <ul className="space-y-2">
          {folderPresets.map((preset) => (
            <li key={preset.id} className="flex items-center justify-between gap-2 text-base text-white">
              <span>
                {preset.label}
                {preset.builtin ? " (built-in)" : ""}
              </span>
              <span className="truncate text-muted-foreground">{preset.folderId}</span>
              {!preset.builtin ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-white"
                  onClick={() => removeFolderPreset(preset.id)}
                  aria-label={`Remove ${preset.label}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={presetLabel}
            onChange={(event) => setPresetLabel(event.target.value)}
            placeholder="Client name"
            className="border-border bg-background text-base"
          />
          <Input
            value={presetFolder}
            onChange={(event) => setPresetFolder(event.target.value)}
            placeholder="Folder URL or ID"
            className="border-border bg-background text-base"
          />
        </div>
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={addFolderPreset}>
          Add folder preset
        </Button>
      </div>
    </div>
  );
}
