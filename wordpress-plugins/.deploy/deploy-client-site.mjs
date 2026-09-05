/**
 * Deploy neo-pulse-wp to one client from the SFTP CSV.
 *
 * Usage:
 *   node wordpress-plugins/.deploy/deploy-client-site.mjs <website-link> [username]
 *
 * Example:
 *   node wordpress-plugins/.deploy/deploy-client-site.mjs kwbllp.com
 *   node wordpress-plugins/.deploy/deploy-client-site.mjs blindmagic.com blindmagic1stg-Flowbie
 */

import { join } from "path";
import { execSync } from "child_process";
import { buildPluginZip } from "../deploy/lib/build-zip.js";
import { deployZip } from "../deploy/lib/deploy-zip.js";
import { loadSites } from "../deploy/lib/csv-sites.js";

const dir = join(import.meta.dirname, "..");
const repoRoot = join(dir, "..");
const csvPath = join(dir, "Customer List", "SFTP Users_Clients List.csv");
const zipPath = join(dir, "neo-pulse-wp.zip");
const pluginDir = join(dir, "neo-pulse-wp");

const siteKey = (process.argv[2] || "").trim().toLowerCase();
const userKey = (process.argv[3] || "").trim();

if (!siteKey) {
  console.error("Usage: deploy-client-site.mjs <website-link> [username]");
  process.exit(1);
}

const sites = loadSites(csvPath);
const matches = sites.filter((row) => {
  if (row.site.toLowerCase() !== siteKey) return false;
  if (userKey && row.username !== userKey) return false;
  return true;
});

if (matches.length === 0) {
  console.error(`No CSV row for ${siteKey}${userKey ? ` (${userKey})` : ""}`);
  process.exit(1);
}

if (matches.length > 1) {
  console.error(`Multiple rows for ${siteKey}. Pass username as second argument.`);
  for (const row of matches) {
    console.error(`  ${row.username}`);
  }
  process.exit(1);
}

const site = matches[0];

execSync("node scripts/embed-wp-secrets.mjs", { cwd: repoRoot, stdio: "inherit" });

process.stdout.write("Building neo-pulse-wp zip...\n");
buildPluginZip(pluginDir, zipPath, (done, total) => {
  process.stdout.write(`\r zip ${Math.round((done / total) * 100)}%`);
});
process.stdout.write("\n");

console.log("Deploying to", site.label, site.host);
const result = await deployZip(site, zipPath, pluginDir, (phase, done, total) => {
  process.stdout.write(`\r ${phase} ${Math.round((done / total) * 100)}%`);
});
process.stdout.write("\n");

if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}

console.log(site.label, "deployed");
