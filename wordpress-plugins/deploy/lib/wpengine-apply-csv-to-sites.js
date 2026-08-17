import { wordPressSiteHostKeyFromUrl } from "./wordpress-host-key.js";

const APP_HOSTS = new Set(["flowbie.ca", "neodigital.ca"]);

function normalizeDomain(domain) {
  return wordPressSiteHostKeyFromUrl(domain) ?? domain.trim().toLowerCase();
}

function isStagingRow(row) {
  return /1stg|staging/i.test(row.host || "") || /1stg|staging/i.test(row.username || "");
}

function siteHostKeys(site) {
  const keys = [];
  const prod = wordPressSiteHostKeyFromUrl(site.productionSiteUrl);
  const rest = wordPressSiteHostKeyFromUrl(site.siteUrl);
  if (prod) keys.push(prod);
  if (rest && !keys.includes(rest)) keys.push(rest);
  return keys;
}

export function pickWpEngineCsvRowForSite(site, rows) {
  const keys = siteHostKeys(site);
  if (keys.length === 0) return undefined;
  const preferStaging = /1stg|staging/i.test(site.siteUrl || "") && !site.productionSiteUrl?.trim();
  const matches = rows.filter((row) => keys.includes(normalizeDomain(row.site)));
  if (matches.length === 0) return undefined;
  const production = matches.filter((row) => !isStagingRow(row));
  const staging = matches.filter((row) => isStagingRow(row));
  if (preferStaging && staging.length > 0) return staging[0];
  if (production.length > 0) return production[0];
  return matches[0];
}

export function wpEnginePatchFromCsvRow(row) {
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

export function applyWpEngineCsvToSites(sites, rows) {
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
