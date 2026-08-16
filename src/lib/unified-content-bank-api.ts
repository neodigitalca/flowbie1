/**
 * Browser calls to the client content bank API (session cookie, proxied in dev).
 * One Supabase table per property: `content_bank_<site-id>` with content_type post | entity.
 */

import contentBankMigrationSql from "@/fixtures/neo-pulse-content-bank-migration.sql?raw";

const UNIFIED_CONTENT_BANK_API_BASE = "";

function unifiedContentBankUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${UNIFIED_CONTENT_BANK_API_BASE}/api/unified-content-bank${p}`;
}

export type UnifiedContentBankCountBody = {
  siteId: string;
  tableName: string;
  byType: {
    post: { total: number; pending: number };
    entity: { total: number; pending: number };
  };
};

export type UnifiedContentBankCountResult =
  | { ok: true; data: UnifiedContentBankCountBody }
  | { ok: false; status: number; error: string; code?: string };

function sqlTextParam(s: string): string {
  const escaped = s.replace(/'/g, "''");
  return `'${escaped}'`;
}

export function buildUnifiedContentBankEnsureSql(siteId: string, displayLabel: string): string {
  const id = siteId.trim();
  const label = displayLabel.trim() || id;
  return `SELECT public.neo_pulse_ensure_content_bank(${sqlTextParam(id)}, ${sqlTextParam(label)});`;
}

const CONTENT_BANK_MIGRATION_FILE = "src/fixtures/neo-pulse-content-bank-migration.sql";

export function buildUnifiedContentBankProvisioningSqlBlock(siteId: string, displayLabel: string): string {
  const id = siteId.trim();
  const label = displayLabel.trim() || id;
  const ddl = contentBankMigrationSql.trim();
  return [
    `-- NEO Pulse client content bank (one table: content_bank_<site> — no registry)`,
    `-- Source: ${CONTENT_BANK_MIGRATION_FILE}`,
    "",
    ddl,
    "",
    "NOTIFY pgrst, 'reload schema';",
    "",
    `SELECT public.neo_pulse_ensure_content_bank(${sqlTextParam(id)}, ${sqlTextParam(label)})::text AS table_name, ${sqlTextParam(
      id,
    )}::text AS site_id;`,
  ].join("\n");
}

export async function getUnifiedContentBankCount(siteId: string): Promise<UnifiedContentBankCountResult> {
  const id = siteId.trim();
  if (!id) return { ok: false, status: 400, error: "siteId required" };
  try {
    const url = `${unifiedContentBankUrl("/count")}?${new URLSearchParams({ siteId: id })}`;
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 422) {
      const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      return {
        ok: false,
        status: 422,
        error: j.error || "Client content bank not provisioned",
        code: j.code,
      };
    }
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, status: res.status, error: j.error || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as UnifiedContentBankCountBody;
    if (!data?.byType?.post || !data?.byType?.entity) {
      return { ok: false, status: 502, error: "Invalid client content bank count response" };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function ensureUnifiedContentBank(
  siteId: string,
  displayName: string,
): Promise<{ ok: true; tableName: string } | { ok: false; error: string }> {
  const id = siteId.trim();
  if (!id) return { ok: false, error: "siteId required" };
  const label = displayName.trim() || id;
  try {
    const res = await fetch(unifiedContentBankUrl("/ensure"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId: id, siteDisplayName: label }),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; tableName?: string; error?: string };
    if (!res.ok || !j.ok || !j.tableName) {
      return { ok: false, error: j.error || `HTTP ${res.status}` };
    }
    return { ok: true, tableName: j.tableName };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
