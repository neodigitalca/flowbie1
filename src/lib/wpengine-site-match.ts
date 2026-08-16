import type { WordPressSite } from "@/components/integrations/types";
import { wordPressSiteHostKey } from "@/lib/wordpress-site-host-key";

export type WpEngineCsvRow = {
  site: string;
  host: string;
  port: number;
  username: string;
  password: string;
  isStaging?: boolean;
};

const APP_HOSTS = new Set(["flowbie.ca", "neodigital.ca"]);

function isStagingRow(row: WpEngineCsvRow): boolean {
  if (row.isStaging) return true;
  return /1stg|staging/i.test(row.host) || /1stg|staging/i.test(row.username);
}

function siteHostKeys(site: WordPressSite): string[] {
  const keys: string[] = [];
  const prod = wordPressSiteHostKey(site.productionSiteUrl);
  const rest = wordPressSiteHostKey(site.siteUrl);
  if (prod) keys.push(prod);
  if (rest && !keys.includes(rest)) keys.push(rest);
  return keys;
}

function normalizeDomain(domain: string): string {
  return wordPressSiteHostKey(domain) ?? domain.trim().toLowerCase();
}

export function pickWpEngineCsvRowForSite(
  site: WordPressSite,
  rows: WpEngineCsvRow[],
): WpEngineCsvRow | undefined {
  const keys = siteHostKeys(site);
  if (keys.length === 0) return undefined;
  const preferStaging = /1stg|staging/i.test(site.siteUrl) && !site.productionSiteUrl?.trim();
  const matches = rows.filter((row) => {
    const key = normalizeDomain(row.site);
    return keys.includes(key);
  });
  if (matches.length === 0) return undefined;
  const production = matches.filter((row) => !isStagingRow(row));
  const staging = matches.filter((row) => isStagingRow(row));
  if (preferStaging && staging.length > 0) return staging[0];
  if (production.length > 0) return production[0];
  return matches[0];
}

export function wpEnginePatchFromCsvRow(row: WpEngineCsvRow | undefined): Partial<WordPressSite> {
  if (!row) {
    return {
      wpEngineHost: undefined,
      wpEnginePort: undefined,
      wpEngineUsername: undefined,
      wpEnginePassword: undefined,
      wpEngineDomain: undefined,
      wpEngineIsStaging: undefined,
    };
  }
  return {
    wpEngineHost: row.host,
    wpEnginePort: row.port,
    wpEngineUsername: row.username,
    wpEnginePassword: row.password,
    wpEngineDomain: normalizeDomain(row.site),
    wpEngineIsStaging: isStagingRow(row),
  };
}

export function applyWpEngineCsvToSites(
  sites: WordPressSite[],
  rows: WpEngineCsvRow[],
): { sites: WordPressSite[]; changed: boolean; applied: number } {
  const clientRows = rows.filter((row) => !APP_HOSTS.has(normalizeDomain(row.site)));
  let changed = false;
  let applied = 0;
  const next = sites.map((site) => {
    const row = pickWpEngineCsvRowForSite(site, clientRows);
    if (!row) return site;
    const patch = wpEnginePatchFromCsvRow(row);
    const same =
      site.wpEngineHost === patch.wpEngineHost &&
      site.wpEnginePort === patch.wpEnginePort &&
      site.wpEngineUsername === patch.wpEngineUsername &&
      site.wpEnginePassword === patch.wpEnginePassword &&
      site.wpEngineDomain === patch.wpEngineDomain &&
      site.wpEngineIsStaging === patch.wpEngineIsStaging;
    if (same) return site;
    changed = true;
    applied += 1;
    return { ...site, ...patch };
  });
  return { sites: next, changed, applied };
}

export function siteHasWpEngineCredentials(site: WordPressSite): boolean {
  return Boolean(
    site.wpEngineHost?.trim() &&
      site.wpEngineUsername?.trim() &&
      site.wpEnginePassword != null &&
      String(site.wpEnginePassword).length > 0,
  );
}
