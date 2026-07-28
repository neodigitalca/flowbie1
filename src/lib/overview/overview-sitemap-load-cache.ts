import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  overviewInventoryCollectionsFromSource,
  type OverviewSitemapSource,
} from "@/lib/overview/overview-sitemap-source";

function fingerprintKey(siteId: string, source: OverviewSitemapSource): string {
  const ver = source === "sap" ? "v7" : "v1";
  return `flowbie-overview-sitemap-fp-${ver}:${siteId}:${source}`;
}

const memoryByKey = new Map<string, string>();

function normalizeSitemapUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

/** Stable key for REST inventory collections + sitemap exclusions for a site + bucket. */
export function buildOverviewSitemapLoadFingerprint(
  site: WordPressSite,
  source: OverviewSitemapSource,
): string {
  const collections = overviewInventoryCollectionsFromSource(source, site)
    .map((c) => c.toLowerCase().trim())
    .filter(Boolean)
    .sort()
    .join(",");
  const disabled = (site.sitemaps?.disabledChildSitemapUrls ?? [])
    .map(normalizeSitemapUrl)
    .filter(Boolean)
    .sort()
    .join("|");
  const entity = normalizeSitemapUrl(site.entitySitemapUrl ?? "");
  const sapStrategy = source === "sap" ? "entity-sitemap-first" : "rest-bulk";
  return `strategy:${sapStrategy}|inv:${collections}|ex:${disabled}|entity:${entity}`;
}

export function getOverviewSitemapLoadFingerprint(
  siteId: string,
  source: OverviewSitemapSource,
): string | null {
  const key = fingerprintKey(siteId, source);
  const mem = memoryByKey.get(key);
  if (mem) return mem;

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw?.trim()) return null;
    memoryByKey.set(key, raw);
    return raw;
  } catch {
    return null;
  }
}

export function setOverviewSitemapLoadFingerprint(
  siteId: string,
  source: OverviewSitemapSource,
  fingerprint: string,
): void {
  if (!fingerprint.trim()) return;
  const key = fingerprintKey(siteId, source);
  memoryByKey.set(key, fingerprint);
  try {
    sessionStorage.setItem(key, fingerprint);
  } catch {
    // quota or private mode
  }
}

export function clearOverviewSitemapLoadFingerprints(siteId: string): void {
  for (const source of ["pages", "posts", "sap"] as const) {
    const key = fingerprintKey(siteId, source);
    memoryByKey.delete(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export function shouldSkipOverviewSitemapLoad(
  siteId: string,
  source: OverviewSitemapSource,
  site: WordPressSite,
  cachedRows: OverviewRow[] | null | undefined,
): boolean {
  if (!cachedRows?.length) return false;

  const current = buildOverviewSitemapLoadFingerprint(site, source);
  if (!current) return false;

  const stored = getOverviewSitemapLoadFingerprint(siteId, source);
  if (!stored) {
    setOverviewSitemapLoadFingerprint(siteId, source, current);
    return true;
  }

  return stored === current;
}
