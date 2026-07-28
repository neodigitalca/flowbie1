import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FloatingLabelTextarea } from "@/components/ui/floating-label-textarea";
import { Loader2, Mail } from "lucide-react";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_EMAIL_AGENT_SENDER_LISTS_SAVED } from "@/lib/notify-messages";
import {
  DASHBOARD_SETTINGS_GROUP_CLASS,
  DASHBOARD_SETTINGS_PANEL_CLASS,
} from "@/components/manager/dashboard/dashboard-panel-styles";
import {
  fetchEmailAgentSenderAccess,
  saveEmailAgentSenderAccess,
  type EmailAgentSenderAccess,
} from "@/lib/email-agent-api";

function linesToArray(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function arrayToLines(arr: string[]): string {
  return arr.join("\n");
}

export function EmailAgentAdminSettingsContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminDomains, setAdminDomains] = useState<string[]>([]);
  const [extraDraft, setExtraDraft] = useState("");
  const [blacklistDraft, setBlacklistDraft] = useState("");

  const applyPayload = useCallback((data: EmailAgentSenderAccess) => {
    setAdminDomains(data.adminDomains ?? []);
    setExtraDraft(arrayToLines(data.extraWhitelist ?? []));
    setBlacklistDraft(arrayToLines(data.blacklist ?? []));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEmailAgentSenderAccess();
      applyPayload(data);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not load email agent access settings");
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const data = await saveEmailAgentSenderAccess({
        extraWhitelist: linesToArray(extraDraft),
        blacklist: linesToArray(blacklistDraft),
      });
      applyPayload(data);
      notify.success(NOTIFY_EMAIL_AGENT_SENDER_LISTS_SAVED);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [extraDraft, blacklistDraft, applyPayload]);

  return (
    <div className={`${DASHBOARD_SETTINGS_PANEL_CLASS} space-y-4 text-white`}>
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-white" aria-hidden />
        <h2 className="text-base font-semibold text-white">Email</h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-base text-white">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : (
        <>
          <div className={DASHBOARD_SETTINGS_GROUP_CLASS}>
            <p className="font-semibold text-white">Admin domains</p>
            <p className="text-base text-white">
              From server env{" "}
              <code className="font-mono">EMAIL_AGENT_NEO_DOMAINS</code> (default{" "}
              <code className="font-mono">neodigital.ca</code>
              ):{" "}
              {adminDomains.length > 0 ? (
                <span className="font-mono">{adminDomains.join(", ")}</span>
              ) : (
                "(none)"
              )}
            </p>
          </div>

          <div className={DASHBOARD_SETTINGS_GROUP_CLASS}>
            <FloatingLabelTextarea
              id="email-agent-extra-whitelist"
              label="Extra whitelist"
              value={extraDraft}
              onChange={(e) => setExtraDraft(e.target.value)}
              rows={6}
              className="min-h-[120px] border-white/[0.08] bg-zinc-900/50 font-mono text-base text-white"
            />
            <p className="text-base text-white">
              One email per line or comma-separated.
            </p>
          </div>

          <div className={DASHBOARD_SETTINGS_GROUP_CLASS}>
            <FloatingLabelTextarea
              id="email-agent-blacklist"
              label="Blacklist"
              value={blacklistDraft}
              onChange={(e) => setBlacklistDraft(e.target.value)}
              rows={5}
              className="min-h-[100px] border-white/[0.08] bg-zinc-900/50 font-mono text-base text-white"
            />
            <p className="text-base text-white">
              Never processed, even if whitelisted or on an admin domain.
            </p>
          </div>

          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save lists"
            )}
          </Button>
        </>
      )}
    </div>
  );
}
