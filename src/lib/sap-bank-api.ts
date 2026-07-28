/**
 * Browser calls to Flowbie SAP / entity bank API (session cookie, proxied in dev).
 */

const SAP_BANK_API_BASE =
  import.meta.env.VITE_MCP_API_BASE?.replace(/\/api\/mcp\/?$/, "") || "";

function sapBankUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SAP_BANK_API_BASE}/api/sap-bank${p}`;
}

export type SapBankInsertPayload = {
  siteId: string;
  siteDisplayName?: string;
  title: string;
  htmlContent: string;
  markdownContent?: string;
  excerpt?: string;
  slug?: string;
  scheduledDateGmt?: string | null;
  wordpressStatus?: "draft" | "future" | "publish";
  postTypeEndpoint?: string;
  sitemapType?: "post" | "entity";
  featuredMediaId?: number | null;
  featuredImageMeta?: Record<string, unknown> | null;
  acfPayload?: Record<string, unknown> | null;
  keyword?: string;
  entity?: string;
  sourceRow?: Record<string, unknown> | null;
};

export async function insertSapBankPost(
  payload: SapBankInsertPayload,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(sapBankUrl("/insert"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      id?: string | number;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    const idStr =
      data.id !== undefined && data.id !== null && String(data.id).length > 0 ? String(data.id) : undefined;
    if (data.ok === true && idStr !== undefined) {
      return { ok: true, id: idStr };
    }
    return { ok: false, error: data.error || "Insert rejected" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function provisionSapBankTableViaApi(
  siteId: string,
  siteDisplayName?: string,
): Promise<{ ok: boolean; tableName?: string; error?: string }> {
  try {
    const body: { siteId: string; siteDisplayName?: string } = { siteId: siteId.trim() };
    const dn = siteDisplayName?.trim();
    if (dn) body.siteDisplayName = dn.slice(0, 200);
    const res = await fetch(sapBankUrl("/ensure"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      tableName?: string;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    if (data.ok && typeof data.tableName === "string" && data.tableName.length > 0) {
      return { ok: true, tableName: data.tableName };
    }
    return { ok: false, error: data.error || "Provision failed" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getSapBankCount(
  siteId: string,
): Promise<{ total: number; pending: number; error?: string }> {
  const q = new URLSearchParams({ siteId });
  const res = await fetch(sapBankUrl(`/count?${q.toString()}`), { credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as {
    total?: number;
    pending?: number;
    error?: string;
  };
  if (!res.ok) {
    return { total: 0, pending: 0, error: data.error || `HTTP ${res.status}` };
  }
  return { total: Number(data.total) || 0, pending: Number(data.pending) || 0 };
}

export type SapBankListRow = {
  id: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  created_at: string | null;
  scheduled_date_gmt: string | null;
  wp_link: string | null;
};

export async function listSapBankRows(
  siteId: string,
  opts?: { limit?: number; status?: string },
): Promise<{ rows: SapBankListRow[]; error?: string }> {
  const q = new URLSearchParams({ siteId });
  if (opts?.limit) q.set("limit", String(opts.limit));
  if (opts?.status) q.set("status", opts.status);
  const res = await fetch(sapBankUrl(`/list?${q.toString()}`), { credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as { rows?: SapBankListRow[]; error?: string };
  if (!res.ok) {
    return { rows: [], error: data.error || `HTTP ${res.status}` };
  }
  return { rows: Array.isArray(data.rows) ? data.rows : [] };
}

export async function publishSapBankRows(
  siteId: string,
  ids: string[],
): Promise<{ ok: boolean; results?: Array<{ id: string; ok: boolean; error?: string }>; error?: string }> {
  const res = await fetch(sapBankUrl("/publish"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId, ids }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    results?: Array<{ id: string; ok: boolean; error?: string }>;
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  }
  return { ok: Boolean(data.ok), results: data.results };
}
