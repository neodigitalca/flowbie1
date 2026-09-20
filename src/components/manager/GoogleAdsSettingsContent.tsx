import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle, Copy, Loader2, Megaphone, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify, notifyHeaderError } from "@/lib/app-notifications";
import { NOTIFY_REDIRECT_URI_COPIED } from "@/lib/notify-messages";
import { backendApiUrl } from "@/lib/wordpress-api/connection";
import {
  openGoogleAdsAuthorize,
  useGoogleAdsConnectionStatus,
} from "@/hooks/use-google-ads-connection-status";

const FIELD_CLASS =
  "h-8 rounded-none border-0 bg-zinc-900 text-base text-white placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-white/35";

export function GoogleAdsSettingsContent() {
  const {
    connected,
    loading,
    configured,
    hasDeveloperToken,
    hasMccId,
    mccId,
    redirectUri,
    authUrl,
    connectionError,
    refresh,
  } = useGoogleAdsConnectionStatus();
  const [developerToken, setDeveloperToken] = useState("");
  const [mccInput, setMccInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  useEffect(() => {
    if (mccId && !mccInput.trim()) setMccInput(mccId);
  }, [mccId, mccInput]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTestError(null);
    try {
      const response = await fetch(backendApiUrl("/google-ads/test-and-save"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developerToken: developerToken.trim(),
          mccId: mccInput.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify.error(typeof data?.error === "string" ? data.error : "Save failed");
        return;
      }
      setDeveloperToken("");
      refresh();
    } catch (err) {
      notifyHeaderError("Google Ads save failed", err);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestError(null);
    setTestMessage(null);
    try {
      const response = await fetch(backendApiUrl("/google-ads/test"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.success) {
        setTestMessage(typeof data.message === "string" ? data.message : "Google Ads connection OK.");
        refresh();
        return;
      }
      const message = typeof data?.error === "string" ? data.error : "Test failed";
      setTestError(message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google Ads test failed";
      setTestError(message);
      notifyHeaderError("Google Ads test failed", err);
    } finally {
      setTesting(false);
    }
  };

  const copyRedirectUri = () => {
    if (!redirectUri) return;
    void navigator.clipboard.writeText(redirectUri);
    notify.success(NOTIFY_REDIRECT_URI_COPIED);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-white" aria-hidden />
        <h3 id="ads-heading" className="text-base font-semibold text-white">
          Google Ads
        </h3>
      </div>

      <form onSubmit={handleSave} className="grid gap-2 sm:grid-cols-2">
        <Input
          type="password"
          autoComplete="off"
          value={developerToken}
          onChange={(e) => setDeveloperToken(e.target.value)}
          placeholder={hasDeveloperToken ? "Developer token (optional, saved)" : "Developer token (optional)"}
          aria-label="Developer token"
          className={FIELD_CLASS}
        />
        <Input
          value={mccInput}
          onChange={(e) => setMccInput(e.target.value)}
          placeholder="MCC ID (393-713-6350)"
          aria-label="MCC ID"
          className={FIELD_CLASS}
        />
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Button type="submit" disabled={saving} className="h-8 rounded-none gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {saving ? "Saving…" : "Save"}
          </Button>
          {redirectUri ? (
            <Button type="button" variant="outline" className="h-8 rounded-none gap-2" onClick={copyRedirectUri}>
              <Copy className="h-4 w-4" aria-hidden />
              Copy redirect URI
            </Button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <div className="flex h-8 items-center gap-2 text-base text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Checking…
        </div>
      ) : (
        <div className="flex min-h-8 flex-wrap items-center gap-2">
          {connected ? (
            <span className="inline-flex h-8 items-center gap-1.5 bg-zinc-900 px-3 text-base font-medium text-green-400">
              <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
              Connected{hasMccId ? " (MCC)" : ""}
            </span>
          ) : (
            <Button
              type="button"
              className="h-8 rounded-none bg-black px-3 text-base font-medium text-white hover:bg-zinc-950"
              onClick={() => openGoogleAdsAuthorize(authUrl)}
              disabled={!configured || !authUrl}
            >
              Connect Google Ads
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-none"
            disabled={testing || !configured || !hasMccId}
            onClick={handleTest}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {testing ? "Testing…" : "Test connection"}
          </Button>
        </div>
      )}

      {connectionError ? <p className="text-base text-red-400">{connectionError}</p> : null}
      {testError ? <p className="text-base text-red-400">{testError}</p> : null}
      {testMessage ? <p className="text-base text-green-400">{testMessage}</p> : null}
    </div>
  );
}
