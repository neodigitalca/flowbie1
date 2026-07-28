/**
 * Browser calls to Flowbie post bank API (session cookie, proxied in dev).
 */

const POST_BANK_API_BASE =
  import.meta.env.VITE_MCP_API_BASE?.replace(/\/api\/mcp\/?$/, "") || "";

function postBankUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${POST_BANK_API_BASE}/api/post-bank${p}`;
}

export type PostBankInsertPayload = {
  siteId: string;
  /** Property / client label for bank table naming (optional; server can use saved profile name). */
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

export async function insertBankPost(
  payload: PostBankInsertPayload
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(postBankUrl("/insert"), {
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

export type PostBankHealth = {
  ok: boolean;
  configured: boolean;
  source?: "env" | "file" | "none";
  urlHost?: string | null;
  migrationApplyConfigured?: boolean;
};

export async function getPostBankHealth(): Promise<PostBankHealth> {
  const res = await fetch(postBankUrl("/health"));
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    configured?: boolean;
    source?: PostBankHealth["source"];
    urlHost?: string | null;
    migrationApplyConfigured?: boolean;
  };
  return {
    ok: Boolean(data.ok),
    configured: Boolean(data.configured),
    source: data.source,
    urlHost: data.urlHost ?? null,
    migrationApplyConfigured: Boolean(data.migrationApplyConfigured),
  };
}

export async function applyPostBankMigrationViaApi(): Promise<{ ok: boolean; error?: string; code?: string }> {
  try {
    const res = await fetch(postBankUrl("/apply-migration"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      code?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}`, code: data.code };
    }
    return { ok: Boolean(data.ok) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function savePostBankSupabaseCredentials(
  supabaseUrl: string,
  supabaseServiceRoleKey: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(postBankUrl("/credentials"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supabaseUrl: supabaseUrl.trim(),
        supabaseServiceRoleKey: supabaseServiceRoleKey.trim(),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: Boolean(data.ok) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function clearPostBankSupabaseCredentials(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(postBankUrl("/credentials"), {
      method: "DELETE",
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: Boolean(data.ok) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function provisionPostBankTableViaApi(
  siteId: string,
  siteDisplayName?: string
): Promise<{ ok: boolean; tableName?: string; error?: string }> {
  try {
    const body: { siteId: string; siteDisplayName?: string } = { siteId: siteId.trim() };
    const dn = siteDisplayName?.trim();
    if (dn) body.siteDisplayName = dn.slice(0, 200);
    const res = await fetch(postBankUrl("/ensure"), {
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

/** Same as {@link provisionPostBankTableViaApi}; kept for callers that only need ok/error. */
export async function testPostBankTable(siteId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await provisionPostBankTableViaApi(siteId);
  return { ok: r.ok, error: r.error };
}

export async function getPostBankCount(
  siteId: string
): Promise<{ total: number; pending: number; error?: string }> {
  const q = new URLSearchParams({ siteId });
  const res = await fetch(postBankUrl(`/count?${q.toString()}`), { credentials: "include" });
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

export type PostBankListRow = {
  id: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  created_at: string | null;
  scheduled_date_gmt: string | null;
  wp_link: string | null;
};

export async function listPostBankRows(
  siteId: string,
  opts?: { limit?: number; status?: string }
): Promise<{ rows: PostBankListRow[]; error?: string }> {
  const q = new URLSearchParams({ siteId });
  if (opts?.limit) q.set("limit", String(opts.limit));
  if (opts?.status) q.set("status", opts.status);
  const res = await fetch(postBankUrl(`/list?${q.toString()}`), { credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as { rows?: PostBankListRow[]; error?: string };
  if (!res.ok) {
    return { rows: [], error: data.error || `HTTP ${res.status}` };
  }
  return { rows: Array.isArray(data.rows) ? data.rows : [] };
}

export async function publishPostBankRows(
  siteId: string,
  ids: string[]
): Promise<{ ok: boolean; results?: Array<{ id: string; ok: boolean; error?: string }>; error?: string }> {
  const res = await fetch(postBankUrl("/publish"), {
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
