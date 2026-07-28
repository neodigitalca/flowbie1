import { NOTIFY_AGENTMAIL_API_KEY_CLEARED, NOTIFY_AGENTMAIL_API_KEY_SAVED_USED_FOR_COMMUNI } from "@/lib/notify-messages";
import { useState, useCallback, useEffect } from "react";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ApiKeyCopyButton } from "@/components/ApiKeyCopyButton";
import { notify } from "@/lib/app-notifications";
import {
  loadAgentMailApiKey,
  loadAgentMailGeneralEmail,
  loadApiKey,
  saveAgentMailGeneralEmail,
  syncEmailWorkerKeysToServer,
} from "@/lib/api";
import { fetchAgentMailConfig, saveAgentMailConfig } from "@/lib/agentmail-api";
import { DASHBOARD_SETTINGS_FIELD_CLASS } from "@/components/manager/dashboard/dashboard-panel-styles";

interface AgentMailApiKeyContentProps {
  apiKey: string;
  saveApiKey: (key: string) => void;
}

const INPUT_CLASS = `${DASHBOARD_SETTINGS_FIELD_CLASS} min-w-0 flex-1 h-12`;

export const AgentMailApiKeyContent: React.FC<AgentMailApiKeyContentProps> = ({
  apiKey,
  saveApiKey: persistKey,
}) => {
  const [localApiKey, setLocalApiKey] = useState(apiKey || loadAgentMailApiKey());
  const [generalEmail, setGeneralEmail] = useState(loadAgentMailGeneralEmail());

  useEffect(() => {
    setLocalApiKey(apiKey || loadAgentMailApiKey());
  }, [apiKey]);

  useEffect(() => {
    let cancelled = false;
    void fetchAgentMailConfig()
      .then((cfg) => {
        if (cancelled) return;
        const v = (cfg.generalEmail || "").trim();
        if (v) {
          setGeneralEmail(v);
          saveAgentMailGeneralEmail(v);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = useCallback(async () => {
    const t = localApiKey.trim();
    const g = generalEmail.trim();
    if (t) {
      persistKey(t);
      saveAgentMailGeneralEmail(g);
      try {
        await saveAgentMailConfig({ generalEmail: g });
      } catch (_) {
        /* keep local value */
      }
      void syncEmailWorkerKeysToServer({
        agentmailApiKey: t,
        openRouterApiKey: loadApiKey().trim(),
      });
      notify.success(NOTIFY_AGENTMAIL_API_KEY_SAVED_USED_FOR_COMMUNI);
    } else {
      persistKey("");
      saveAgentMailGeneralEmail(g);
      try {
        await saveAgentMailConfig({ generalEmail: g });
      } catch (_) {
        /* keep local value */
      }
      void syncEmailWorkerKeysToServer({
        agentmailApiKey: "",
        openRouterApiKey: loadApiKey().trim(),
      });
      notify.warning(NOTIFY_AGENTMAIL_API_KEY_CLEARED);
    }
  }, [generalEmail, localApiKey, persistKey]);

  return (
    <div className="space-y-2">
      <p className="font-semibold text-white">AgentMail</p>
      <p className="text-base text-white">
        Flo inbox and per-site email. Keys from{" "}
        <a
          href="https://console.agentmail.to/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          console.agentmail.to
        </a>
        .
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          id="agentmail-apiKey"
          type="password"
          autoComplete="off"
          value={localApiKey}
          onChange={(e) => setLocalApiKey(e.target.value)}
          aria-label="AgentMail API key"
          className={INPUT_CLASS}
        />
        <ApiKeyCopyButton
          value={localApiKey}
          emptyMessage="Enter an AgentMail API key to copy."
          aria-label="Copy AgentMail API key"
        />
        <Button type="button" onClick={handleSave} className="h-12 shrink-0 text-base">
          Save
        </Button>
      </div>
      <FloatingLabelInput
        id="agentmail-general-email"
        label="General recipient email"
        type="email"
        autoComplete="email"
        value={generalEmail}
        onChange={(e) => setGeneralEmail(e.target.value)}
        className={`${DASHBOARD_SETTINGS_FIELD_CLASS} min-w-0 w-full`}
      />
    </div>
  );
};
