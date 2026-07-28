import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DASHBOARD_SETTINGS_FIELD_CLASS,
  DASHBOARD_SETTINGS_GROUP_CLASS,
} from "@/components/manager/dashboard/dashboard-panel-styles";
import {
  applyPostBankMigrationViaApi,
  clearPostBankSupabaseCredentials,
  getPostBankHealth,
  provisionPostBankTableViaApi,
  savePostBankSupabaseCredentials,
} from "@/lib/post-bank-api";
import { getUnifiedContentBankCount } from "@/lib/unified-content-bank-api";
import { notify } from "@/lib/app-notifications";
import {
  NOTIFY_ENTER_PROJECT_URL_AND_SERVICE_ROLE_KEY,
  NOTIFY_PICK_A_PROPERTY_ID_FROM_INTEGRATIONS,
  NOTIFY_POST_BANK_AND_SAP_BANK_SQL_APPLIED_TRY_C,
  NOTIFY_REMOVED_SAVED_FILE_CREDENTIALS,
  NOTIFY_SIGN_IN_TO_APPLY_MIGRATION,
  NOTIFY_SIGN_IN_TO_CLEAR_SAVED_CREDENTIALS,
  NOTIFY_SIGN_IN_TO_CREATE_THE_BANK_TABLE,
  NOTIFY_SIGN_IN_TO_SAVE_SUPABASE_CREDENTIALS,
  NOTIFY_SUPABASE_CREDENTIALS_SAVED_ON_THE_API_SE,
} from "@/lib/notify-messages";
import { useAuth } from "@/contexts/AuthContext";
import { getStoredSites } from "@/components/integrations/storage";
import { ApiKeyCopyButton } from "@/components/ApiKeyCopyButton";

const INPUT_CLASS = `${DASHBOARD_SETTINGS_FIELD_CLASS} min-w-0 flex-1 h-12`;

export function PostBankDashboardCard() {
  const { user } = useAuth();
  const [health, setHealth] = useState<Awaited<ReturnType<typeof getPostBankHealth>> | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [serviceRoleKey, setServiceRoleKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [testSiteId, setTestSiteId] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const [applyingMigration, setApplyingMigration] = useState(false);
  const [unifiedTableReadyForTestSite, setUnifiedTableReadyForTestSite] = useState<boolean | null>(null);

  const refreshHealth = useCallback(async () => {
    const h = await getPostBankHealth();
    setHealth(h);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const h = await getPostBankHealth();
      if (!cancelled) setHealth(h);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sites = getStoredSites();
    if (sites.length && !testSiteId) {
      setTestSiteId(sites[0].id);
    }
  }, [testSiteId]);

  useEffect(() => {
    const id = testSiteId.trim();
    if (!id) {
      setUnifiedTableReadyForTestSite(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await getUnifiedContentBankCount(id);
      if (!cancelled) setUnifiedTableReadyForTestSite(r.ok === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [testSiteId]);

  const runSave = useCallback(async () => {
    if (!user) {
      notify.error(NOTIFY_SIGN_IN_TO_SAVE_SUPABASE_CREDENTIALS);
      return;
    }
    if (!supabaseUrl.trim() || !serviceRoleKey.trim()) {
      notify.error(NOTIFY_ENTER_PROJECT_URL_AND_SERVICE_ROLE_KEY);
      return;
    }
    setSaving(true);
    try {
      const r = await savePostBankSupabaseCredentials(supabaseUrl, serviceRoleKey);
      if (!r.ok) {
        notify.error(r.error || "Save failed");
        return;
      }
      setServiceRoleKey("");
      notify.success(NOTIFY_SUPABASE_CREDENTIALS_SAVED_ON_THE_API_SE);
      await refreshHealth();
    } finally {
      setSaving(false);
    }
  }, [user, supabaseUrl, serviceRoleKey, refreshHealth]);

  const runClear = useCallback(async () => {
    if (!user) {
      notify.error(NOTIFY_SIGN_IN_TO_CLEAR_SAVED_CREDENTIALS);
      return;
    }
    setClearing(true);
    try {
      const r = await clearPostBankSupabaseCredentials();
      if (!r.ok) {
        notify.error(r.error || "Clear failed");
        return;
      }
      setSupabaseUrl("");
      setServiceRoleKey("");
      notify.success(NOTIFY_REMOVED_SAVED_FILE_CREDENTIALS);
      await refreshHealth();
    } finally {
      setClearing(false);
    }
  }, [user, refreshHealth]);

  const runApplyMigration = useCallback(async () => {
    if (!user) {
      notify.error(NOTIFY_SIGN_IN_TO_APPLY_MIGRATION);
      return;
    }
    setApplyingMigration(true);
    try {
      const r = await applyPostBankMigrationViaApi();
      if (!r.ok) {
        notify.error(r.error || "Apply failed");
        return;
      }
      notify.success(NOTIFY_POST_BANK_AND_SAP_BANK_SQL_APPLIED_TRY_C);
      await refreshHealth();
    } finally {
      setApplyingMigration(false);
    }
  }, [user, refreshHealth]);

  const runProvision = useCallback(async () => {
    if (!user) {
      notify.error(NOTIFY_SIGN_IN_TO_CREATE_THE_BANK_TABLE);
      return;
    }
    if (!testSiteId.trim()) {
      notify.error(NOTIFY_PICK_A_PROPERTY_ID_FROM_INTEGRATIONS);
      return;
    }
    setProvisioning(true);
    try {
      const r = await provisionPostBankTableViaApi(testSiteId.trim());
      if (!r.ok) {
        notify.error(r.error || "Create failed");
        return;
      }
      notify.success(
        r.tableName ? `Bank table ready: public.${r.tableName}` : "Bank table is ready",
      );
      setUnifiedTableReadyForTestSite(true);
    } finally {
      setProvisioning(false);
    }
  }, [user, testSiteId]);

  const configured = health?.configured ?? false;
  const source = health?.source ?? "none";
  const urlHost = health?.urlHost;
  const migrationApplyConfigured = health?.migrationApplyConfigured ?? false;

  const statusLabel =
    health === null
      ? "Checking…"
      : configured
        ? source === "env"
          ? "Using server environment"
          : `Connected (${urlHost || "project"})`
        : "Not connected";

  return (
    <div className={DASHBOARD_SETTINGS_GROUP_CLASS}>
      <p className="font-semibold text-white">Supabase Post Bank</p>
      <p className="text-base text-white">
        Cloud storage for generated posts. Save your project URL and service role key here, or set them on the API
        server.
      </p>
      <p className="text-base text-white">
        Status: <span className="font-medium">{statusLabel}</span>
      </p>
      {source === "env" ? (
        <p className="text-base text-white">Server env vars are active. Fields below are ignored until those are removed.</p>
      ) : null}

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="post-bank-supabase-url" className="text-base text-white">
            Project URL
          </Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              id="post-bank-supabase-url"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className={INPUT_CLASS}
              placeholder="https://xxxx.supabase.co"
              autoComplete="off"
              disabled={source === "env"}
            />
            <ApiKeyCopyButton
              value={supabaseUrl}
              emptyMessage="Enter a project URL to copy."
              aria-label="Copy Supabase project URL"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="post-bank-service-role" className="text-base text-white">
            Service role key
          </Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              id="post-bank-service-role"
              type="password"
              value={serviceRoleKey}
              onChange={(e) => setServiceRoleKey(e.target.value)}
              className={INPUT_CLASS}
              placeholder="eyJ…"
              autoComplete="new-password"
              disabled={source === "env"}
            />
            <ApiKeyCopyButton
              value={serviceRoleKey}
              emptyMessage="Enter a service role key to copy."
              aria-label="Copy Supabase service role key"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-12 text-base"
            onClick={() => void runSave()}
            disabled={saving || source === "env"}
          >
            {saving ? "Saving…" : "Save to server"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            onClick={() => void runClear()}
            disabled={clearing}
          >
            {clearing ? "Clearing…" : "Clear saved"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            onClick={() => void runApplyMigration()}
            disabled={applyingMigration || !migrationApplyConfigured}
          >
            {applyingMigration ? "Applying…" : "Apply database SQL"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div className="grid gap-2">
          <Label htmlFor="post-bank-test-site" className="text-base text-white">
            Property id
          </Label>
          <Input
            id="post-bank-test-site"
            value={testSiteId}
            onChange={(e) => setTestSiteId(e.target.value)}
            className={`${INPUT_CLASS} w-full`}
            placeholder="wp-…"
            autoComplete="off"
          />
        </div>
        {unifiedTableReadyForTestSite === true ? (
          <p className="text-base text-white">Content bank table exists for this property.</p>
        ) : (
          <Button type="button" className="h-12 text-base" onClick={() => void runProvision()} disabled={provisioning}>
            {provisioning ? "Creating…" : "Create bank table"}
          </Button>
        )}
      </div>
    </div>
  );
}
