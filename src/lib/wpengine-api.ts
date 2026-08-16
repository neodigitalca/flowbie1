import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import type { WordPressSite } from "@/components/integrations/types";
import { wordPressSiteHostKey } from "@/lib/wordpress-site-host-key";

function baseUrl(): string {
  return (BACKEND_API_BASE || "").replace(/\/$/, "");
}

function url(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl()}${p}`;
}

export type WpEngineCatalogStatus = {
  ok?: boolean;
  rowCount?: number;
  updatedAt?: string | null;
  pluginStaged?: boolean;
};

export async function fetchWpEngineCatalogStatus(): Promise<WpEngineCatalogStatus | null> {
  try {
    const res = await fetch(url("/api/wpengine/catalog/status"), { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as WpEngineCatalogStatus;
  } catch {
    return null;
  }
}

export async function deployNeoPulseWpPlugin(
  site: WordPressSite,
): Promise<{ ok: boolean; error?: string; filesUploaded?: number; site?: string }> {
  const domain =
    site.wpEngineDomain?.trim() ||
    wordPressSiteHostKey(site.productionSiteUrl) ||
    wordPressSiteHostKey(site.siteUrl) ||
    "";
  try {
    const res = await fetch(url("/api/wpengine/deploy-plugin"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: site.wpEngineHost ?? "",
        port: site.wpEnginePort ?? 2222,
        username: site.wpEngineUsername ?? "",
        password: site.wpEnginePassword ?? "",
        site: domain,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      filesUploaded?: number;
      site?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return {
      ok: Boolean(data.ok),
      error: data.error,
      filesUploaded: data.filesUploaded,
      site: data.site,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
