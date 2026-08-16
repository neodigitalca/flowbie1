#!/usr/bin/env node
/**
 * Push Customer List CSV SFTP credentials onto each property in sites.json.
 *
 * Usage: npm run push:wpengine-credentials
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import SftpClient from "ssh2-sftp-client";
import { loadSites } from "../wordpress-plugins/deploy/lib/csv-sites.js";
import { defaultWpEngineCsvPath } from "../wordpress-plugins/deploy/lib/wpengine-catalog-payload.js";
import { applyWpEngineCsvToSites } from "../wordpress-plugins/deploy/lib/wpengine-apply-csv-to-sites.js";

const dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(dir, "..");
const csvPath = defaultWpEngineCsvPath(repoRoot);
const remoteSitesPath = "./wp-content/uploads/neo-pulse-data/sites.json";

const configPaths = [
  process.env.NEO_PULSE_WPENGINE_CONFIG,
  join(repoRoot, "wordpress-plugins/neo-pulse-wpengine.config.json"),
  join(repoRoot, "wordpress-plugins/flowbie-wpengine.config.json"),
].filter(Boolean);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function loadSiteFromWpEngineConfig() {
  for (const configPath of configPaths) {
    if (!existsSync(configPath)) continue;
    const raw = JSON.parse(readFileSync(configPath, "utf8"));
    const siteUrl = String(raw.site ?? "").trim();
    const site = siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (site !== "neodigital.ca" || !raw.host || !raw.username || !(raw.password || raw.passwordPath)) continue;
    return {
      site,
      host: raw.host,
      port: Number(raw.port) || 2222,
      username: raw.username,
      password: raw.password ?? "",
    };
  }
  return null;
}

if (!existsSync(csvPath)) {
  fail(`CSV not found: ${csvPath}`);
}

const siteRow = loadSiteFromWpEngineConfig();
if (!siteRow?.password) {
  fail("Missing neodigital SFTP config (wordpress-plugins/flowbie-wpengine.config.json)");
}

const csvRows = loadSites(csvPath);
const sftp = new SftpClient();
await sftp.connect({
  host: siteRow.host,
  port: siteRow.port,
  username: siteRow.username,
  password: siteRow.password,
  readyTimeout: 30000,
});

let payload;
try {
  const raw = await sftp.get(remoteSitesPath);
  payload = JSON.parse(raw.toString("utf8"));
} catch (e) {
  fail(`Could not read ${remoteSitesPath}: ${e.message}`);
}

const sites = Array.isArray(payload?.sites) ? payload.sites : [];
if (sites.length === 0) {
  fail("sites.json has no properties");
}

const { sites: merged, changed, applied } = applyWpEngineCsvToSites(sites, csvRows);
const nextPayload = {
  ...payload,
  sites: merged,
  syncedAt: new Date().toISOString(),
};

await sftp.put(Buffer.from(JSON.stringify(nextPayload, null, 2), "utf8"), remoteSitesPath);
await sftp.end();

console.log(`Pushed WP Engine credentials to ${merged.length} properties (${applied} updated${changed ? "" : ", no changes"})`);
console.log(`CSV rows: ${csvRows.length}`);
console.log(`Server: ${remoteSitesPath}`);
