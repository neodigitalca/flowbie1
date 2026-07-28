import type { WordPressSite } from "@/components/integrations/types";

function csvEscape(value: string): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const HEADERS = [
  "name",
  "siteUrl",
  "productionSiteUrl",
  "username",
  "appPassword",
  "id",
  "enabled",
  "ga4PropertyId",
  "gbpLocationId",
  "semrushSiteAuditProjectId",
  "editorialCountsPeriodStartYmd",
  "optimizationPackage",
  "slackEnabledForProperty",
  "slackChannelId",
  "slackChannelName",
  "slackConnectionStatus",
  "entitySitemapUrl",
  "mainSitemapUrl",
  "connectionStatus",
] as const;

/**
 * All WordPress sites as CSV. First four columns match Bulk Import (name, siteUrl, username, appPassword).
 */
export function buildWordPressSitesCsv(sites: WordPressSite[]): string {
  const lines: string[] = [HEADERS.join(",")];
  for (const s of sites) {
    const row = [
      csvEscape(s.name),
      csvEscape(s.siteUrl),
      csvEscape(s.productionSiteUrl ?? ""),
      csvEscape(s.username),
      csvEscape(s.appPassword),
      csvEscape(s.id),
      csvEscape(s.enabled === false ? "false" : "true"),
      csvEscape(s.ga4PropertyId ?? ""),
      csvEscape(s.gbpLocationId ?? ""),
      csvEscape(s.semrushSiteAuditProjectId ?? ""),
      csvEscape(s.editorialCountsPeriodStartYmd ?? ""),
      csvEscape(s.optimizationPackage ?? ""),
      csvEscape(s.slackEnabledForProperty === false ? "false" : "true"),
      csvEscape(s.slackChannelId ?? ""),
      csvEscape(s.slackChannelName ?? ""),
      csvEscape(s.slackConnectionStatus ?? ""),
      csvEscape(s.entitySitemapUrl ?? ""),
      csvEscape(s.sitemaps?.mainSitemapUrl ?? ""),
      csvEscape(s.connectionStatus ?? ""),
    ];
    lines.push(row.join(","));
  }
  return lines.join("\r\n");
}

/** UTF-8 with BOM for Excel and similar apps. */
export function buildWordPressSitesCsvForDownload(sites: WordPressSite[]): string {
  return `\uFEFF${buildWordPressSitesCsv(sites)}`;
}
