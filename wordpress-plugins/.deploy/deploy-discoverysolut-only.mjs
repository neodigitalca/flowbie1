import { join } from "path";
import { execSync } from "child_process";
import { buildPluginZip } from "../deploy/lib/build-zip.js";
import { deployZip } from "../deploy/lib/deploy-zip.js";
import { loadProductionSites } from "../deploy/lib/csv-sites.js";

const dir = join(import.meta.dirname, "..");
const repoRoot = join(dir, "..");
const csvPath = join(dir, "Customer List", "SFTP Users_Clients List.csv");
const zipPath = join(dir, "neo-pulse-wp.zip");
const pluginDir = join(dir, "neo-pulse-wp");

execSync("node scripts/embed-wp-secrets.mjs", { cwd: repoRoot, stdio: "inherit" });
console.log("Building neo-pulse-wp zip...");
buildPluginZip(pluginDir, zipPath, (done, total) => {
  process.stdout.write(`\r zip ${Math.round((done / total) * 100)}%`);
});
process.stdout.write("\n");

const sites = loadProductionSites(csvPath);
const site = sites.find((s) => s.host.includes("discoverysolut"));
if (!site) {
  console.error("discoverysolut not found in production CSV");
  process.exit(1);
}

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
