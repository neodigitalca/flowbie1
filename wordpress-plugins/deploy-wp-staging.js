/**
 * Deploy neo-pulse-wp zip to staging only (1stg SFTP rows in the client CSV).
 *
 * Run: npm run deploy:wp-staging
 * Or:  wordpress-plugins/deploy-wp-staging.bat
 */

import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { accent, bar, bold, err, header, ok, pct } from "./deploy/lib/theme.js";
import { loadStagingSites } from "./deploy/lib/csv-sites.js";
import { buildPluginZip } from "./deploy/lib/build-zip.js";
import { deployZip } from "./deploy/lib/deploy-zip.js";

const dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(dir, "..");
const csvPath = join(dir, "Customer List", "SFTP Users_Clients List.csv");
const zipPath = join(dir, "neo-pulse-wp.zip");
const pluginDir = join(dir, "neo-pulse-wp");

function renderProgress(label, done, total) {
  process.stdout.write("\r\x1b[2K  " + bold(label) + " " + bar(done / total) + " " + accent(pct(done, total)));
}

function buildZip() {
  buildPluginZip(pluginDir, zipPath, (done, total) => {
    renderProgress("Zip", done, total);
  });
  process.stdout.write("\n");
}

async function deploySite(site) {
  console.log(bold(site.label));
  const result = await deployZip(site, zipPath, pluginDir, (phase, done, total) => {
    const label = phase === "upload" ? "Upload" : "Extract";
    renderProgress(label, done, total);
  });
  process.stdout.write("\n");
  if (!result.ok) {
    console.log(err(result.site + " — " + result.error));
    return false;
  }
  console.log(ok(result.site));
  return true;
}

async function main() {
  header("NEO Pulse WP Staging Deploy");

  const sites = loadStagingSites(csvPath);
  if (sites.length === 0) {
    console.log(err("No staging credentials in CSV (look for 1stg in host or username)"));
    process.exit(1);
  }

  execSync("node scripts/embed-wp-secrets.mjs", { cwd: repoRoot, stdio: "pipe" });
  buildZip();
  console.log();

  let okCount = 0;
  for (const site of sites) {
    if (await deploySite(site)) okCount += 1;
    console.log();
  }

  if (okCount === sites.length) {
    console.log(ok(`${okCount} staging upload${sites.length === 1 ? "" : "s"}`));
  } else {
    console.log(err(`${okCount} uploaded · ${sites.length - okCount} failed`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(err(e.message));
  process.exit(1);
});
