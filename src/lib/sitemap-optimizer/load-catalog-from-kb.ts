import type { WordPressSite } from "@/components/integrations/types";
import type { StoredFile } from "@/components/KnowledgeBaseTab";
import { extractEndpointFromEntitySitemapUrl } from "@/lib/entity-endpoint-extractor";
import { isWpSiteInventoryKbFileName } from "@/lib/kb-wp-inventory";
import type { SitePostInventoryKbPayload, SitePostInventoryRow } from "@/lib/wordpress-api/types";

const KB_FILES_STORAGE_KEY = "kb_files";

function normalizeSiteHost(url: string): string {
  try {
    const raw = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    return new URL(raw).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function loadLatestWpSiteInventoryFromKb(
  site: WordPressSite,
): SitePostInventoryKbPayload | null {
  try {
    const raw = localStorage.getItem(KB_FILES_STORAGE_KEY) || "[]";
    const files = JSON.parse(raw) as StoredFile[];
    const targetHost = normalizeSiteHost(site.siteUrl);
    const candidates = files
      .filter((f) => isWpSiteInventoryKbFileName(f.name) && f.content?.trim())
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

    for (const file of candidates) {
      let payload: SitePostInventoryKbPayload;
      try {
        payload = JSON.parse(file.content) as SitePostInventoryKbPayload;
      } catch {
        continue;
      }
      const payloadHost = normalizeSiteHost(payload.site?.url ?? "");
      if (payloadHost && targetHost && payloadHost !== targetHost) continue;
      if (!Array.isArray(payload.posts) || payload.posts.length === 0) continue;
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}

/** KB snapshot rows have no collection tag; infer from URL path and site entity sitemap. */
export function kbInventoryRowCollection(
  row: SitePostInventoryRow,
  site?: WordPressSite | null,
): string {
  const url = (row.url ?? "").toLowerCase();
  const entityUrl = site?.entitySitemapUrl?.trim() ?? "";
  const entityEp = entityUrl ? extractEndpointFromEntitySitemapUrl(entityUrl).trim() : "";
  if (entityEp) {
    const ep = entityEp.toLowerCase();
    if (url.includes(`/${ep}/`)) return entityEp;
  }
  if (/\/page\/|\/pages\/|\?page_id=/.test(url)) return "pages";
  return "posts";
}
