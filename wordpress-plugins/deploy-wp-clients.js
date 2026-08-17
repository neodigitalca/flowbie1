/**
 * Interactive neo-pulse-wp zip deploy to WP Engine clients (production only).
 *
 * Run: npm run deploy:wp-clients
 * Or:  wordpress-plugins/deploy-wp-clients.bat
 *
 * Staging: wordpress-plugins/deploy-wp-staging.bat
 */

import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { accent, bar, bold, err, header, ok, pct } from "./deploy/lib/theme.js";
import { loadProductionSites } from "./deploy/lib/csv-sites.js";
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

function printMenu(sites) {
  console.log(accent("  0") + "  " + bold(`All · ${sites.length}`));
  sites.forEach((site, i) => {
    console.log(accent(String(i + 1).padStart(2, " ")) + "  " + bold(site.label));
  });
  console.log();
}

async function promptChoice(sites) {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(accent("▸ "));
    const n = Number(answer.trim());
    if (!Number.isInteger(n) || n < 0 || n > sites.length) {
      console.log(err("Invalid selection"));
      return null;
    }
    return n;
  } finally {
    rl.close();
  }
}

async function deploySite(site) {
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
  header("NEO Pulse WP Deploy");

  for (;;) {
    const sites = loadProductionSites(csvPath);
    if (sites.length === 0) {
      console.log(err("No production credentials in CSV"));
      process.exit(1);
    }

    execSync("node scripts/embed-wp-secrets.mjs", { cwd: repoRoot, stdio: "pipe" });
    buildZip();
    printMenu(sites);

    const choice = await promptChoice(sites);
    if (choice === null) {
      console.log();
      continue;
    }

    const targets = choice === 0 ? sites : [sites[choice - 1]];
    console.log();

    let okCount = 0;
    if (targets.length === 1) {
      if (await deploySite(targets[0])) okCount = 1;
    } else {
      const results = await Promise.all(
        targets.map(async (site) => {
          const result = await deployZip(site, zipPath, pluginDir);
          return result;
        }),
      );
      console.log();
      for (const result of results) {
        if (result.ok) {
          console.log(ok("  " + result.site));
          okCount += 1;
        } else {
          console.log(err("  " + result.site + " — " + result.error));
        }
      }
    }

    console.log();
    if (okCount === targets.length) {
      console.log(ok(`${okCount} uploaded`));
    } else {
      console.log(err(`${okCount} uploaded · ${targets.length - okCount} failed`));
    }
    console.log();
  }
}

main().catch((e) => {
  console.error(err(e.message));
  process.exit(1);
});
