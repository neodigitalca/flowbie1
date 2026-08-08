/**
 * Deploy flowbie.ca: build zip, upload zip in one shot, install (same as flowbie-wp clients).
 *
 *   npm run build:flowbie-ca
 *   npm run deploy:flowbie-ca
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildDirZip } from "./deploy/lib/zip-dir.js";
import { uploadZipAndInstall } from "./deploy/lib/deploy-zip.js";
import { loadSites } from "./deploy/lib/csv-sites.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const distDir = join(repoRoot, "dist");
const pluginDir = join(__dirname, "flowbie-app");
const deployDir = join(__dirname, ".deploy");
const csvPath = join(__dirname, "Customer List", "SFTP Users_Clients List.csv");

const HTACCESS = `# Flowbie SPA fallback
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /flowbie/
RewriteRule ^index\\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /flowbie/index.html [L]
</IfModule>
`;

function loadSite() {
  const row = loadSites(csvPath).find((s) => s.site === "flowbie.ca");
  if (!row) {
    console.error("flowbie.ca not found in Customer List CSV");
    process.exit(1);
  }
  return row;
}

function progress(label) {
  return (phase, done, total) => {
    if (phase === "upload") {
      const pct = total ? Math.round((done / total) * 100) : 0;
      process.stdout.write(`\r  ${label} zip upload: ${pct}%`);
      if (done >= total) process.stdout.write("\n");
      return;
    }
    if (phase === "install") {
      process.stdout.write(`\r  ${label} install: ${done}/${total}`);
      if (done >= total) process.stdout.write("\n");
    }
  };
}

async function main() {
  if (!existsSync(distDir)) {
    console.error("dist/ missing. Run: npm run build:flowbie-ca");
    process.exit(1);
  }

  const site = loadSite();
  mkdirSync(deployDir, { recursive: true });

  writeFileSync(join(distDir, ".htaccess"), HTACCESS, "utf8");

  const distZip = join(deployDir, "flowbie-ca-dist.zip");
  const appZip = join(deployDir, "flowbie-ca-app.zip");

  console.log("Building zips...");
  buildDirZip(distDir, distZip);
  buildDirZip(pluginDir, appZip, { zipPrefix: "flowbie-app" });
  console.log("  dist zip:", distZip);
  console.log("  app zip:", appZip);

  console.log("\nDeploy:", site.site);
  console.log("Host:", `${site.host}:${site.port}`);
  console.log("User:", site.username);

  console.log("\n=== React dist ===");
  await uploadZipAndInstall(site, {
    zipPath: distZip,
    localDir: distDir,
    remoteZipPath: "./_flowbie-deploy/flowbie-ca-dist.zip",
    installRoot: "./flowbie",
    verifyRelPath: "index.html",
    onProgress: progress("dist"),
  });

  console.log("\n=== flowbie-app plugin ===");
  await uploadZipAndInstall(site, {
    zipPath: appZip,
    localDir: pluginDir,
    remoteZipPath: "./wp-content/plugins/flowbie-app.zip",
    installRoot: "./wp-content/plugins/flowbie-app",
    verifyRelPath: "flowbie-app.php",
    onProgress: progress("plugin"),
  });

  console.log("\nDone: https://flowbie.ca/flowbie/");
}

main().catch((err) => {
  console.error("Deploy failed:", err.message);
  process.exit(1);
});
