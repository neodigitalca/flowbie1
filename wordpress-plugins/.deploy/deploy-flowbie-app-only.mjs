import { join } from "path";
import { mkdirSync } from "fs";
import { buildDirZip } from "../deploy/lib/zip-dir.js";
import { uploadZipAndInstall } from "../deploy/lib/deploy-zip.js";
import { loadSites } from "../deploy/lib/csv-sites.js";

const dir = join(import.meta.dirname, "..");
const pluginDir = join(dir, "flowbie-app");
const deployDir = join(dir, ".deploy");
const csvPath = join(dir, "Customer List", "SFTP Users_Clients List.csv");
const site = loadSites(csvPath).find((s) => s.site === "flowbie.ca");

if (!site) {
  console.error("flowbie.ca not found");
  process.exit(1);
}

mkdirSync(deployDir, { recursive: true });
const appZip = join(deployDir, "flowbie-ca-app-only.zip");
console.log("Building flowbie-app zip...");
buildDirZip(pluginDir, appZip, { zipPrefix: "flowbie-app" });
console.log("Deploying plugin to", site.site, site.host);

await uploadZipAndInstall(site, {
  zipPath: appZip,
  localDir: pluginDir,
  remoteZipPath: "./wp-content/plugins/flowbie-app.zip",
  installRoot: "./wp-content/plugins/flowbie-app",
  verifyRelPath: "includes/flowbie-app-secrets.php",
  onProgress: (phase, done, total) => {
    if (phase === "upload") {
      process.stdout.write(`\r upload ${Math.round((done / total) * 100)}%`);
    }
    if (phase === "install" && done === total) {
      process.stdout.write("\n install done\n");
    }
  },
});

console.log("flowbie.ca plugin deployed");
